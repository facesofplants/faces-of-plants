import { type NextRequest, NextResponse } from 'next/server';

import type { GBIFSearchParams, GBIFOccurrence } from '@faces-of-plants/core/src/types';
import { createLLMClientFromEnv, LLMClient, type GeoSearchResult } from '@faces-of-plants/core/src/services/llm';
import { QUERY_ALIASES, applyQueryCorrection, buildTaxonomyCandidates, splitPlantAndLocation } from '@faces-of-plants/core/src/services/query-coverage';
import { resolveLocalTaxonomy, resolveLocalTaxonomyFromEntries } from '@faces-of-plants/core/src/services/localTaxonomyResolver';
import { isNarrativeQuery, compileNarrativeIntent, type NarrativeSearchIntent } from '@faces-of-plants/core/src/services/narrativeIntentCompiler';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { getToken } from 'next-auth/jwt';

import { GBIFClient } from '../../../../../functions/gbif/client';
import { getSystemSettings } from '../../../lib/system-settings';
import { getRuntimeTaxonomyEntries } from '../../../lib/taxonomy-cache';

const dynamoClient = new DynamoDBClient({});
const SEARCH_LOGS_TABLE = process.env.SEARCH_LOGS_TABLE;

function createRuntimeLLMClient(adminApiKey?: string): LLMClient | null {
  const trimmedKey = adminApiKey?.trim();
  if (trimmedKey) {
    const provider = process.env.LLM_PROVIDER || 'mistral';
    const endpoint = process.env.LLM_ENDPOINT;
    const model = process.env.LLM_MODEL;
    console.log(`[LLMClient] Initialized from system settings with provider: ${provider}, model: ${model || 'default'}`);
    return new LLMClient(provider, trimmedKey, endpoint, model);
  }

  return createLLMClientFromEnv();
}

/**
 * Quick check: is this already a valid Latin binomial/trinomial name?
 * e.g. "Quercus robur", "Rosa canina", "Pinus sylvestris var. hamata"
 * Single words (like "Querce", "Pino") are NOT accepted — they go through resolution.
 */
function isScientificName(query: string): boolean {
  const words = query.trim().split(/\s+/);
  if (words.length < 2 || words.length > 3) return false;
  if (!/^[A-Z][a-z]{2,}$/.test(words[0])) return false;
  return words.slice(1).every(w => /^[a-z]{2,}$/.test(w));
}

function normalizeScientificNameForCompare(input: string): string {
  return input.trim().replace(/\s+/g, ' ').toLowerCase();
}

async function validateScientificNameCandidate(query: string): Promise<{ scientificName: string; genus?: string; rank?: string; taxonKey?: number } | null> {
  try {
    const res = await fetch(
      `https://api.gbif.org/v1/species/match?${new URLSearchParams({
        name: query,
        kingdom: 'Plantae',
        verbose: 'true',
      })}`,
      { headers: { Accept: 'application/json' } },
    );
    if (!res.ok) return null;

    const match = await res.json();
    const canonical = normalizeScientificNameForCompare(match.canonicalName || '');
    const input = normalizeScientificNameForCompare(query);

    const isExactCanonical = canonical === input;
    if (
      match.matchType !== 'NONE' &&
      match.confidence >= 98 &&
      match.kingdom === 'Plantae' &&
      !HIGH_RANKS.has(match.rank) &&
      isExactCanonical
    ) {
      return {
        scientificName: match.canonicalName || match.scientificName,
        genus: match.genus,
        rank: match.rank,
        taxonKey: match.usageKey || match.key,
      };
    }

    return null;
  } catch {
    return null;
  }
}

async function resolveTaxonKeyForScientificName(query: string): Promise<{ scientificName: string; genus?: string; rank?: string; taxonKey?: number } | null> {
  try {
    const res = await fetch(
      `https://api.gbif.org/v1/species/match?${new URLSearchParams({
        name: query,
        kingdom: 'Plantae',
        verbose: 'true',
      })}`,
      { headers: { Accept: 'application/json' } },
    );
    if (!res.ok) return null;

    const match = await res.json();
    const canonical = normalizeScientificNameForCompare(match.canonicalName || '');
    const input = normalizeScientificNameForCompare(query);
    const isExactCanonical = canonical === input;

    if (
      match.matchType === 'NONE' ||
      match.confidence < 90 ||
      match.kingdom !== 'Plantae' ||
      HIGH_RANKS.has(match.rank) ||
      !isExactCanonical
    ) {
      return null;
    }

    return {
      scientificName: match.canonicalName || match.scientificName || query,
      genus: match.genus,
      rank: match.rank,
      taxonKey: match.usageKey || match.key,
    };
  } catch {
    return null;
  }
}

// ─── PLANT NAME RESOLUTION (dynamic, via GBIF Species API) ───────────────────

/**
 * Generate singular/stemmed variants of a plant name.
 * GBIF indexes vernacular names mostly in singular form, but users may type plurals.
 */
function getStemVariants(query: string): string[] {
  const q = query.trim().toLowerCase();
  const variants = [q];

  // Italian plural → singular patterns:
  // -ghi → -go (funghi→fungo), -chi → -co (boschi→bosco)
  if (q.endsWith('ghi')) variants.push(q.slice(0, -3) + 'go');
  else if (q.endsWith('chi')) variants.push(q.slice(0, -3) + 'co');
  // -gi → -gio (ciliegi→ciliegio, faggi→faggio) — common pattern for -gio words
  else if (q.endsWith('gi')) variants.push(q + 'o');
  // -ci → -cio (lanci→lancio)
  else if (q.endsWith('ci')) variants.push(q + 'o');
  // -i → -o, -e (castagni→castagno, pini→pino, querce→quercia)
  else if (q.endsWith('i')) variants.push(q.slice(0, -1) + 'o', q.slice(0, -1) + 'e');
  // -e → -a, -o (for feminine plural like querce→quercia)
  if (q.endsWith('e') && q.length > 4) variants.push(q.slice(0, -1) + 'a', q.slice(0, -1) + 'o');

  // English plurals: -ies → -y, -es → -e / strip, -s → strip
  if (q.endsWith('ies') && q.length > 4) variants.push(q.slice(0, -3) + 'y');
  else if (q.endsWith('es') && q.length > 4) variants.push(q.slice(0, -2), q.slice(0, -1));
  else if (q.endsWith('s') && !q.endsWith('ss') && q.length > 3) variants.push(q.slice(0, -1));

  // Deduplicate
  return [...new Set(variants)];
}

// Ranks that are too high to be useful (kingdom, phylum, class, order)
const HIGH_RANKS = new Set(['KINGDOM', 'PHYLUM', 'CLASS', 'ORDER', 'SUPERORDER', 'SUBCLASS', 'SUBPHYLUM']);

/**
 * Resolve a plant name using GBIF's Species API.
 * Uses multiple strategies: vernacular name search (qField=VERNACULAR),
 * species/match, and full-text search. Covers ALL languages indexed by GBIF.
 * Automatically tries singular/stemmed variants if the original fails.
 */
async function resolveSpeciesName(query: string): Promise<{ scientificName: string; genus?: string; rank?: string; taxonKey?: number } | null> {
  const alias = QUERY_ALIASES[query.trim().toLowerCase()];
  if (alias) {
    console.log(`[MAP-SEARCH] Alias resolved: "${query}" → ${alias.scientificName}`);
    return {
      scientificName: alias.scientificName,
      genus: alias.genus,
      rank: alias.rank,
    };
  }

  const variants = [...new Set(getStemVariants(query).flatMap((variant) => buildTaxonomyCandidates(variant)))];
  console.log(`[MAP-SEARCH] Trying species resolution for: ${JSON.stringify(variants)}`);

  for (const variant of variants) {
    const result = await tryResolveSpeciesSingle(variant);
    if (result) return result;
  }
  return null;
}

async function tryResolveSpeciesSingle(query: string): Promise<{ scientificName: string; genus?: string; rank?: string; taxonKey?: number } | null> {
  try {
    // Strategy 1: GBIF vernacular name search (best for common names in any language)
    const vernacularRes = await fetch(
      `https://api.gbif.org/v1/species/search?${new URLSearchParams({
        q: query, qField: 'VERNACULAR', kingdom: 'Plantae', limit: '5',
      })}`,
      { headers: { Accept: 'application/json' } },
    );
    if (vernacularRes.ok) {
      const data = await vernacularRes.json();
      // Accept Plantae OR entries with undefined kingdom + nubKey (sub-entries).
      // REJECT entries with explicit non-Plantae kingdom (e.g. Animalia, Fungi).
      const results = data.results?.filter((r: any) =>
        r.canonicalName && !HIGH_RANKS.has(r.rank) &&
        (r.kingdom === 'Plantae' || (!r.kingdom && r.nubKey))
      );
      if (results?.length > 0) {
        const best = results[0];
        // Use nubKey (GBIF Backbone key) for most precise occurrence filtering
        const taxonKey = best.nubKey || best.key;
        console.log(`[MAP-SEARCH] GBIF vernacular: "${query}" → ${best.canonicalName} (rank: ${best.rank}, taxonKey: ${taxonKey})`);
        return {
          scientificName: best.canonicalName,
          genus: best.rank === 'GENUS' ? best.canonicalName : best.genus,
          rank: best.rank,
          taxonKey,
        };
      }
    }

    // Strategy 2: species/match (fuzzy Latin name matching)
    // Reject matches to high-level ranks (kingdom, phylum, class, order)
    const matchRes = await fetch(
      `https://api.gbif.org/v1/species/match?${new URLSearchParams({
        name: query, kingdom: 'Plantae', verbose: 'true',
      })}`,
      { headers: { Accept: 'application/json' } },
    );
    if (matchRes.ok) {
      const match = await matchRes.json();
      if (match.matchType !== 'NONE' && match.confidence >= 75 && match.kingdom === 'Plantae' && !HIGH_RANKS.has(match.rank)) {
        const taxonKey = match.usageKey || match.key;
        console.log(`[MAP-SEARCH] GBIF match: "${query}" → ${match.canonicalName} (confidence: ${match.confidence}, rank: ${match.rank}, taxonKey: ${taxonKey})`);
        return {
          scientificName: match.canonicalName || match.scientificName,
          genus: match.genus,
          rank: match.rank,
          taxonKey,
        };
      }
    }

    // Strategy 3: Full-text search across all name fields
    const searchRes = await fetch(
      `https://api.gbif.org/v1/species/search?${new URLSearchParams({
        q: query, kingdom: 'Plantae', limit: '5',
      })}`,
      { headers: { Accept: 'application/json' } },
    );
    if (searchRes.ok) {
      const data = await searchRes.json();
      const results = data.results?.filter((r: any) =>
        r.canonicalName && !HIGH_RANKS.has(r.rank) &&
        (r.kingdom === 'Plantae' || (!r.kingdom && r.nubKey))
      );
      if (results?.length > 0) {
        const best = results[0];
        const taxonKey = best.nubKey || best.key;
        console.log(`[MAP-SEARCH] GBIF full-text: "${query}" → ${best.canonicalName} (rank: ${best.rank}, taxonKey: ${taxonKey})`);
        return {
          scientificName: best.canonicalName,
          genus: best.rank === 'GENUS' ? best.canonicalName : best.genus,
          rank: best.rank,
          taxonKey,
        };
      }
    }

    return null;
  } catch (error) {
    console.warn(`[MAP-SEARCH] Species resolution failed:`, error instanceof Error ? error.message : error);
    return null;
  }
}

// ─── LOCATION RESOLUTION (dynamic, via Nominatim/OpenStreetMap) ──────────────

/**
 * Resolve a location string to a bounding box and country code using Nominatim.
 * Works for ANY place name in ANY language (cities, regions, countries, landmarks).
 * Retries with title-cased words if first attempt fails.
 */
async function resolveLocation(locationStr: string): Promise<{ country?: string; boundingBox: { south: number; north: number; west: number; east: number }; isCountryLevel: boolean; locationName?: string } | null> {
  const result = await nominatimLookup(locationStr);
  if (result) return result;

  // Retry with title case if original was all lowercase
  const titleCased = locationStr.replace(/\b\w/g, c => c.toUpperCase());
  if (titleCased !== locationStr) {
    console.log(`[MAP-SEARCH] Nominatim retry with title case: "${titleCased}"`);
    return nominatimLookup(titleCased);
  }
  return null;
}

async function nominatimLookup(locationStr: string): Promise<{ country?: string; boundingBox: { south: number; north: number; west: number; east: number }; isCountryLevel: boolean; locationName?: string } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?${new URLSearchParams({
        q: locationStr, format: 'json', limit: '1', addressdetails: '1',
      })}`,
      { headers: { 'User-Agent': 'FacesOfPlants/1.0 (biodiversity research)', Accept: 'application/json' } },
    );
    if (!res.ok) return null;

    const results = await res.json();
    if (!results?.length) return null;

    const place = results[0];
    const bbox = place.boundingbox; // [south, north, west, east] as strings

    if (!bbox || bbox.length < 4) return null;

    const south = parseFloat(bbox[0]);
    const north = parseFloat(bbox[1]);
    const west = parseFloat(bbox[2]);
    const east = parseFloat(bbox[3]);

    const countryCode = place.address?.country_code?.toUpperCase() || undefined;
    const addresstype = typeof place.addresstype === 'string' ? place.addresstype.toLowerCase() : '';
    const placeType = typeof place.type === 'string' ? place.type.toLowerCase() : '';
    const isCountryLevel = addresstype === 'country' || placeType === 'country';

    console.log(`[MAP-SEARCH] Nominatim: "${locationStr}" → ${place.display_name} (${countryCode}, bbox: [${south},${north},${west},${east}])`);

    return {
      country: countryCode,
      boundingBox: { south, north, west, east },
      isCountryLevel,
      locationName: place.name || (typeof place.display_name === 'string' ? place.display_name.split(',')[0].trim() : undefined),
    };
  } catch (error) {
    console.warn(`[MAP-SEARCH] Nominatim geocoding failed:`, error instanceof Error ? error.message : error);
    return null;
  }
}

// ─── QUERY PARSING ───────────────────────────────────────────────────────────

/**
 * Split a natural language query into plant-part and location-part.
 * e.g. "querce in Toscana" → { plantPart: "querce", locationPart: "Toscana" }
 */
function splitQueryParts(query: string): { plantPart: string; locationPart: string | null } {
  return splitPlantAndLocation(query);
}

type IntentQuery = {
  searchQuery?: string;
  mediaType?: 'StillImage';
  monthRange?: number[];
  colorKeywords?: string[];
  habitatKeywords?: string[];
  semanticTags?: string[];
  displayName?: string;
  strategyMessage?: string;
};

const INTENT_HABITATS = [
  { key: 'rainforest', label: 'rainforests', pattern: /\b(?:rainforest|rainforests|tropical forest|tropical forests|foresta pluviale|foreste pluviali|selva|jungla|jungle|forêt tropicale|regenwald)\b/iu },
  { key: 'forest', label: 'forests', pattern: /\b(?:forest|forests|woodland|woodlands|bosco|boschi|foresta|foreste|forêt|forêts|wald|wälder)\b/iu },
  { key: 'meadow', label: 'meadows', pattern: /\b(?:meadow|meadows|grassland|grasslands|prairie|prairies|prato|prati|pradera|praderas|prairie|prairies|wiese|wiesen)\b/iu },
  { key: 'wetland', label: 'wetlands', pattern: /\b(?:wetland|wetlands|marsh|marshes|swamp|swamps|bog|bogs|palude|paludi|pantano|pantanos|marécage|marais)\b/iu },
  { key: 'coast', label: 'coastal areas', pattern: /\b(?:coast|coastal|shore|shoreline|dune|dunes|costa|coste|playa|beach|spiaggia|spiagge|littoral|küste)\b/iu },
  { key: 'mountain', label: 'mountain habitats', pattern: /\b(?:mountain|mountains|alpine|alpino|alpina|montagna|montagne|montaña|montañas|montagne|gebirge|berg)\b/iu },
  { key: 'desert', label: 'dry habitats', pattern: /\b(?:desert|deserts|arid|semi-arid|dryland|deserto|deserti|desierto|désert|wüste)\b/iu },
  { key: 'river', label: 'river habitats', pattern: /\b(?:river|rivers|stream|streams|creek|creeks|fiume|fiumi|rio|río|rivière|rivieres|bach)\b/iu },
];

const INTENT_COLORS = [
  { key: 'red', label: 'red', pattern: /\b(?:red|rosso|rossa|rossi|rosse|rojo|roja|rouge|rouges|rot|rote|roten)\b/iu },
  { key: 'yellow', label: 'yellow', pattern: /\b(?:yellow|giallo|gialla|gialli|gialle|amarillo|amarilla|jaune|gelb)\b/iu },
  { key: 'blue', label: 'blue', pattern: /\b(?:blue|blu|azzurro|azzurra|azules?|bleu|bleue|blau)\b/iu },
  { key: 'purple', label: 'purple', pattern: /\b(?:purple|violet|viola|violeta|violette|lila)\b/iu },
  { key: 'white', label: 'white', pattern: /\b(?:white|bianco|bianca|blanco|blanca|blanc|blanche|weiß|weiss)\b/iu },
  { key: 'pink', label: 'pink', pattern: /\b(?:pink|rosa|rosado|rosada|rose)\b/iu },
  { key: 'orange', label: 'orange', pattern: /\b(?:orange|arancione|naranja|orangé)\b/iu },
  { key: 'colorful', label: 'colorful', pattern: /\b(?:colorful|colourful|colored|coloured|variopint[oaie]|multicolor(?:e|i|ed|es)?|variado|variada|coloré|colorée|bunt)\b/iu },
];

const INTENT_SEMANTICS = [
  { key: 'medicinal', label: 'medicinal', pattern: /\b(?:medicinal|medicinale|medicinali|medicinales|healing|curative|officinal|officinale)\b/iu, queryToken: 'medicinal' },
  { key: 'edible', label: 'edible', pattern: /\b(?:edible|commestibile|commestibili|comestible|comestibles|mangiare|eatable)\b/iu, queryToken: 'edible' },
  { key: 'aromatic', label: 'aromatic', pattern: /\b(?:aromatic|aromatica|aromatiche|aromática|aromatiques?)\b/iu, queryToken: 'aromatic' },
  { key: 'pollinator', label: 'pollinator-friendly', pattern: /\b(?:pollinator|pollinators|api|api-friendly|bee(?:s)?|butterfl(?:y|ies)|farfalle|impollinator(?:e|i)|abejas?|abeille|abeilles)\b/iu, queryToken: 'pollinator' },
  { key: 'native', label: 'native', pattern: /\b(?:native|nativa|nativo|natives|indigenous|autocton[oaie]|autócton[oaie]|indig[eè]ne)\b/iu, queryToken: 'native' },
  { key: 'endemic', label: 'endemic', pattern: /\b(?:endemic|endemica|endemico|endemiche|endémique|endémico)\b/iu, queryToken: 'endemic' },
  { key: 'invasive', label: 'invasive', pattern: /\b(?:invasive|invasiva|invasivo|alien species|specie invasive|especies invasoras|espèces invasives)\b/iu, queryToken: 'invasive' },
  { key: 'drought', label: 'drought-tolerant', pattern: /\b(?:drought|siccit[aà]|dry tolerant|xero(?:phyte|fita)|arid tolerant|secca)\b/iu, queryToken: 'drought tolerant' },
  { key: 'shade', label: 'shade-tolerant', pattern: /\b(?:shade|ombra|ombreggiat[oaie]|sombra|sombr[aí]o|ombre|schatten)\b/iu, queryToken: 'shade tolerant' },
  { key: 'sun', label: 'sun-loving', pattern: /\b(?:full sun|sunny|sole|solare|sun-loving|heliofita|sun exposed)\b/iu, queryToken: 'sun tolerant' },
  { key: 'perennial', label: 'perennial', pattern: /\b(?:perennial|perenne|perennes?|vivace|vivaces)\b/iu, queryToken: 'perennial' },
  { key: 'annual', label: 'annual', pattern: /\b(?:annual|annuale|anual|annuel|annuale)\b/iu, queryToken: 'annual' },
  { key: 'rare', label: 'rare', pattern: /\b(?:rare|rar[oaie]|raras?|uncommon|insolito)\b/iu, queryToken: 'rare' },
];

function collectIntentMatches(
  query: string,
  definitions: Array<{ key: string; label: string; pattern: RegExp }>,
): Array<{ key: string; label: string }> {
  return definitions.filter((definition) => definition.pattern.test(query)).map(({ key, label }) => ({ key, label }));
}

function joinLabels(labels: string[]): string {
  if (labels.length === 0) return '';
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`;
}

function parseIntentQuery(query: string): IntentQuery | null {
  const normalized = query.trim();
  if (!normalized) return null;

  const hasFlowers = /\b(?:flowers?|flowering|blooms?|blossoms?|fiori?|fioritura|flor(?:es)?|fleurs?|blumen)\b/iu.test(normalized);
  const hasTrees = /\b(?:trees?|alberi|arbres?|árbol(?:es)?|bäume|baume)\b/iu.test(normalized);
  const hasLeaves = /\b(?:leaf|leaves|foglia|foglie|hojas?|feuilles?|blatt|blätter)\b/iu.test(normalized);
  const hasOrchids = /\b(?:orchids?|orchidee|orquídeas?|orchidées?)\b/iu.test(normalized);
  const hasFerns = /\b(?:ferns?|felci|helechos?|fougères?)\b/iu.test(normalized);
  const hasMosses = /\b(?:moss(?:es)?|muschi|musgos?|mousses?)\b/iu.test(normalized);
  const hasShrubs = /\b(?:shrubs?|bushes|arbusti|arbusto|arbustes?|sträucher)\b/iu.test(normalized);
  const hasGrasses = /\b(?:grasses|grass|graminacee|hierba|hierbas|graminées|gräser)\b/iu.test(normalized);
  const hasSucculents = /\b(?:succulents?|suculente|suculentas?|plantes grasses)\b/iu.test(normalized);
  const hasCacti = /\b(?:cacti|cactus|cactacee|cacto|cactos|kakteen)\b/iu.test(normalized);
  const hasPalms = /\b(?:palms?|palme|palmeras?|palmiers?)\b/iu.test(normalized);
  const hasVines = /\b(?:vines?|climbers?|rampicanti|trepadoras?|lianes?)\b/iu.test(normalized);
  const hasHerbs = /\b(?:herbs?|erbe|hierbas?|herbes?)\b/iu.test(normalized);
  const hasMedicinal = /\b(?:medicinal|medicinale|medicinali|medicinales|healing|curative|curativas?|officinal)\b/iu.test(normalized);
  const colorMatches = collectIntentMatches(normalized, INTENT_COLORS);
  const habitatMatches = collectIntentMatches(normalized, INTENT_HABITATS);
  const semanticMatches = collectIntentMatches(normalized, INTENT_SEMANTICS as Array<{ key: string; label: string; pattern: RegExp }>);
  const wantsImages = colorMatches.length > 0
    || hasFlowers
    || hasLeaves;

  let searchQuery: string | undefined;
  if (hasOrchids) searchQuery = 'Orchidaceae';
  else if (hasFerns) searchQuery = 'Polypodiopsida';
  else if (hasMosses) searchQuery = 'Bryophyta';
  else if (hasCacti) searchQuery = 'Cactaceae';
  else if (hasPalms) searchQuery = 'Arecaceae';
  else if (hasSucculents) searchQuery = 'succulent plant';
  else if (hasFlowers) searchQuery = 'flower';
  else if (hasTrees) searchQuery = 'tree';
  else if (hasShrubs) searchQuery = 'shrub';
  else if (hasGrasses) searchQuery = 'grass';
  else if (hasVines) searchQuery = 'vine';
  else if (hasHerbs || hasMedicinal) searchQuery = 'herb';
  else if (hasLeaves) searchQuery = 'leaf';

  if (!searchQuery && habitatMatches.length > 0) {
    searchQuery = 'plant';
  }

  const colorKeywords = colorMatches.map((match) => match.key);
  const colorLabels = colorMatches.map((match) => match.label);
  const habitatKeywords = habitatMatches.map((match) => match.key);
  const habitatLabels = habitatMatches.map((match) => match.label);

  if (searchQuery && colorKeywords.length > 0 && /^(flower|leaf|tree|shrub|vine|herb|grass|plant)$/.test(searchQuery)) {
    searchQuery = `${joinLabels(colorKeywords)} ${searchQuery}`;
  }

  if (searchQuery && habitatKeywords.length > 0) {
    searchQuery = `${searchQuery} ${habitatKeywords.join(' ')}`;
  }

  const semanticTags = semanticMatches.map((match) => match.key);
  const semanticQueryTokens = (INTENT_SEMANTICS as Array<{ key: string; label: string; pattern: RegExp; queryToken: string }>)
    .filter((semantic) => semanticTags.includes(semantic.key))
    .map((semantic) => semantic.queryToken);

  if (searchQuery && semanticQueryTokens.length > 0) {
    searchQuery = `${searchQuery} ${semanticQueryTokens.join(' ')}`;
  } else if (hasMedicinal && searchQuery) {
    searchQuery = `${searchQuery} medicinal`;
  }

  let monthRange: number[] | undefined;
  if (/\b(?:spring|springtime|primavera|printemps|frühling)\b/iu.test(normalized)) monthRange = [3, 4, 5];
  else if (/\b(?:summer|estate|été|verano|sommer)\b/iu.test(normalized)) monthRange = [6, 7, 8];
  else if (/\b(?:autumn|fall|autunno|automne|otoño|herbst)\b/iu.test(normalized)) monthRange = [9, 10, 11];
  else if (/\b(?:winter|inverno|hiver|invierno)\b/iu.test(normalized)) monthRange = [12, 1, 2];

  if (!searchQuery && !wantsImages && !monthRange && habitatKeywords.length === 0 && semanticTags.length === 0) return null;

  const displayParts: string[] = [];
  if (colorLabels.length > 0) displayParts.push(joinLabels(colorLabels));
  if (hasFlowers) displayParts.push('flowers');
  else if (hasTrees) displayParts.push('trees');
  else if (hasLeaves) displayParts.push('leaves');
  else if (hasOrchids) displayParts.push('orchids');
  else if (hasFerns) displayParts.push('ferns');
  else if (hasMosses) displayParts.push('mosses');
  else if (hasShrubs) displayParts.push('shrubs');
  else if (hasGrasses) displayParts.push('grasses');
  else if (hasSucculents) displayParts.push('succulents');
  else if (hasCacti) displayParts.push('cacti');
  else if (hasPalms) displayParts.push('palms');
  else if (hasVines) displayParts.push('vines');
  else if (hasHerbs || hasMedicinal) displayParts.push('herbs');
  else displayParts.push('plants');

  const semanticLabels = (INTENT_SEMANTICS as Array<{ key: string; label: string; pattern: RegExp; queryToken: string }>)
    .filter((semantic) => semanticTags.includes(semantic.key))
    .map((semantic) => semantic.label);

  const displayName = displayParts.join(' ').replace(/\s+/g, ' ').trim();
  const strategyParts = [`Searching ${displayName}`];
  if (wantsImages) strategyParts.push('with images');
  if (monthRange) {
    if (monthRange[0] === 3) strategyParts.push('for spring observations');
    else if (monthRange[0] === 6) strategyParts.push('for summer observations');
    else if (monthRange[0] === 9) strategyParts.push('for autumn observations');
    else strategyParts.push('for winter observations');
  }
  if (habitatLabels.length > 0) strategyParts.push(`in ${joinLabels(habitatLabels)}`);
  if (semanticLabels.length > 0) strategyParts.push(`focused on ${joinLabels(semanticLabels)}`);

  return {
    searchQuery,
    mediaType: wantsImages ? 'StillImage' : undefined,
    monthRange,
    colorKeywords,
    habitatKeywords,
    semanticTags,
    displayName,
    strategyMessage: strategyParts.join(' '),
  };
}

function buildGeometryFromBboxString(bboxStr: string): string | null {
  const [swLat, swLng, neLat, neLng] = bboxStr.split(',').map(Number);
  if ([swLat, swLng, neLat, neLng].some((value) => Number.isNaN(value))) return null;
  return `POLYGON((${swLng} ${swLat},${neLng} ${swLat},${neLng} ${neLat},${swLng} ${neLat},${swLng} ${swLat}))`;
}

function matchesMonthRange(eventDate: string | undefined, months: number[]): boolean {
  if (!eventDate) return false;
  const date = new Date(eventDate);
  if (Number.isNaN(date.getTime())) return false;
  return months.includes(date.getUTCMonth() + 1);
}

function scoreIntentOccurrence(occurrence: GBIFOccurrence, intentQuery: IntentQuery): number {
  let score = 0;

  const textBlob = [
    occurrence.locality,
    occurrence.verbatimLocality,
    occurrence.higherGeography,
    occurrence.waterBody,
    occurrence.occurrenceRemarks,
  ].filter(Boolean).join(' ').toLowerCase();

  if (intentQuery.habitatKeywords?.length) {
    for (const keyword of intentQuery.habitatKeywords) {
      if (textBlob.includes(keyword)) score += 5;
    }
  }

  if (intentQuery.semanticTags?.length) {
    for (const tag of intentQuery.semanticTags) {
      if (textBlob.includes(tag)) score += 3;
    }
  }

  if (occurrence.media?.length || occurrence.associatedMedia?.length) score += 4;
  if (occurrence.basisOfRecord === 'HUMAN_OBSERVATION') score += 3;
  if (occurrence.basisOfRecord === 'OBSERVATION') score += 2;
  if (occurrence.coordinateUncertaintyInMeters !== undefined) {
    const uncertainty = occurrence.coordinateUncertaintyInMeters;
    if (uncertainty <= 100) score += 3;
    else if (uncertainty <= 1000) score += 2;
    else if (uncertainty <= 5000) score += 1;
  }

  const year = occurrence.year || (occurrence.eventDate ? new Date(occurrence.eventDate).getUTCFullYear() : undefined);
  if (year && Number.isFinite(year)) {
    const nowYear = new Date().getUTCFullYear();
    const age = Math.max(0, nowYear - year);
    score += Math.max(0, 3 - Math.floor(age / 10));
  }

  return score;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const settings = await getSystemSettings(['api:llm', 'api:gbif_user_agent']);
    const llmClient = createRuntimeLLMClient(settings['api:llm']);
    const gbifClient = new GBIFClient({ userAgent: settings['api:gbif_user_agent']?.trim() || undefined });

    const species = searchParams.get('species') || undefined;
    const country = searchParams.get('country') || undefined;
    const hasCoordinate = searchParams.get('hasCoordinate') !== 'false';
    const limit = parseInt(searchParams.get('limit') || '300', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const sessionId = searchParams.get('sessionId') || undefined;
    const basisOfRecord = searchParams.get('basisOfRecord')?.split(',').filter(Boolean);
    const countries = searchParams.get('countries')?.split(',').filter(Boolean);
    const dateStart = searchParams.get('dateStart');
    const dateEnd = searchParams.get('dateEnd');
    const hasImage = searchParams.get('hasImage') === 'true';
    const bboxStr = searchParams.get('bbox');
    const geoContext = searchParams.get('geoContext') || undefined;

    // Resolve plant name from natural language query (any language)
    let resolvedSpecies: string | undefined;
    let resolvedCountry = country;
    let resolverSource = 'none';
    let resolvedGenus: string | undefined;
    let resolvedTaxonKey: number | undefined;
    let resolvedTaxonRank: string | undefined;
    let suggestedBounds: { south: number; north: number; west: number; east: number } | null = null;
    let suggestedBoundsScope: 'country' | 'subcountry' | 'unknown' = 'unknown';
    let resolvedAreaName: string | undefined;
    let llmUsed = false;
    let intentSearchQuery: string | undefined;
    const correctedSpecies = species ? applyQueryCorrection(species) : undefined;
    const intentQuery = correctedSpecies ? parseIntentQuery(correctedSpecies) : null;
    const splitParts = correctedSpecies ? splitQueryParts(correctedSpecies) : null;
    const hasExplicitLocationHint = Boolean(splitParts?.locationPart);
    let explicitLocationResolved = false;

    // Always resolve explicit location first (when present), even if LLM later resolves species.
    // This prevents broad country fallbacks from overriding sub-country intent (e.g. Scotland).
    if (splitParts?.locationPart) {
      const locationResult = await resolveLocation(splitParts.locationPart);
      if (locationResult) {
        explicitLocationResolved = true;
        if (locationResult.country && !resolvedCountry) resolvedCountry = locationResult.country;
        if (locationResult.boundingBox && !suggestedBounds) {
          suggestedBounds = locationResult.boundingBox;
          suggestedBoundsScope = locationResult.isCountryLevel ? 'country' : 'subcountry';
        }
        if (locationResult.locationName) {
          resolvedAreaName = locationResult.locationName;
        }
      }
    }

    // ─── NARRATIVE MULTI-CRITERIA PATH ─────────────────────────────────────────
    // Detect narrative queries and handle them with multi-taxon parallel retrieval
    if (correctedSpecies && isNarrativeQuery(correctedSpecies) && llmClient && offset === 0) {
      console.log(`[MAP-SEARCH] Narrative query detected: "${correctedSpecies}"`);
      const narrativeIntent = await compileNarrativeIntent(correctedSpecies, llmClient);

      if (narrativeIntent && narrativeIntent.taxa.length > 0) {
        llmUsed = true;

        // Use narrative geography if no explicit location was already resolved
        if (!explicitLocationResolved && narrativeIntent.geography) {
          if (narrativeIntent.geography.bbox) {
            suggestedBounds = narrativeIntent.geography.bbox;
            suggestedBoundsScope = narrativeIntent.geography.type === 'named-area' ? 'subcountry' : 'unknown';
          }
          if (narrativeIntent.geography.country) {
            resolvedCountry = narrativeIntent.geography.country;
          }
          if (narrativeIntent.geography.name) {
            resolvedAreaName = narrativeIntent.geography.name;
          }
        }

        // Build parallel GBIF queries — one per taxon candidate
        const perTaxonLimit = Math.max(50, Math.floor(limit / narrativeIntent.taxa.length));
        const taxaQueries = narrativeIntent.taxa.map((taxon) => {
          const params: GBIFSearchParams = {
            hasCoordinate: true,
            limit: perTaxonLimit,
            scientificName: taxon.scientificName,
          };
          if (resolvedCountry) params.country = resolvedCountry;
          if (countries?.length) params.country = countries.join(',');
          if (basisOfRecord?.length) params.basisOfRecord = basisOfRecord.join(',');
          if (hasImage || narrativeIntent.visual?.mediaRequired) params.mediaType = 'StillImage';
          if (dateStart && dateEnd) {
            const sy = new Date(dateStart).getFullYear();
            const ey = new Date(dateEnd).getFullYear();
            params.year = sy === ey ? sy.toString() : `${sy},${ey}`;
          }
          // Apply bbox geometry
          const effectiveBbox = bboxStr || (suggestedBounds && !resolvedCountry
            ? `${suggestedBounds.south},${suggestedBounds.west},${suggestedBounds.north},${suggestedBounds.east}`
            : null);
          if (effectiveBbox) {
            const geo = buildGeometryFromBboxString(effectiveBbox);
            if (geo) {
              params.geometry = geo;
              delete params.country;
            }
          }
          return { taxon, params };
        });

        // Execute in parallel
        console.log(`[MAP-SEARCH] Narrative: launching ${taxaQueries.length} parallel GBIF queries`);
        const results = await Promise.all(
          taxaQueries.map(async ({ taxon, params }) => {
            try {
              const r = await gbifClient.searchOccurrences({ ...params, offset: 0 });
              return { taxon, occurrences: r.results, count: r.count };
            } catch (err) {
              console.warn(`[MAP-SEARCH] Narrative query failed for ${taxon.scientificName}:`, err instanceof Error ? err.message : err);
              return { taxon, occurrences: [] as GBIFOccurrence[], count: 0 };
            }
          }),
        );

        // Merge and deduplicate by occurrence key
        const seen = new Set<number>();
        let allOccurrences: GBIFOccurrence[] = [];
        let totalCount = 0;

        // Sort by confidence so higher-confidence taxa contribute first
        results.sort((a, b) => b.taxon.confidence - a.taxon.confidence);

        for (const { occurrences: occs, count } of results) {
          totalCount += count;
          for (const occ of occs) {
            if (occ.key && !seen.has(occ.key)) {
              seen.add(occ.key);
              allOccurrences.push(occ);
            }
          }
        }

        // Filter valid coordinates
        allOccurrences = allOccurrences.filter(
          (occ) => occ.decimalLatitude && occ.decimalLongitude &&
            Math.abs(occ.decimalLatitude) <= 90 && Math.abs(occ.decimalLongitude) <= 180,
        );

        // Apply season filter if present
        if (narrativeIntent.season?.months?.length) {
          allOccurrences = allOccurrences.filter((occ) =>
            matchesMonthRange(occ.eventDate, narrativeIntent.season!.months),
          );
          console.log(`[MAP-SEARCH] Narrative season filter (${narrativeIntent.season.label}): ${allOccurrences.length} remain`);
        }

        // Apply client bbox filter if provided
        if (bboxStr) {
          const [swLat, swLng, neLat, neLng] = bboxStr.split(',').map(Number);
          if ([swLat, swLng, neLat, neLng].every((n) => !isNaN(n))) {
            allOccurrences = allOccurrences.filter((occ) => {
              const lat = occ.decimalLatitude!;
              const lng = occ.decimalLongitude!;
              const inLat = lat >= swLat && lat <= neLat;
              const inLng = swLng <= neLng ? (lng >= swLng && lng <= neLng) : (lng >= swLng || lng <= neLng);
              return inLat && inLng;
            });
          }
          if (!suggestedBounds) {
            const [swLat2, swLng2, neLat2, neLng2] = bboxStr.split(',').map(Number);
            if ([swLat2, swLng2, neLat2, neLng2].every((n) => Number.isFinite(n))) {
              suggestedBounds = { south: swLat2, north: neLat2, west: swLng2, east: neLng2 };
            }
          }
        }

        // Cap results
        allOccurrences = allOccurrences.slice(0, limit);

        console.log(`[MAP-SEARCH] Narrative result: ${allOccurrences.length} occurrences from ${results.length} taxa (total ~${totalCount})`);

        // Build taxa summary for resolver info
        const taxaSummary = narrativeIntent.taxa
          .map((t) => `${t.scientificName} (${Math.round(t.confidence * 100)}%)`)
          .join(', ');

        // Log
        const token = await getToken({ req: request as any, secret: process.env.AUTH_SECRET }).catch(() => null);
        logSearchQuery({
          query: species || '',
          gbifParams: { hasCoordinate: true, limit },
          occurrences: allOccurrences.length,
          totalCount,
          resolvedName: taxaSummary,
          resolverSource: 'narrative-intent',
          sessionId,
          ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown',
          userEmail: token?.email || undefined,
        });

        return NextResponse.json({
          success: true,
          data: {
            results: allOccurrences,
            count: totalCount,
            endOfRecords: allOccurrences.length < limit,
            totalFound: allOccurrences.length,
            validCoordinates: allOccurrences.length,
            suggestedBounds,
            resolver: {
              originalQuery: species,
              resolvedName: taxaSummary,
              displayName: narrativeIntent.explanation,
              source: 'narrative-intent',
              country: resolvedCountry,
              areaName: resolvedAreaName,
              areaScope: suggestedBoundsScope,
              llmUsed: true,
              strategyMessage: narrativeIntent.explanation,
            },
            narrativeIntent: {
              taxa: narrativeIntent.taxa,
              traits: narrativeIntent.traits,
              habitat: narrativeIntent.habitat,
              season: narrativeIntent.season,
            },
          },
        });
      }
      // If narrative compilation failed, fall through to standard pipeline
      console.log('[MAP-SEARCH] Narrative compilation failed, falling back to standard pipeline');
    }

    if (correctedSpecies) {
      const localTaxonomyInput = hasExplicitLocationHint && splitParts?.plantPart
        ? splitParts.plantPart
        : correctedSpecies;
      const runtimeTaxonomyEntries = await getRuntimeTaxonomyEntries();
      const localTaxonomyMatch = runtimeTaxonomyEntries
        ? resolveLocalTaxonomyFromEntries(localTaxonomyInput, runtimeTaxonomyEntries)
        : resolveLocalTaxonomy(localTaxonomyInput);
      if (localTaxonomyMatch) {
        resolvedSpecies = localTaxonomyMatch.canonicalName;
        resolvedTaxonKey = localTaxonomyMatch.taxonKey;
        resolvedTaxonRank = localTaxonomyMatch.rank;
        resolverSource = localTaxonomyMatch.source;
        console.log(
          `[MAP-SEARCH] Local taxonomy cache resolved "${localTaxonomyInput}" → ${resolvedSpecies} (rank: ${resolvedTaxonRank}, taxonKey: ${resolvedTaxonKey})`,
        );
      }

      // Fast path: if the query is already a Latin scientific name, use it directly
      if (!resolvedSpecies && isScientificName(correctedSpecies)) {
        const validated = await validateScientificNameCandidate(correctedSpecies);
        if (validated) {
          resolvedSpecies = validated.scientificName;
          resolvedGenus = validated.genus || correctedSpecies.split(' ')[0];
          resolvedTaxonKey = validated.taxonKey;
          resolvedTaxonRank = validated.rank;
          resolverSource = 'direct';
          console.log(`[MAP-SEARCH] Direct scientific name validated: "${correctedSpecies}" → "${resolvedSpecies}"`);
        } else {
          console.log(`[MAP-SEARCH] Scientific candidate failed strict validation: "${correctedSpecies}"`);
        }
      }
      // Primary: use LLM for any natural-language query (handles all languages + geography)
      else if (!resolvedSpecies && llmClient) {
        try {
          // If the user provided an explicit location phrase, run LLM on the plant segment only.
          const llmInput = hasExplicitLocationHint && splitParts?.plantPart
            ? splitParts.plantPart
            : correctedSpecies;
          const geoResult: GeoSearchResult = await llmClient.convertGeoQuery(llmInput);
          llmUsed = true;

          if (geoResult._llmParsed && geoResult.scientificName) {
            resolvedSpecies = geoResult.scientificName;
            resolvedGenus = geoResult.genus || undefined;
            resolverSource = 'llm';
            console.log(`[MAP-SEARCH] LLM resolved "${correctedSpecies}" → "${resolvedSpecies}" (genus: ${resolvedGenus})`);
          }
          // Explicit user location has precedence over LLM-inferred geography.
          if (geoResult.country && !resolvedCountry && !explicitLocationResolved) {
            resolvedCountry = geoResult.country;
          }
          if (geoResult.boundingBox && !explicitLocationResolved) {
            suggestedBounds = geoResult.boundingBox;
            suggestedBoundsScope = 'unknown';
            console.log(`[MAP-SEARCH] LLM extracted bounds:`, suggestedBounds);
          }
        } catch (err) {
          console.warn(`[MAP-SEARCH] LLM failed, falling back:`, err instanceof Error ? err.message : err);
        }
      }

      // Fallback: dynamic resolution via GBIF Species API + Nominatim geocoding
      if (!resolvedSpecies) {
        // Resolve plant name via GBIF Species API (vernacular names in all languages)
        const searchTerm = splitParts?.plantPart || correctedSpecies;
        const speciesResult = await resolveSpeciesName(searchTerm);
        if (speciesResult) {
          resolvedSpecies = speciesResult.scientificName;
          resolvedGenus = speciesResult.genus;
          resolvedTaxonKey = speciesResult.taxonKey;
          resolvedTaxonRank = speciesResult.rank;
          resolverSource = 'gbif-species-api';
          console.log(`[MAP-SEARCH] Resolved: "${searchTerm}" → ${resolvedSpecies} (genus: ${resolvedGenus}, taxonKey: ${resolvedTaxonKey})`);
        } else if (intentQuery?.searchQuery) {
          resolvedSpecies = intentQuery.searchQuery;
          intentSearchQuery = intentQuery.searchQuery;
          resolverSource = 'intent';
          console.log(`[MAP-SEARCH] Intent-resolved: "${correctedSpecies}" → q=${intentSearchQuery}`);
        } else {
          // Location-only fallback: if query is just a place, search generic plants in that area.
          const locationOnly = await resolveLocation(correctedSpecies);
          if (locationOnly) {
            if (locationOnly.country && !resolvedCountry) resolvedCountry = locationOnly.country;
            if (locationOnly.boundingBox && !suggestedBounds) {
              suggestedBounds = locationOnly.boundingBox;
              suggestedBoundsScope = locationOnly.isCountryLevel ? 'country' : 'subcountry';
            }
            if (locationOnly.locationName) {
              resolvedAreaName = locationOnly.locationName;
            }
            resolvedSpecies = 'plant';
            intentSearchQuery = 'plant';
            resolverSource = 'intent-location';
            console.log(`[MAP-SEARCH] Location-only intent: "${correctedSpecies}" → q=plant`);
          }
        }

        if (resolvedSpecies && !resolvedTaxonKey && resolverSource !== 'intent' && resolverSource !== 'intent-location' && resolverSource !== 'raw') {
          const hydratedTaxon = await resolveTaxonKeyForScientificName(resolvedSpecies);
          if (hydratedTaxon?.taxonKey) {
            resolvedTaxonKey = hydratedTaxon.taxonKey;
            resolvedGenus = resolvedGenus || hydratedTaxon.genus;
            resolvedSpecies = hydratedTaxon.scientificName;
            console.log(`[MAP-SEARCH] Hydrated taxonKey=${resolvedTaxonKey} for ${resolvedSpecies}`);
          }
        }

        if (!resolvedSpecies) {
          const fullAlias = QUERY_ALIASES[correctedSpecies.trim().toLowerCase()];
          if (fullAlias) {
            resolvedSpecies = fullAlias.scientificName;
            resolvedGenus = fullAlias.genus;
            resolverSource = 'alias';
            console.log(`[MAP-SEARCH] Full-query alias: "${correctedSpecies}" → ${resolvedSpecies}`);
          }
        }

        if (!resolvedSpecies) {
          // Last resort: send raw query
          resolvedSpecies = correctedSpecies;
          resolverSource = 'raw';
          console.log(`[MAP-SEARCH] No resolution found for "${correctedSpecies}", using raw text`);
        }
      }
    }

    const searchParamsGBIF: GBIFSearchParams = {
      hasCoordinate,
      limit,
    };

    // Use taxonKey for most precise filtering (preferred over scientificName)
    // taxonKey includes all child taxa, e.g. taxonKey for Quercus returns all Quercus species
    if (resolvedTaxonKey && resolverSource !== 'intent' && resolverSource !== 'intent-location') {
      searchParamsGBIF.taxonKey = resolvedTaxonKey;
      console.log(`[MAP-SEARCH] Using taxonKey=${resolvedTaxonKey} (${resolvedSpecies})`);
    } else if ((resolverSource === 'intent' || resolverSource === 'intent-location') && intentSearchQuery) {
      searchParamsGBIF.q = intentSearchQuery;
      console.log(`[MAP-SEARCH] Using intent query=${intentSearchQuery}`);
    } else if (resolvedSpecies && resolverSource !== 'raw') {
      searchParamsGBIF.scientificName = resolvedSpecies;
      console.log(`[MAP-SEARCH] Using scientificName=${resolvedSpecies}`);
    } else if (resolvedSpecies) {
      // Fallback: use q= for unresolved names but add kingdom filter
      searchParamsGBIF.q = resolvedSpecies;
    }

    if (resolvedCountry) searchParamsGBIF.country = resolvedCountry;
    if (basisOfRecord && basisOfRecord.length > 0) searchParamsGBIF.basisOfRecord = basisOfRecord.join(',');
    if (countries && countries.length > 0) searchParamsGBIF.country = countries.join(',');
    if (hasImage) searchParamsGBIF.mediaType = 'StillImage';
    if (!searchParamsGBIF.mediaType && intentQuery?.mediaType) searchParamsGBIF.mediaType = intentQuery.mediaType;

    if (bboxStr) {
      const [swLat, swLng, neLat, neLng] = bboxStr.split(',').map(Number);
      const bboxGeometry = buildGeometryFromBboxString(bboxStr);
      if (bboxGeometry) {
        searchParamsGBIF.geometry = bboxGeometry;
        delete searchParamsGBIF.country;
        if ([swLat, swLng, neLat, neLng].every((value) => Number.isFinite(value))) {
          suggestedBounds = {
            south: swLat,
            north: neLat,
            west: swLng,
            east: neLng,
          };
        }
        console.log(`[MAP-SEARCH] Using bbox geometry filter: ${bboxGeometry}`);
      }
    }

    // Apply geographic filter:
    // - For sub-national regions (small bbox): use WKT POLYGON geometry for precision
    // - For country-level locations (large bbox): keep the country filter (more precise than bbox rectangle)
    if (suggestedBounds && !searchParamsGBIF.geometry) {
      const { south: s, north: n, west: w, east: e } = suggestedBounds;
      const latSpan = n - s;
      const lngSpan = e - w;
      const isLargeBounds = latSpan > 4 && lngSpan > 4;
      // Prefer Nominatim scope when available so sub-country regions (e.g. Scotland)
      // keep geometry filtering even if their bbox is large.
      const useCountryFilter = Boolean(
        resolvedCountry && (
          suggestedBoundsScope === 'country' ||
          (suggestedBoundsScope === 'unknown' && isLargeBounds)
        )
      );
      if (!useCountryFilter) {
        searchParamsGBIF.geometry = `POLYGON((${w} ${s},${e} ${s},${e} ${n},${w} ${n},${w} ${s}))`;
        // Don't also filter by country when we have a precise geometry
        delete searchParamsGBIF.country;
        console.log(`[MAP-SEARCH] Using geometry filter: ${searchParamsGBIF.geometry}`);
      } else {
        console.log(`[MAP-SEARCH] Country-level scope (${suggestedBoundsScope}, ${latSpan.toFixed(1)}°×${lngSpan.toFixed(1)}°), using country=${resolvedCountry} instead of geometry`);
      }
    }

    if (dateStart && dateEnd) {
      const startYear = new Date(dateStart).getFullYear();
      const endYear = new Date(dateEnd).getFullYear();
      searchParamsGBIF.year = startYear === endYear ? startYear.toString() : `${startYear},${endYear}`;
    }

    console.log('[MAP-SEARCH] GET search parameters:', searchParamsGBIF);

    // Single GBIF call — client handles pagination progressively
    const result = await gbifClient.searchOccurrences({ ...searchParamsGBIF, limit: Math.min(limit, 300), offset });

    console.log(`[MAP-SEARCH] Fetched ${result.results.length} occurrences (offset: ${offset}, total: ${result.count})`);

    let validOccurrences = result.results.filter(
      (occurrence: GBIFOccurrence) =>
        occurrence.decimalLatitude &&
        occurrence.decimalLongitude &&
        Math.abs(occurrence.decimalLatitude) <= 90 &&
        Math.abs(occurrence.decimalLongitude) <= 180,
    );

    if (bboxStr) {
      const [swLat, swLng, neLat, neLng] = bboxStr.split(',').map(Number);
      if ([swLat, swLng, neLat, neLng].every((n) => !isNaN(n))) {
        validOccurrences = validOccurrences.filter((occ: GBIFOccurrence) => {
          const lat = occ.decimalLatitude;
          const lng = occ.decimalLongitude;
          if (typeof lat !== 'number' || typeof lng !== 'number') return false;
          const inLat = lat >= swLat && lat <= neLat;
          let inLng = false;
          if (swLng <= neLng) {
            inLng = lng >= swLng && lng <= neLng;
          } else {
            inLng = lng >= swLng || lng <= neLng;
          }
          return inLat && inLng;
        });
      }
    }

    if (intentQuery?.monthRange?.length) {
      validOccurrences = validOccurrences.filter((occ: GBIFOccurrence) =>
        matchesMonthRange(occ.eventDate, intentQuery.monthRange as number[]),
      );
      console.log(`[MAP-SEARCH] Intent month filter applied (${intentQuery.monthRange.join(',')}): ${validOccurrences.length} occurrences remain`);
    }

    if (resolverSource === 'intent' && validOccurrences.length > 1) {
      validOccurrences = [...validOccurrences].sort(
        (a, b) => scoreIntentOccurrence(b, intentQuery || {}) - scoreIntentOccurrence(a, intentQuery || {}),
      );
      console.log(`[MAP-SEARCH] Intent ranking applied to ${validOccurrences.length} occurrences`);
    }

    const strategyMessage = intentQuery?.strategyMessage
      ? `${intentQuery.strategyMessage}${geoContext === 'user-area' ? ' in your area' : ''}`
      : undefined;

    console.log(`[MAP-SEARCH] Valid occurrences: ${validOccurrences.length}`);

    // Fire-and-forget: log query for admin analytics
    const token = await getToken({ req: request as any, secret: process.env.AUTH_SECRET }).catch(() => null);
    logSearchQuery({
      query: species || '',
      gbifParams: searchParamsGBIF,
      occurrences: validOccurrences.length,
      totalCount: result.count,
      resolvedName: resolvedSpecies,
      resolverSource,
      sessionId,
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown',
      userEmail: token?.email || undefined,
    });

    return NextResponse.json({
      success: true,
      data: {
        results: validOccurrences,
        count: result.count,
        endOfRecords: result.endOfRecords,
        totalFound: result.results.length,
        validCoordinates: validOccurrences.length,
        suggestedBounds,
        resolver: {
          originalQuery: species,
          resolvedName: resolvedSpecies,
          displayName: intentQuery?.displayName || resolvedSpecies,
          source: resolverSource,
          taxonRank: resolvedTaxonRank,
          country: resolvedCountry,
          areaName: resolvedAreaName,
          areaScope: suggestedBoundsScope,
          llmUsed,
          strategyMessage,
        },
      },
    });
  } catch (error) {
    console.error('[MAP-SEARCH] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error', data: null },
      { status: 500 },
    );
  }
}

// ─── QUERY LOGGING ───────────────────────────────────────────────────────────

function logSearchQuery(entry: {
  query: string;
  gbifParams: GBIFSearchParams;
  occurrences: number;
  totalCount: number;
  resolvedName?: string;
  resolverSource: string;
  sessionId?: string;
  ip: string;
  userEmail?: string;
}) {
  if (!SEARCH_LOGS_TABLE) return;
  const now = new Date().toISOString();
  const ttl = Math.floor(Date.now() / 1000) + 90 * 24 * 3600; // 90 days
  const item: Record<string, unknown> = {
    pk: 'LOG',
    timestamp: now,
    query: entry.query,
    gbifParams: JSON.stringify(entry.gbifParams),
    resolvedName: entry.resolvedName || '',
    resolverSource: entry.resolverSource,
    occurrences: entry.occurrences,
    totalCount: entry.totalCount,
    ip: entry.ip,
    ttl,
  };
  if (entry.sessionId) item.sessionId = entry.sessionId;
  if (entry.userEmail) item.userEmail = entry.userEmail;
  dynamoClient.send(new PutItemCommand({
    TableName: SEARCH_LOGS_TABLE,
    Item: marshall(item),
  })).catch(err => console.warn('[MAP-SEARCH] Log write failed:', err.message));
}

export async function POST(request: NextRequest) {
  return GET(request);
}
