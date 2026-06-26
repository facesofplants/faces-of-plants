import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';

const SETTINGS_CACHE_TTL_MS = 60_000;
const SETTINGS_TABLE = process.env.SYSTEM_SETTINGS_TABLE || 'system-settings';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'eu-central-1' });

const cache = new Map<string, { value: string; expiresAt: number }>();

async function getSystemSettingValue(key: string, bypassCache = false): Promise<string> {
  const now = Date.now();
  const cached = cache.get(key);
  if (!bypassCache && cached && cached.expiresAt > now) {
    return cached.value;
  }

  try {
    const result = await dynamoClient.send(
      new GetItemCommand({
        TableName: SETTINGS_TABLE,
        Key: { settingKey: { S: key } },
      }),
    );

    const value = result.Item?.settingValue?.S || '';
    cache.set(key, { value, expiresAt: now + SETTINGS_CACHE_TTL_MS });
    return value;
  } catch (error) {
    console.warn(`[SYSTEM-SETTINGS] Failed to load key "${key}":`, error instanceof Error ? error.message : error);
    return '';
  }
}

export async function getSystemSettings(
  keys: string[],
  options?: { bypassCache?: boolean },
): Promise<Record<string, string>> {
  const entries = await Promise.all(
    keys.map(async (key) => [key, await getSystemSettingValue(key, options?.bypassCache)] as const),
  );

  return Object.fromEntries(entries);
}
