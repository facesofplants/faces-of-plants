import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';

import type { CachedTaxonomyEntry } from '@faces-of-plants/core/src/data/gbif-taxonomy-cache';

const SETTINGS_TABLE = process.env.SYSTEM_SETTINGS_TABLE || 'system-settings';
const CACHE_TTL_MS = 5 * 60_000;

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'eu-central-1' });

let runtimeCache: { expiresAt: number; entries: CachedTaxonomyEntry[] } | null = null;

type TaxonomyMeta = {
  generatedAt: string;
  totalEntries: number;
  countsByRank: Record<string, number>;
  chunkCount: number;
  chunkSize: number;
};

async function getSettingValue(key: string): Promise<string> {
  const result = await dynamoClient.send(
    new GetItemCommand({
      TableName: SETTINGS_TABLE,
      Key: { settingKey: { S: key } },
    }),
  );

  return result.Item?.settingValue?.S || '';
}

export async function getRuntimeTaxonomyEntries(): Promise<CachedTaxonomyEntry[] | null> {
  const now = Date.now();
  if (runtimeCache && runtimeCache.expiresAt > now) {
    return runtimeCache.entries;
  }

  try {
    const metaRaw = await getSettingValue('taxonomy:cache:meta');
    if (!metaRaw) return null;

    const meta = JSON.parse(metaRaw) as TaxonomyMeta;
    if (!meta.chunkCount || meta.chunkCount < 1) return null;

    const chunkKeys = Array.from({ length: meta.chunkCount }, (_, index) => `taxonomy:cache:chunk:${index}`);
    const chunkValues = await Promise.all(chunkKeys.map((key) => getSettingValue(key)));

    const entries = chunkValues
      .filter(Boolean)
      .flatMap((value) => JSON.parse(value) as CachedTaxonomyEntry[]);

    if (entries.length === 0) return null;

    runtimeCache = {
      entries,
      expiresAt: now + CACHE_TTL_MS,
    };

    return entries;
  } catch (error) {
    console.warn('[TAXONOMY-CACHE] Failed to load runtime taxonomy cache:', error instanceof Error ? error.message : error);
    return null;
  }
}
