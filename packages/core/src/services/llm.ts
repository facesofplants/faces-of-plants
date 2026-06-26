export interface LLMRequest {
  query: string;
  userType: 'citizen' | 'researcher';
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

interface ProviderConfig {
  apiKey: string;
  endpoint: string;
  model: string;
}

const PROVIDER_DEFAULTS: Record<string, { endpoint: string; model: string }> = {
  openai: { endpoint: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  mistral: { endpoint: 'https://api.mistral.ai/v1', model: 'mistral-large-latest' },
};

function buildSystemPrompt(userType: string): string {
  return `You are an AI assistant for "Faces of Plants", a biodiversity platform powered by GBIF data. The user is a ${userType}.

Your task is to convert natural language queries into structured GBIF search parameters. Respond ONLY with valid JSON matching this schema:
{
  "scientificName": "the scientific/latin name of the plant (e.g. Quercus, Rosa, Helianthus)",
  "query": "fallback search terms if scientific name is unclear",
  "filters": {
    "country": "ISO 3166-1 alpha-2 code if location mentioned (e.g. IT, FR, US)",
    "hasCoordinate": true,
    "hasGeospatialIssue": false
  },
  "limit": number (20 for citizen, 100 for researcher)
}

IMPORTANT: Always convert common plant names to their scientific genus or species name:
- "oak trees" → scientificName: "Quercus"
- "roses" → scientificName: "Rosa"  
- "sunflowers" → scientificName: "Helianthus"
- "pine trees" → scientificName: "Pinus"
- "cherry blossoms" → scientificName: "Prunus"
- "orchids" → scientificName: "Orchidaceae"

If you're unsure of the scientific name, set scientificName to null and put the query in "query" field.`;
}

function buildGeoSearchPrompt(): string {
  return `You are a STRICT botanical name resolver for "Faces of Plants", a GBIF-powered biodiversity map used worldwide.

ROLE: Convert a user's natural language query (in ANY language) into EXACTLY one JSON object with plant scientific names and geographic bounds. You are NOT a chatbot. You produce ONLY structured data.

OUTPUT FORMAT — respond with NOTHING except valid JSON matching this schema:
{
  "scientificName": "REQUIRED: the accepted Latin scientific name (genus or binomial). Must exist in the GBIF Backbone Taxonomy.",
  "genus": "the genus name (e.g. 'Quercus')",
  "query": null,
  "country": "ISO 3166-1 alpha-2 code OR null",
  "boundingBox": { "south": number, "north": number, "west": number, "east": number } | null,
  "yearRange": null
}

═══ ABSOLUTE RULES (violations = failure) ═══
1. scientificName MUST be a real taxonomic name from GBIF Backbone. NEVER invent names. NEVER guess.
2. If you cannot determine the plant with certainty, set scientificName to null and put the original text in "query".
3. NEVER return a plant that does not match what the user asked. The resolved name MUST correspond to the plant the user intended.
4. Common/vernacular names in ANY language must be converted to their CORRECT scientific equivalent. When in doubt, prefer genus-level.
5. DO NOT add extra text, explanations, markdown, or code fences. Output raw JSON only.
6. You must handle singulars, plurals, and regional variants in all languages.

═══ MULTILINGUAL PLANT NAME EXAMPLES ═══
English: "oaks"→Quercus, "cherry trees"→Prunus, "sunflowers"→Helianthus, "pines"→Pinus, "orchids"→Orchidaceae, "maples"→Acer, "ferns"→Polypodiopsida, "willows"→Salix, "birches"→Betula
Spanish: "robles/encinas"→Quercus, "cerezos"→Prunus, "girasoles"→Helianthus, "pinos"→Pinus, "olivos"→Olea, "castaños"→Castanea, "abedules"→Betula
French: "chênes"→Quercus, "cerisiers"→Prunus, "tournesols"→Helianthus, "pins"→Pinus, "oliviers"→Olea, "érables"→Acer, "bouleaux"→Betula
German: "Eichen"→Quercus, "Kirschen"→Prunus, "Kiefern"→Pinus, "Buchen"→Fagus, "Birken"→Betula, "Ahorne"→Acer
Italian: "querce/quercia"→Quercus, "ciliegi/ciliegio"→Prunus, "castagni/castagno"→Castanea, "pini/pino"→Pinus, "ulivi/olivo"→Olea, "faggi/faggio"→Fagus
Portuguese: "carvalhos"→Quercus, "cerejeiras"→Prunus, "pinheiros"→Pinus, "oliveiras"→Olea, "castanheiros"→Castanea
Hindi: "पीपल"→Ficus religiosa, "नीम"→Azadirachta indica, "बरगद"→Ficus benghalensis, "आम"→Mangifera indica, "अशोक"→Saraca asoca
Chinese: "橡树"→Quercus, "樱花/樱桃"→Prunus, "松树"→Pinus, "竹子"→Bambusoideae, "银杏"→Ginkgo, "荷花"→Nelumbo
Japanese: "桜"→Prunus, "松"→Pinus, "竹"→Bambusoideae, "梅"→Prunus mume, "楓"→Acer
Arabic: "زيتون"→Olea, "نخيل"→Arecaceae, "سنديان"→Quercus

═══ GEOGRAPHIC RULES ═══
- Extract location from prepositions in any language: "in", "near", "from", "en", "dans", "del/della/di/nel", "在", "に", "في"
- Provide bounding box for regions/cities/areas. Use correct coordinates.
- If only country mentioned, set BOTH country AND boundingBox.
- If no location mentioned, set country=null and boundingBox=null.

═══ EXAMPLES (input → output) ═══
"oaks in Bavaria" → {"scientificName":"Quercus","genus":"Quercus","query":null,"country":"DE","boundingBox":{"south":47.3,"north":50.6,"west":9.0,"east":13.8},"yearRange":null}
"cerezos en Andalucía" → {"scientificName":"Prunus","genus":"Prunus","query":null,"country":"ES","boundingBox":{"south":36.0,"north":38.7,"west":-7.5,"east":-1.6},"yearRange":null}
"chênes dans le sud de la France" → {"scientificName":"Quercus","genus":"Quercus","query":null,"country":"FR","boundingBox":{"south":42.3,"north":44.5,"west":-1.8,"east":7.7},"yearRange":null}
"松树 在 云南" → {"scientificName":"Pinus","genus":"Pinus","query":null,"country":"CN","boundingBox":{"south":21.1,"north":29.2,"west":97.5,"east":106.2},"yearRange":null}
"Pinus sylvestris" → {"scientificName":"Pinus sylvestris","genus":"Pinus","query":null,"country":null,"boundingBox":null,"yearRange":null}
"नीम in India" → {"scientificName":"Azadirachta indica","genus":"Azadirachta","query":null,"country":"IN","boundingBox":{"south":6.7,"north":35.5,"west":68.1,"east":97.4},"yearRange":null}`;
}

export class LLMClient {
  private config: ProviderConfig;
  private provider: string;

  constructor(provider: string, apiKey: string, endpoint?: string, model?: string) {
    const defaults = PROVIDER_DEFAULTS[provider] || PROVIDER_DEFAULTS.openai;
    this.provider = provider;
    this.config = {
      apiKey,
      endpoint: endpoint || defaults.endpoint,
      model: model || defaults.model,
    };
  }

  /**
   * Check if the LLM client is properly configured (has API key)
   */
  isConfigured(): boolean {
    return Boolean(this.config.apiKey && this.config.apiKey.length > 0);
  }

  async chat(systemPrompt: string, userMessage: string): Promise<LLMResponse> {
    if (!this.isConfigured()) {
      throw new Error(`LLM not configured: missing API key for provider "${this.provider}"`);
    }

    const startTime = Date.now();
    console.log(`[LLMClient] Calling ${this.provider} (model: ${this.config.model})`);

    const response = await fetch(`${this.config.endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      }),
    });

    const elapsed = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[LLMClient] API error (${response.status}) after ${elapsed}ms: ${errorText}`);
      throw new Error(`LLM API error (${response.status}): ${errorText}`);
    }

    const data = await response.json() as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };

    const content = data.choices?.[0]?.message?.content || '';
    console.log(`[LLMClient] Response received in ${elapsed}ms (tokens: ${data.usage?.total_tokens || 'unknown'})`);

    return {
      content,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
    };
  }

  async convertQueryToSearchParams(query: string, userType: string): Promise<any> {
    const systemPrompt = buildSystemPrompt(userType);

    try {
      const result = await this.chat(systemPrompt, query);

      const parsed = JSON.parse(result.content);
      console.log(`[LLMClient] Parsed query "${query}" → scientificName: "${parsed.scientificName || parsed.query}"`);
      return parsed;
    } catch (error) {
      if (error instanceof SyntaxError) {
        console.warn(`[LLMClient] Failed to parse LLM response as JSON for query: "${query}"`);
      } else {
        console.error(`[LLMClient] Error converting query "${query}":`, error instanceof Error ? error.message : error);
      }

      // Structured fallback — don't silently swallow the error
      return {
        scientificName: null,
        query,
        filters: { hasCoordinate: true, hasGeospatialIssue: false },
        limit: userType === 'researcher' ? 100 : 20,
        _fallback: true,
        _error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async convertGeoQuery(query: string): Promise<GeoSearchResult> {
    const systemPrompt = buildGeoSearchPrompt();

    try {
      const result = await this.chat(systemPrompt, query);

      // Strip markdown code fences if present
      let content = result.content.trim();
      if (content.startsWith('```')) {
        content = content.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
      }

      const parsed = JSON.parse(content);
      console.log(`[LLMClient] Geo query "${query}" → scientificName: "${parsed.scientificName}", boundingBox: ${JSON.stringify(parsed.boundingBox)}`);
      return {
        scientificName: parsed.scientificName || null,
        genus: parsed.genus || null,
        query: parsed.query || null,
        country: parsed.country || null,
        boundingBox: parsed.boundingBox || null,
        yearRange: parsed.yearRange || null,
        _llmParsed: true,
      };
    } catch (error) {
      console.error(`[LLMClient] Error in convertGeoQuery for "${query}":`, error instanceof Error ? error.message : error);
      return {
        scientificName: null,
        genus: null,
        query,
        country: null,
        boundingBox: null,
        yearRange: null,
        _llmParsed: false,
        _error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

export interface GeoSearchResult {
  scientificName: string | null;
  genus: string | null;
  query: string | null;
  country: string | null;
  boundingBox: { south: number; north: number; west: number; east: number } | null;
  yearRange: { start: number; end: number } | null;
  _llmParsed?: boolean;
  _error?: string;
}

/**
 * Create an LLM client from environment variables.
 * Returns null if not configured (no API key).
 */
export function createLLMClientFromEnv(): LLMClient | null {
  const provider = process.env.LLM_PROVIDER || 'mistral';
  const apiKey = process.env.LLM_API_KEY || '';
  const endpoint = process.env.LLM_ENDPOINT;
  const model = process.env.LLM_MODEL;

  if (!apiKey) {
    console.warn('[LLMClient] No LLM_API_KEY configured — LLM features disabled');
    return null;
  }

  console.log(`[LLMClient] Initialized with provider: ${provider}, model: ${model || 'default'}`);
  return new LLMClient(provider, apiKey, endpoint, model);
}