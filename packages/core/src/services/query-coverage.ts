export const QUERY_CORRECTIONS: Record<string, string> = {
  'ginko biloba': 'Ginkgo biloba',
  tarassacl: 'tarassaco',
  taraxaxum: 'taraxacum',
};

const QUERY_TOKEN_CORRECTIONS: Record<string, string> = {
  ginko: 'ginkgo',
  tarassacl: 'tarassaco',
  taraxaxum: 'taraxacum',
  scotalnd: 'scotland',
};

export const QUERY_ALIASES: Record<string, { scientificName: string; genus?: string; rank?: string }> = {
  tarassaco: { scientificName: 'Taraxacum officinale', genus: 'Taraxacum', rank: 'SPECIES' },
  taraxacum: { scientificName: 'Taraxacum', genus: 'Taraxacum', rank: 'GENUS' },
  girasole: { scientificName: 'Helianthus annuus', genus: 'Helianthus', rank: 'SPECIES' },
  girasoli: { scientificName: 'Helianthus annuus', genus: 'Helianthus', rank: 'SPECIES' },
  sunflower: { scientificName: 'Helianthus annuus', genus: 'Helianthus', rank: 'SPECIES' },
  sunflowers: { scientificName: 'Helianthus annuus', genus: 'Helianthus', rank: 'SPECIES' },
  'oak tree': { scientificName: 'Quercus', genus: 'Quercus', rank: 'GENUS' },
  'oak trees': { scientificName: 'Quercus', genus: 'Quercus', rank: 'GENUS' },
  oak: { scientificName: 'Quercus', genus: 'Quercus', rank: 'GENUS' },
  oaks: { scientificName: 'Quercus', genus: 'Quercus', rank: 'GENUS' },
  quercia: { scientificName: 'Quercus', genus: 'Quercus', rank: 'GENUS' },
  querce: { scientificName: 'Quercus', genus: 'Quercus', rank: 'GENUS' },
  betulla: { scientificName: 'Betula', genus: 'Betula', rank: 'GENUS' },
  betulle: { scientificName: 'Betula', genus: 'Betula', rank: 'GENUS' },
  ciliegio: { scientificName: 'Prunus avium', genus: 'Prunus', rank: 'SPECIES' },
  ciliegi: { scientificName: 'Prunus avium', genus: 'Prunus', rank: 'SPECIES' },
  salice: { scientificName: 'Salix', genus: 'Salix', rank: 'GENUS' },
  salici: { scientificName: 'Salix', genus: 'Salix', rank: 'GENUS' },
  philodendron: { scientificName: 'Philodendron', genus: 'Philodendron', rank: 'GENUS' },
  'philodendron birkin': { scientificName: 'Philodendron', genus: 'Philodendron', rank: 'GENUS' },
  'papavero da oppio': { scientificName: 'Papaver somniferum', genus: 'Papaver', rank: 'SPECIES' },
};

const LOCATION_CONNECTORS = [
  'in', 'from', 'near', 'around', 'within', 'at', 'inside',
  'del', 'della', 'delle', 'dello', 'dei', 'nel', 'nella', 'nelle', 'di', 'a', 'ad', 'al', 'allo', 'alla', 'alle', 'ai', 'agli',
  'en', 'de', 'del', 'cerca', 'cerca de', 'alrededor',
  'dans', 'de', 'du', 'des', 'pres', 'pres de',
  'im', 'aus', 'nahe', 'bei',
  'em', 'de', 'do', 'da', 'perto',
];

const LOCATION_SPLIT_REGEX = new RegExp(
  `\\b(?:${LOCATION_CONNECTORS.map((token) => token.replace(/ /g, '\\s+')).join('|')})\\s+(.+)$`,
  'iu',
);

const INTENT_PATTERNS: RegExp[] = [
  /\b(?:flowers?|flowering|blooms?|blossoms?|fiori?|fioritura|flor(?:es)?|fleurs?|blumen)\b/iu,
  /\b(?:trees?|alberi|arbres?|arbol(?:es)?|baume|baume|baume|baume|baume|baume)\b/iu,
  /\b(?:leaf|leaves|foglia|foglie|hojas?|feuilles?|blatt|blatter)\b/iu,
  /\b(?:orchids?|orchidee|orquideas?|orchidees?)\b/iu,
  /\b(?:ferns?|felci|helechos?|fougeres?)\b/iu,
  /\b(?:moss(?:es)?|muschi|musgos?|mousses?)\b/iu,
  /\b(?:shrubs?|bushes|arbusti|arbusto|arbustes?|straucher)\b/iu,
  /\b(?:grasses|grass|graminacee|hierba|hierbas|graminees|graser)\b/iu,
  /\b(?:succulents?|suculente|suculentas?|plantes grasses)\b/iu,
  /\b(?:cacti|cactus|cactacee|cacto|cactos|kakteen)\b/iu,
  /\b(?:palms?|palme|palmeras?|palmiers?)\b/iu,
  /\b(?:vines?|climbers?|rampicanti|trepadoras?|lianes?)\b/iu,
  /\b(?:medicinal|medicinale|medicinali|medicinales|healing|curative|officinal)\b/iu,
  /\b(?:colorful|colourful|multicolor|variopint|variado|bunt|red|yellow|blue|purple|white|pink|orange|rosso|giallo|blu|viola)\b/iu,
  /\b(?:rainforest|forest|meadow|wetland|coast|mountain|desert|river|foresta|bosco|prato|palude|costa|montagna|deserto|fiume)\b/iu,
  /\b(?:spring|summer|autumn|fall|winter|primavera|estate|autunno|inverno|printemps|ete|automne|hiver)\b/iu,
];

const LOCATION_HINT_PATTERN = /\b(?:university|universita|universidad|universite|campus|park|parco|parque|city|town|village|village|region|regione|provincia|province|county|state|island|isola|islanda|mount|monte|lake|lago)\b/iu;
const PLANT_HINT_PATTERN = /\b(?:tree|trees|flower|flowers|plant|plants|oak|querc|ginkgo|girasol|sunflower|taraxacum|tarassaco|betula|betulla|salix|salice|cilieg|prunus|philodendron|papaver)\b/iu;

export type QueryCoverage = {
  typoMap: boolean;
  aliasMap: boolean;
  intent: boolean;
  locationOnlyFallback: boolean;
};

export function normalizeCoverageQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function applyQueryCorrection(query: string): string {
  const normalized = normalizeCoverageQuery(query);
  const fullCorrection = QUERY_CORRECTIONS[normalized];
  if (fullCorrection) return fullCorrection;

  let corrected = normalized;
  for (const [token, replacement] of Object.entries(QUERY_TOKEN_CORRECTIONS)) {
    corrected = corrected.replace(new RegExp(`\\b${token}\\b`, 'giu'), replacement);
  }

  return corrected === normalized ? query : corrected;
}

export function splitPlantAndLocation(query: string): { plantPart: string; locationPart: string | null } {
  const locationMatch = query.match(LOCATION_SPLIT_REGEX);
  if (!locationMatch) return { plantPart: query.trim(), locationPart: null };

  const locationPart = locationMatch[1].trim();
  const plantPart = query.slice(0, query.length - locationMatch[0].length).trim();
  return { plantPart: plantPart || query.trim(), locationPart };
}

export function buildTaxonomyCandidates(query: string): string[] {
  const normalized = normalizeCoverageQuery(query);
  if (!normalized) return [];

  const words = normalized.split(/\s+/).filter(Boolean);
  const candidates: string[] = [];

  for (let length = words.length; length >= 1; length -= 1) {
    const candidate = words.slice(0, length).join(' ');
    if (candidate && !candidates.includes(candidate)) {
      candidates.push(candidate);
    }
  }

  return candidates;
}

export function hasIntentSignal(query: string): boolean {
  return INTENT_PATTERNS.some((pattern) => pattern.test(query));
}

export function isLikelyLocationOnlyQuery(query: string): boolean {
  const normalized = normalizeCoverageQuery(query);
  const { plantPart, locationPart } = splitPlantAndLocation(normalized);
  const taxonomyCandidates = buildTaxonomyCandidates(plantPart || normalized);

  if (taxonomyCandidates.some((candidate) => QUERY_ALIASES[candidate] || PLANT_HINT_PATTERN.test(candidate))) {
    return false;
  }

  if (locationPart && !PLANT_HINT_PATTERN.test(plantPart)) return true;
  if (LOCATION_HINT_PATTERN.test(normalized) && !PLANT_HINT_PATTERN.test(normalized)) return true;

  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length >= 2 && words.length <= 4 && !PLANT_HINT_PATTERN.test(normalized) && !hasIntentSignal(normalized)) {
    return true;
  }

  return false;
}

export function analyzeQueryCoverage(query: string): QueryCoverage {
  const corrected = applyQueryCorrection(query);
  const normalizedOriginal = normalizeCoverageQuery(query);
  const normalizedCorrected = normalizeCoverageQuery(corrected);
  const aliasMap = Boolean(QUERY_ALIASES[normalizedOriginal] || QUERY_ALIASES[normalizedCorrected]);

  return {
    typoMap: normalizedOriginal !== normalizedCorrected,
    aliasMap,
    intent: hasIntentSignal(normalizedCorrected),
    locationOnlyFallback: isLikelyLocationOnlyQuery(normalizedCorrected),
  };
}
