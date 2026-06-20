import { LLMClient } from '../../core/src/services/llm';

export const handler = async (event: any): Promise<any> => {
  try {
    const { query, userType } = JSON.parse(event.body || '{}');

    const provider = process.env.LLM_PROVIDER || 'mistral';
    const apiKey = process.env.LLM_API_KEY || '';
    const endpoint = process.env.LLM_ENDPOINT;
    const model = process.env.LLM_MODEL;

    if (!apiKey) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'LLM API key not configured' }),
      };
    }

    const client = new LLMClient(provider, apiKey, endpoint, model);
    const systemPrompt = `You are an AI assistant for "Faces of Plants", a biodiversity platform powered by GBIF data. The user is a ${userType}. Help them explore biodiversity data, answer questions about plants, and construct GBIF search queries.`;
    const result = await client.chat(systemPrompt, query);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        response: result.content,
        usage: result.usage,
      }),
    };
  } catch (error) {
    console.error('LLM Proxy error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};