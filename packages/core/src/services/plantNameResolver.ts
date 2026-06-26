/**
 * Plant Name Resolver
 *
 * Resolves common plant names to scientific names using:
 * 1. Local mapping of well-known common names
 * 2. GBIF species/match API as fallback
 *
 * This ensures queries like "Oak trees" are correctly resolved to "Quercus"
 * instead of being sent as raw text to the occurrence search.
 */

export interface ResolvedPlantName {
  scientificName: string;
  genus?: string;
  family?: string;
  taxonKey?: number;
  confidence: number;
  source: 'local' | 'gbif-match' | 'raw';
}

/**
 * Curated mapping of common plant names to their scientific equivalents.
 * Covers the most frequent natural-language queries.
 */
const COMMON_NAMES_MAP: Record<string, ResolvedPlantName> = {
  // Trees
  'oak': { scientificName: 'Quercus', genus: 'Quercus', family: 'Fagaceae', confidence: 1.0, source: 'local' },
  'oak tree': { scientificName: 'Quercus', genus: 'Quercus', family: 'Fagaceae', confidence: 1.0, source: 'local' },
  'oak trees': { scientificName: 'Quercus', genus: 'Quercus', family: 'Fagaceae', confidence: 1.0, source: 'local' },
  'quercia': { scientificName: 'Quercus', genus: 'Quercus', family: 'Fagaceae', confidence: 1.0, source: 'local' },
  'querce': { scientificName: 'Quercus', genus: 'Quercus', family: 'Fagaceae', confidence: 1.0, source: 'local' },
  'pine': { scientificName: 'Pinus', genus: 'Pinus', family: 'Pinaceae', confidence: 1.0, source: 'local' },
  'pine tree': { scientificName: 'Pinus', genus: 'Pinus', family: 'Pinaceae', confidence: 1.0, source: 'local' },
  'pine trees': { scientificName: 'Pinus', genus: 'Pinus', family: 'Pinaceae', confidence: 1.0, source: 'local' },
  'pino': { scientificName: 'Pinus', genus: 'Pinus', family: 'Pinaceae', confidence: 1.0, source: 'local' },
  'pini': { scientificName: 'Pinus', genus: 'Pinus', family: 'Pinaceae', confidence: 1.0, source: 'local' },
  'maple': { scientificName: 'Acer', genus: 'Acer', family: 'Sapindaceae', confidence: 1.0, source: 'local' },
  'maple tree': { scientificName: 'Acer', genus: 'Acer', family: 'Sapindaceae', confidence: 1.0, source: 'local' },
  'acero': { scientificName: 'Acer', genus: 'Acer', family: 'Sapindaceae', confidence: 1.0, source: 'local' },
  'aceri': { scientificName: 'Acer', genus: 'Acer', family: 'Sapindaceae', confidence: 1.0, source: 'local' },
  'birch': { scientificName: 'Betula', genus: 'Betula', family: 'Betulaceae', confidence: 1.0, source: 'local' },
  'betulla': { scientificName: 'Betula', genus: 'Betula', family: 'Betulaceae', confidence: 1.0, source: 'local' },
  'betulle': { scientificName: 'Betula', genus: 'Betula', family: 'Betulaceae', confidence: 1.0, source: 'local' },
  'willow': { scientificName: 'Salix', genus: 'Salix', family: 'Salicaceae', confidence: 1.0, source: 'local' },
  'salice': { scientificName: 'Salix', genus: 'Salix', family: 'Salicaceae', confidence: 1.0, source: 'local' },
  'salici': { scientificName: 'Salix', genus: 'Salix', family: 'Salicaceae', confidence: 1.0, source: 'local' },
  'beech': { scientificName: 'Fagus', genus: 'Fagus', family: 'Fagaceae', confidence: 1.0, source: 'local' },
  'faggio': { scientificName: 'Fagus', genus: 'Fagus', family: 'Fagaceae', confidence: 1.0, source: 'local' },
  'faggi': { scientificName: 'Fagus', genus: 'Fagus', family: 'Fagaceae', confidence: 1.0, source: 'local' },
  'elm': { scientificName: 'Ulmus', genus: 'Ulmus', family: 'Ulmaceae', confidence: 1.0, source: 'local' },
  'olmo': { scientificName: 'Ulmus', genus: 'Ulmus', family: 'Ulmaceae', confidence: 1.0, source: 'local' },
  'olmi': { scientificName: 'Ulmus', genus: 'Ulmus', family: 'Ulmaceae', confidence: 1.0, source: 'local' },
  'cedar': { scientificName: 'Cedrus', genus: 'Cedrus', family: 'Pinaceae', confidence: 1.0, source: 'local' },
  'cedro': { scientificName: 'Cedrus', genus: 'Cedrus', family: 'Pinaceae', confidence: 1.0, source: 'local' },
  'cedri': { scientificName: 'Cedrus', genus: 'Cedrus', family: 'Pinaceae', confidence: 1.0, source: 'local' },
  'cypress': { scientificName: 'Cupressus', genus: 'Cupressus', family: 'Cupressaceae', confidence: 1.0, source: 'local' },
  'cipresso': { scientificName: 'Cupressus', genus: 'Cupressus', family: 'Cupressaceae', confidence: 1.0, source: 'local' },
  'cipressi': { scientificName: 'Cupressus', genus: 'Cupressus', family: 'Cupressaceae', confidence: 1.0, source: 'local' },
  'olive': { scientificName: 'Olea europaea', genus: 'Olea', family: 'Oleaceae', confidence: 1.0, source: 'local' },
  'olive tree': { scientificName: 'Olea europaea', genus: 'Olea', family: 'Oleaceae', confidence: 1.0, source: 'local' },
  'olivo': { scientificName: 'Olea europaea', genus: 'Olea', family: 'Oleaceae', confidence: 1.0, source: 'local' },
  'ulivo': { scientificName: 'Olea europaea', genus: 'Olea', family: 'Oleaceae', confidence: 1.0, source: 'local' },
  'ulivi': { scientificName: 'Olea europaea', genus: 'Olea', family: 'Oleaceae', confidence: 1.0, source: 'local' },
  'castagno': { scientificName: 'Castanea', genus: 'Castanea', family: 'Fagaceae', confidence: 1.0, source: 'local' },
  'castagni': { scientificName: 'Castanea', genus: 'Castanea', family: 'Fagaceae', confidence: 1.0, source: 'local' },
  'chestnut': { scientificName: 'Castanea', genus: 'Castanea', family: 'Fagaceae', confidence: 1.0, source: 'local' },

  // Flowers
  'rose': { scientificName: 'Rosa', genus: 'Rosa', family: 'Rosaceae', confidence: 1.0, source: 'local' },
  'roses': { scientificName: 'Rosa', genus: 'Rosa', family: 'Rosaceae', confidence: 1.0, source: 'local' },
  'rose flowers': { scientificName: 'Rosa', genus: 'Rosa', family: 'Rosaceae', confidence: 1.0, source: 'local' },
  'rosa': { scientificName: 'Rosa', genus: 'Rosa', family: 'Rosaceae', confidence: 1.0, source: 'local' },
  'sunflower': { scientificName: 'Helianthus', genus: 'Helianthus', family: 'Asteraceae', confidence: 1.0, source: 'local' },
  'sunflowers': { scientificName: 'Helianthus', genus: 'Helianthus', family: 'Asteraceae', confidence: 1.0, source: 'local' },
  'girasole': { scientificName: 'Helianthus', genus: 'Helianthus', family: 'Asteraceae', confidence: 1.0, source: 'local' },
  'girasoli': { scientificName: 'Helianthus', genus: 'Helianthus', family: 'Asteraceae', confidence: 1.0, source: 'local' },
  'tulip': { scientificName: 'Tulipa', genus: 'Tulipa', family: 'Liliaceae', confidence: 1.0, source: 'local' },
  'tulips': { scientificName: 'Tulipa', genus: 'Tulipa', family: 'Liliaceae', confidence: 1.0, source: 'local' },
  'tulipano': { scientificName: 'Tulipa', genus: 'Tulipa', family: 'Liliaceae', confidence: 1.0, source: 'local' },
  'tulipani': { scientificName: 'Tulipa', genus: 'Tulipa', family: 'Liliaceae', confidence: 1.0, source: 'local' },
  'orchid': { scientificName: 'Orchidaceae', family: 'Orchidaceae', confidence: 1.0, source: 'local' },
  'orchids': { scientificName: 'Orchidaceae', family: 'Orchidaceae', confidence: 1.0, source: 'local' },
  'orchidea': { scientificName: 'Orchidaceae', family: 'Orchidaceae', confidence: 1.0, source: 'local' },
  'orchidee': { scientificName: 'Orchidaceae', family: 'Orchidaceae', confidence: 1.0, source: 'local' },
  'daisy': { scientificName: 'Bellis', genus: 'Bellis', family: 'Asteraceae', confidence: 1.0, source: 'local' },
  'daisies': { scientificName: 'Bellis', genus: 'Bellis', family: 'Asteraceae', confidence: 1.0, source: 'local' },
  'margherita': { scientificName: 'Bellis', genus: 'Bellis', family: 'Asteraceae', confidence: 1.0, source: 'local' },
  'margherite': { scientificName: 'Bellis', genus: 'Bellis', family: 'Asteraceae', confidence: 1.0, source: 'local' },
  'lavender': { scientificName: 'Lavandula', genus: 'Lavandula', family: 'Lamiaceae', confidence: 1.0, source: 'local' },
  'lavanda': { scientificName: 'Lavandula', genus: 'Lavandula', family: 'Lamiaceae', confidence: 1.0, source: 'local' },
  'lily': { scientificName: 'Lilium', genus: 'Lilium', family: 'Liliaceae', confidence: 1.0, source: 'local' },
  'lilies': { scientificName: 'Lilium', genus: 'Lilium', family: 'Liliaceae', confidence: 1.0, source: 'local' },
  'giglio': { scientificName: 'Lilium', genus: 'Lilium', family: 'Liliaceae', confidence: 1.0, source: 'local' },
  'gigli': { scientificName: 'Lilium', genus: 'Lilium', family: 'Liliaceae', confidence: 1.0, source: 'local' },
  'jasmine': { scientificName: 'Jasminum', genus: 'Jasminum', family: 'Oleaceae', confidence: 1.0, source: 'local' },
  'gelsomino': { scientificName: 'Jasminum', genus: 'Jasminum', family: 'Oleaceae', confidence: 1.0, source: 'local' },
  'poppy': { scientificName: 'Papaver', genus: 'Papaver', family: 'Papaveraceae', confidence: 1.0, source: 'local' },
  'poppies': { scientificName: 'Papaver', genus: 'Papaver', family: 'Papaveraceae', confidence: 1.0, source: 'local' },
  'papavero': { scientificName: 'Papaver', genus: 'Papaver', family: 'Papaveraceae', confidence: 1.0, source: 'local' },
  'papaveri': { scientificName: 'Papaver', genus: 'Papaver', family: 'Papaveraceae', confidence: 1.0, source: 'local' },
  'iris': { scientificName: 'Iris', genus: 'Iris', family: 'Iridaceae', confidence: 1.0, source: 'local' },
  'violet': { scientificName: 'Viola', genus: 'Viola', family: 'Violaceae', confidence: 1.0, source: 'local' },
  'violets': { scientificName: 'Viola', genus: 'Viola', family: 'Violaceae', confidence: 1.0, source: 'local' },
  'violetta': { scientificName: 'Viola', genus: 'Viola', family: 'Violaceae', confidence: 1.0, source: 'local' },
  'violette': { scientificName: 'Viola', genus: 'Viola', family: 'Violaceae', confidence: 1.0, source: 'local' },
  'cherry blossom': { scientificName: 'Prunus', genus: 'Prunus', family: 'Rosaceae', confidence: 1.0, source: 'local' },
  'cherry blossoms': { scientificName: 'Prunus', genus: 'Prunus', family: 'Rosaceae', confidence: 1.0, source: 'local' },
  'cherry tree': { scientificName: 'Prunus', genus: 'Prunus', family: 'Rosaceae', confidence: 1.0, source: 'local' },
  'magnolia': { scientificName: 'Magnolia', genus: 'Magnolia', family: 'Magnoliaceae', confidence: 1.0, source: 'local' },
  'hibiscus': { scientificName: 'Hibiscus', genus: 'Hibiscus', family: 'Malvaceae', confidence: 1.0, source: 'local' },
  'camellia': { scientificName: 'Camellia', genus: 'Camellia', family: 'Theaceae', confidence: 1.0, source: 'local' },
  'wisteria': { scientificName: 'Wisteria', genus: 'Wisteria', family: 'Fabaceae', confidence: 1.0, source: 'local' },
  'bamboo': { scientificName: 'Bambusoideae', family: 'Poaceae', confidence: 0.9, source: 'local' },
  'cactus': { scientificName: 'Cactaceae', family: 'Cactaceae', confidence: 1.0, source: 'local' },
  'fern': { scientificName: 'Polypodiopsida', confidence: 0.9, source: 'local' },
  'ferns': { scientificName: 'Polypodiopsida', confidence: 0.9, source: 'local' },
  'moss': { scientificName: 'Bryophyta', confidence: 0.9, source: 'local' },

  // Crops / common plants
  'wheat': { scientificName: 'Triticum', genus: 'Triticum', family: 'Poaceae', confidence: 1.0, source: 'local' },
  'corn': { scientificName: 'Zea mays', genus: 'Zea', family: 'Poaceae', confidence: 1.0, source: 'local' },
  'maize': { scientificName: 'Zea mays', genus: 'Zea', family: 'Poaceae', confidence: 1.0, source: 'local' },
  'rice': { scientificName: 'Oryza sativa', genus: 'Oryza', family: 'Poaceae', confidence: 1.0, source: 'local' },
  'tomato': { scientificName: 'Solanum lycopersicum', genus: 'Solanum', family: 'Solanaceae', confidence: 1.0, source: 'local' },
  'potato': { scientificName: 'Solanum tuberosum', genus: 'Solanum', family: 'Solanaceae', confidence: 1.0, source: 'local' },
};

/**
 * Extract country context from a natural language query.
 * Returns ISO 3166-1 alpha-2 code if found.
 */
const COUNTRY_MAP: Record<string, string> = {
  'italy': 'IT', 'italia': 'IT',
  'france': 'FR', 'francia': 'FR',
  'germany': 'DE', 'germania': 'DE',
  'spain': 'ES', 'spagna': 'ES',
  'portugal': 'PT',
  'uk': 'GB', 'united kingdom': 'GB', 'england': 'GB',
  'usa': 'US', 'united states': 'US', 'america': 'US',
  'canada': 'CA',
  'brazil': 'BR', 'brasile': 'BR',
  'australia': 'AU',
  'japan': 'JP', 'giappone': 'JP',
  'china': 'CN', 'cina': 'CN',
  'india': 'IN',
  'mexico': 'MX', 'messico': 'MX',
  'argentina': 'AR',
  'colombia': 'CO',
  'peru': 'PE',
  'chile': 'CL',
  'south africa': 'ZA',
  'kenya': 'KE',
  'greece': 'GR', 'grecia': 'GR',
  'turkey': 'TR', 'turchia': 'TR',
  'netherlands': 'NL', 'olanda': 'NL',
  'sweden': 'SE', 'svezia': 'SE',
  'norway': 'NO', 'norvegia': 'NO',
  'austria': 'AT',
  'switzerland': 'CH', 'svizzera': 'CH',
  'poland': 'PL', 'polonia': 'PL',
  'indonesia': 'ID',
  'new zealand': 'NZ',
  // Italian regions → IT
  'toscana': 'IT', 'tuscany': 'IT',
  'lombardia': 'IT', 'lombardy': 'IT',
  'piemonte': 'IT', 'piedmont': 'IT',
  'veneto': 'IT',
  'lazio': 'IT',
  'campania': 'IT',
  'sicilia': 'IT', 'sicily': 'IT',
  'sardegna': 'IT', 'sardinia': 'IT',
  'puglia': 'IT', 'apulia': 'IT',
  'calabria': 'IT',
  'liguria': 'IT',
  'emilia romagna': 'IT', 'emilia-romagna': 'IT',
  'friuli venezia giulia': 'IT',
  'trentino alto adige': 'IT', 'trentino': 'IT',
  'umbria': 'IT',
  'marche': 'IT',
  'abruzzo': 'IT',
  'basilicata': 'IT',
  'molise': 'IT',
  "valle d'aosta": 'IT',
  // French regions
  'provence': 'FR',
  'bretagne': 'FR', 'brittany': 'FR',
  'alsace': 'FR',
  'normandie': 'FR', 'normandy': 'FR',
  // Spanish regions
  'andalusia': 'ES', 'andalucia': 'ES',
  'catalonia': 'ES', 'catalogna': 'ES', 'cataluña': 'ES',
  // German regions
  'bavaria': 'DE', 'baviera': 'DE', 'bayern': 'DE',
  // UK regions
  'scotland': 'GB', 'scozia': 'GB',
  'wales': 'GB', 'galles': 'GB',
};

export interface ParsedQuery {
  plantName: ResolvedPlantName | null;
  country?: string;
  remainingText: string;
}

/**
 * Parse a natural language query to extract plant name and optional country/location.
 */
export function parseNaturalLanguageQuery(query: string): ParsedQuery {
  const normalized = query.toLowerCase().trim();

  // Try to extract country from query (e.g. "roses in Italy", "oak trees in France")
  let country: string | undefined;
  let plantPart = normalized;

  // Pattern: "X in Y", "X from Y", "X della Y", "X nel Y"
  const locationPattern = /\b(?:in|from|near|around|del|della|delle|dello|dei|degli|nel|nella|nelle|nello|nei|negli|di)\s+(.+)$/i;
  const locationMatch = normalized.match(locationPattern);
  if (locationMatch) {
    const locationText = locationMatch[1].trim();
    const countryCode = COUNTRY_MAP[locationText];
    if (countryCode) {
      country = countryCode;
      plantPart = normalized.replace(locationPattern, '').trim();
    }
  }

  // Try local mapping first
  const localMatch = COMMON_NAMES_MAP[plantPart];
  if (localMatch) {
    return { plantName: localMatch, country, remainingText: '' };
  }

  // Try partial match (e.g., "beautiful roses" → "roses")
  for (const [key, value] of Object.entries(COMMON_NAMES_MAP)) {
    if (plantPart.includes(key) && key.length >= 3) {
      return { plantName: value, country, remainingText: plantPart.replace(key, '').trim() };
    }
  }

  // No local match — return raw query for fallback to GBIF match or direct search
  return {
    plantName: null,
    country,
    remainingText: plantPart,
  };
}

/**
 * Resolve a plant name using GBIF's species/match endpoint.
 * This is more accurate than full-text search for known scientific or common names.
 */
export async function resolveViaGBIFMatch(name: string): Promise<ResolvedPlantName | null> {
  try {
    const params = new URLSearchParams({
      name,
      kingdom: 'Plantae',
      verbose: 'false',
    });

    const response = await fetch(`https://api.gbif.org/v1/species/match?${params.toString()}`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) return null;

    const data = await response.json();

    // Only accept high-confidence matches
    if (data.matchType === 'NONE' || data.confidence < 80) {
      return null;
    }

    // Ensure it's in Plantae kingdom
    if (data.kingdom && data.kingdom !== 'Plantae') {
      return null;
    }

    return {
      scientificName: data.canonicalName || data.scientificName || name,
      genus: data.genus,
      family: data.family,
      taxonKey: data.usageKey,
      confidence: data.confidence / 100,
      source: 'gbif-match',
    };
  } catch (error) {
    console.error('[PlantNameResolver] GBIF match failed:', error);
    return null;
  }
}

/**
 * Full resolution pipeline:
 * 1. Parse query for plant name + country
 * 2. If no local match, try GBIF species/match
 * 3. Return structured result
 */
export async function resolvePlantQuery(query: string): Promise<ParsedQuery> {
  const parsed = parseNaturalLanguageQuery(query);

  if (parsed.plantName) {
    console.log(`[PlantNameResolver] Local match: "${query}" → ${parsed.plantName.scientificName}`);
    return parsed;
  }

  // Try GBIF match for unresolved names
  if (parsed.remainingText) {
    const gbifMatch = await resolveViaGBIFMatch(parsed.remainingText);
    if (gbifMatch) {
      console.log(`[PlantNameResolver] GBIF match: "${parsed.remainingText}" → ${gbifMatch.scientificName}`);
      return { ...parsed, plantName: gbifMatch };
    }
  }

  // Last resort: return as raw query
  console.log(`[PlantNameResolver] No match found for "${query}", using raw text`);
  return {
    ...parsed,
    plantName: {
      scientificName: parsed.remainingText || query,
      confidence: 0.3,
      source: 'raw',
    },
  };
}
