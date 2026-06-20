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
  "query": "search terms extracted from the user's request",
  "filters": {
    "hasCoordinate": true,
    "hasGeospatialIssue": false
  },
  "limit": number (20 for citizen, 100 for researcher)
}

Examples:
- "roses in Italy" → {"query": "Rosa", "filters": {"country": "IT", "hasCoordinate": true, "hasGeospatialIssue": false}, "limit": 20}
- "orchids with images" → {"query": "Orchidaceae", "filters": {"mediaType": "StillImage", "hasCoordinate": true, "hasGeospatialIssue": false}, "limit": 20}`;
}

export class LLMClient {
  private config: ProviderConfig;

  constructor(provider: string, apiKey: string, endpoint?: string, model?: string) {
    const defaults = PROVIDER_DEFAULTS[provider] || PROVIDER_DEFAULTS.openai;
    this.config = {
      apiKey,
      endpoint: endpoint || defaults.endpoint,
      model: model || defaults.model,
    };
  }

  async chat(systemPrompt: string, userMessage: string): Promise<LLMResponse> {
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

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LLM API error (${response.status}): ${errorText}`);
    }

    const data = await response.json() as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };

    return {
      content: data.choices?.[0]?.message?.content || '',
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
    const result = await this.chat(systemPrompt, query);

    try {
      return JSON.parse(result.content);
    } catch {
      console.warn('[LLMClient] Failed to parse LLM response as JSON, returning raw query');
      return {
        query,
        filters: { hasCoordinate: true, hasGeospatialIssue: false },
        limit: userType === 'researcher' ? 100 : 20,
      };
    }
  }
}