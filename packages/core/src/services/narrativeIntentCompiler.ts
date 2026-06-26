/**
 * Narrative Intent Compiler
 *
 * Converts complex multi-criteria natural language queries into structured
 * NarrativeSearchIntent objects via LLM, enabling multi-taxon parallel retrieval.
 */

// ─── TYPES ───────────────────────────────────────────────────────────────────

export interface NarrativeSearchIntent {
  taxa: Array<{
    scientificName: string;
    rank: 'FAMILY' | 'GENUS' | 'SPECIES';
    confidence: number;
    reason: string;
  }>;
  traits: string[];
  geography: {
    type: 'user-area' | 'named-area' | 'habitat-implicit' | 'global';
    name?: string;
    country?: string;
    bbox?: { south: number; north: number; west: number; east: number };
  };
  season?: { months: number[]; label: string };
  visual?: { colors: string[]; mediaRequired: boolean };
  habitat?: string;
  explanation: string;
}

// ─── DETECTION ───────────────────────────────────────────────────────────────

/**
 * Heuristic to determine if a query is "narrative" (multi-criteria, exploratory)
 * vs. simple (single species or species+location).
 *
 * Narrative queries typically have:
 * - Adjectives/traits (colorful, drought-tolerant, medicinal, edible)
 * - Functional group nouns (flowers, trees, herbs, plants)
 * - Habitat/ecosystem references without a specific taxon
 * - Season references combined with non-specific taxa
 */
const NARRATIVE_INDICATORS = [
  // Trait/attribute adjectives
  /\b(?:colorful|colourful|drought[- ]tolerant|pollinator[- ]friendly|native|invasive|medicinal|edible|aromatic|shade[- ]tolerant|rare|hardy|evergreen|deciduous|fast[- ]growing|fragrant)\b/iu,
  // Italian traits
  /\b(?:colorat[oaie]|resistente alla siccità|amiche degli impollinatori|nativ[oaie]|invasiv[oaie]|medicinali?|commestibil[ie]|aromatich?[oaie]|rar[oaie]|sempreverd[ie]|profumat[oaie])\b/iu,
  // Generic functional groups (not a specific taxon)
  /\b(?:plants|flowers|trees|herbs|shrubs|grasses|vines|succulents)\b/iu,
  /\b(?:piante|fiori|alberi|erbe|arbusti|rampicanti|succulente)\b/iu,
  // Habitat references combined with plant terms
  /\b(?:meadow|forest|coast|mountain|desert|wetland|garden|urban|riverside)\b/iu,
  /\b(?:prato|bosco|costa|montagna|deserto|palude|giardino|urbano)\b/iu,
  // Season + plant combination
  /\b(?:spring|summer|autumn|fall|winter|primavera|estate|autunno|inverno)\b/iu,
  // Explicit multi-criteria markers
  /\b(?:for|with|that have|which are|suitable for|good for|best for)\b/iu,
  /\b(?:per|con|che hanno|adatt[oaie] a|buon[oaie] per|migliori per)\b/iu,
];

/**
 * Returns true if the query looks like a narrative/exploratory multi-criteria search
 * rather than a simple species lookup.
 */
export function isNarrativeQuery(query: string): boolean {
  const normalized = query.trim();
  // Must have at least 3 words to be narrative
  if (normalized.split(/\s+/).length < 3) return false;

  let indicatorCount = 0;
  for (const pattern of NARRATIVE_INDICATORS) {
    if (pattern.test(normalized)) {
      indicatorCount++;
      if (indicatorCount >= 2) return true;
    }
  }
  return false;
}

// ─── LLM PROMPT ──────────────────────────────────────────────────────────────

function buildNarrativeIntentPrompt(): string {
  return `You are a botanical search intent compiler for "Faces of Plants", a GBIF biodiversity platform.

TASK: Convert a natural language query (any language) into a structured JSON search plan with MULTIPLE candidate taxa.

OUTPUT: Return ONLY valid JSON matching this exact schema (no markdown, no explanation outside JSON):
{
  "taxa": [
    {
      "scientificName": "Latin genus or species name from GBIF Backbone",
      "rank": "FAMILY" | "GENUS" | "SPECIES",
      "confidence": 0.0-1.0,
      "reason": "Brief explanation why this taxon matches the query"
    }
  ],
  "traits": ["array of trait keywords extracted from query"],
  "geography": {
    "type": "user-area" | "named-area" | "habitat-implicit" | "global",
    "name": "location name or null",
    "country": "ISO 3166-1 alpha-2 or null",
    "bbox": { "south": num, "north": num, "west": num, "east": num } | null
  },
  "season": { "months": [3,4,5], "label": "spring" } | null,
  "visual": { "colors": ["red","yellow"], "mediaRequired": true } | null,
  "habitat": "habitat keyword or null",
  "explanation": "One-sentence description of what we're searching for"
}

═══ RULES ═══
1. TAXA: Provide 3-6 candidate taxa that best match ALL criteria in the query. Prefer genera over species when the query is broad. Each must exist in GBIF Backbone Taxonomy.
2. CONFIDENCE: Rate how well each taxon matches the FULL intent (not just being a plant). A Mediterranean drought-tolerant shrub scores higher than a random tropical tree for "drought-tolerant Mediterranean plants".
3. GEOGRAPHY:
   - "user-area": query says "near me", "my area", "vicino a me"
   - "named-area": explicit place name → provide bbox
   - "habitat-implicit": geography implied by habitat (e.g. "Mediterranean coasts" → bbox of Mediterranean)
   - "global": no geographic constraint
4. TRAITS: Extract functional/ecological attributes as keywords (drought-tolerant, pollinator-friendly, edible, medicinal, native, shade-tolerant, etc.)
5. SEASON: Map seasonal references to months (spring=3,4,5; summer=6,7,8; autumn=9,10,11; winter=12,1,2)
6. VISUAL: Extract color preferences and set mediaRequired=true if colors or visual appearance is mentioned.
7. EXPLANATION: Write a concise, user-facing sentence describing the search intent.

═══ EXAMPLES ═══

Query: "Show colorful flowers near me in spring"
{
  "taxa": [
    {"scientificName": "Papaver", "rank": "GENUS", "confidence": 0.85, "reason": "Colorful spring wildflower"},
    {"scientificName": "Tulipa", "rank": "GENUS", "confidence": 0.8, "reason": "Iconic colorful spring flower"},
    {"scientificName": "Crocus", "rank": "GENUS", "confidence": 0.8, "reason": "Early spring colorful flower"},
    {"scientificName": "Ranunculus", "rank": "GENUS", "confidence": 0.75, "reason": "Common colorful spring wildflower"},
    {"scientificName": "Primula", "rank": "GENUS", "confidence": 0.7, "reason": "Spring-blooming colorful genus"}
  ],
  "traits": ["colorful", "flowering"],
  "geography": {"type": "user-area"},
  "season": {"months": [3, 4, 5], "label": "spring"},
  "visual": {"colors": ["colorful"], "mediaRequired": true},
  "habitat": null,
  "explanation": "Colorful flowering plants observed in spring near your location"
}

Query: "Medicinal and edible herbs in mountain meadows"
{
  "taxa": [
    {"scientificName": "Thymus", "rank": "GENUS", "confidence": 0.9, "reason": "Medicinal and culinary herb of mountain meadows"},
    {"scientificName": "Achillea", "rank": "GENUS", "confidence": 0.85, "reason": "Traditional medicinal herb common in mountain grasslands"},
    {"scientificName": "Hypericum", "rank": "GENUS", "confidence": 0.8, "reason": "Well-known medicinal herb of open montane habitats"},
    {"scientificName": "Origanum", "rank": "GENUS", "confidence": 0.8, "reason": "Edible and medicinal herb of dry mountain meadows"},
    {"scientificName": "Gentiana", "rank": "GENUS", "confidence": 0.75, "reason": "Medicinal alpine/montane genus"}
  ],
  "traits": ["medicinal", "edible"],
  "geography": {"type": "habitat-implicit", "name": "mountain meadows"},
  "season": null,
  "visual": null,
  "habitat": "mountain meadow",
  "explanation": "Herbs with medicinal and edible uses found in mountain meadow habitats"
}

Query: "Piante resistenti alla siccità per coste mediterranee"
{
  "taxa": [
    {"scientificName": "Rosmarinus", "rank": "GENUS", "confidence": 0.9, "reason": "Arbusto mediterraneo molto resistente alla siccità"},
    {"scientificName": "Cistus", "rank": "GENUS", "confidence": 0.85, "reason": "Genere costiero mediterraneo adattato all'aridità"},
    {"scientificName": "Pistacia lentiscus", "rank": "SPECIES", "confidence": 0.85, "reason": "Specie costiera mediterranea estremamente resistente"},
    {"scientificName": "Nerium", "rank": "GENUS", "confidence": 0.8, "reason": "Resistente alla siccità, tipico del Mediterraneo"},
    {"scientificName": "Euphorbia", "rank": "GENUS", "confidence": 0.7, "reason": "Molte specie costiere mediterranee xerofile"}
  ],
  "traits": ["drought-tolerant", "native"],
  "geography": {"type": "named-area", "name": "Mediterranean coasts", "bbox": {"south": 30, "north": 46, "west": -6, "east": 36}},
  "season": null,
  "visual": null,
  "habitat": "coast",
  "explanation": "Drought-tolerant plants native to Mediterranean coastal areas"
}`;
}

// ─── COMPILER ────────────────────────────────────────────────────────────────

export interface LLMChatFn {
  chat(systemPrompt: string, userMessage: string): Promise<{ content: string }>;
}

/**
 * Compile a narrative query into a structured NarrativeSearchIntent via LLM.
 * Returns null if parsing fails (caller should fall back to existing pipeline).
 */
export async function compileNarrativeIntent(
  query: string,
  llm: LLMChatFn,
): Promise<NarrativeSearchIntent | null> {
  try {
    const systemPrompt = buildNarrativeIntentPrompt();
    const result = await llm.chat(systemPrompt, query);

    let content = result.content.trim();
    // Strip markdown code fences if present
    if (content.startsWith('```')) {
      content = content.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }

    const parsed = JSON.parse(content);

    // Validate minimum structure
    if (!parsed.taxa || !Array.isArray(parsed.taxa) || parsed.taxa.length === 0) {
      console.warn('[NarrativeIntent] LLM returned no taxa candidates');
      return null;
    }
    if (!parsed.explanation || typeof parsed.explanation !== 'string') {
      parsed.explanation = 'Searching for plants matching your criteria';
    }

    // Normalize and validate taxa
    const validTaxa = parsed.taxa
      .filter((t: any) => t.scientificName && typeof t.scientificName === 'string')
      .slice(0, 6) // Cap at 6 taxa
      .map((t: any) => ({
        scientificName: t.scientificName.trim(),
        rank: (['FAMILY', 'GENUS', 'SPECIES'].includes(t.rank) ? t.rank : 'GENUS') as 'FAMILY' | 'GENUS' | 'SPECIES',
        confidence: typeof t.confidence === 'number' ? Math.min(1, Math.max(0, t.confidence)) : 0.5,
        reason: typeof t.reason === 'string' ? t.reason : '',
      }));

    if (validTaxa.length === 0) return null;

    // Normalize geography
    const geography = parsed.geography && typeof parsed.geography === 'object'
      ? {
          type: (['user-area', 'named-area', 'habitat-implicit', 'global'].includes(parsed.geography.type)
            ? parsed.geography.type
            : 'global') as NarrativeSearchIntent['geography']['type'],
          name: parsed.geography.name || undefined,
          country: parsed.geography.country || undefined,
          bbox: parsed.geography.bbox && typeof parsed.geography.bbox === 'object'
            ? parsed.geography.bbox
            : undefined,
        }
      : { type: 'global' as const };

    const intent: NarrativeSearchIntent = {
      taxa: validTaxa,
      traits: Array.isArray(parsed.traits) ? parsed.traits.filter((t: any) => typeof t === 'string') : [],
      geography,
      season: parsed.season && Array.isArray(parsed.season.months) ? parsed.season : undefined,
      visual: parsed.visual && typeof parsed.visual === 'object' ? parsed.visual : undefined,
      habitat: typeof parsed.habitat === 'string' ? parsed.habitat : undefined,
      explanation: parsed.explanation,
    };

    console.log(`[NarrativeIntent] Compiled: ${intent.taxa.length} taxa, traits=[${intent.traits.join(',')}], geo=${intent.geography.type}`);
    return intent;
  } catch (err) {
    console.error('[NarrativeIntent] Compilation failed:', err instanceof Error ? err.message : err);
    return null;
  }
}
