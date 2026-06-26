import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth-options';
import { deleteSetting, getSetting, upsertSetting } from '@/lib/settings';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function requireAdminSession(session: unknown): session is { user: { id?: string; userType?: string } } {
  return Boolean(session && typeof session === 'object' && (session as any)?.user?.userType === 'admin');
}

const GBIF_SPECIES_SEARCH_URL = 'https://api.gbif.org/v1/species/search';
const PLANTAE_KEY = 6;
const PAGE_SIZE = 1000;
const RANKS = ['PHYLUM', 'CLASS', 'ORDER', 'FAMILY', 'GENUS'] as const;
const CHUNK_SIZE = 500;

type CachedTaxonomyRank = (typeof RANKS)[number];

type CachedTaxonomyEntry = {
  key: number;
  canonicalName: string;
  rank: CachedTaxonomyRank;
  normalized: string;
};

function normalizeName(value: string): string {
  return value
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

async function fetchRankEntries(rank: CachedTaxonomyRank, userAgent?: string): Promise<CachedTaxonomyEntry[]> {
  let offset = 0;
  let endOfRecords = false;
  const entries: CachedTaxonomyEntry[] = [];

  while (!endOfRecords) {
    const query = new URLSearchParams({
      highertaxon_key: String(PLANTAE_KEY),
      rank,
      status: 'ACCEPTED',
      limit: String(PAGE_SIZE),
      offset: String(offset),
    });

    const response = await fetch(`${GBIF_SPECIES_SEARCH_URL}?${query.toString()}`, {
      headers: {
        Accept: 'application/json',
        ...(userAgent?.trim() ? { 'User-Agent': userAgent.trim() } : {}),
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`GBIF request failed for rank ${rank} at offset ${offset}: ${response.status} ${body}`);
    }

    const responseText = await response.text();
    let payload: any;
    try {
      payload = JSON.parse(responseText);
    } catch {
      const contentType = response.headers.get('content-type') || 'unknown';
      throw new Error(
        `GBIF non-JSON response for rank ${rank} at offset ${offset} (content-type: ${contentType})`,
      );
    }
    const results = Array.isArray(payload.results) ? payload.results : [];

    for (const item of results) {
      const canonicalName = item.canonicalName || item.scientificName;
      if (!canonicalName) continue;

      entries.push({
        key: item.nubKey || item.key,
        canonicalName,
        rank,
        normalized: normalizeName(canonicalName),
      });
    }

    endOfRecords = Boolean(payload.endOfRecords);
    offset += PAGE_SIZE;
  }

  return entries;
}

function chunkEntries(entries: CachedTaxonomyEntry[]): CachedTaxonomyEntry[][] {
  const chunks: CachedTaxonomyEntry[][] = [];
  for (let index = 0; index < entries.length; index += CHUNK_SIZE) {
    chunks.push(entries.slice(index, index + CHUNK_SIZE));
  }
  return chunks;
}

async function getCurrentSyncStatus() {
  const [lastRunAt, lastRunBy, lastStatus, lastError, lastSummary, metaSetting] = await Promise.all([
    getSetting('taxonomy:last_sync_at'),
    getSetting('taxonomy:last_sync_by'),
    getSetting('taxonomy:last_sync_status'),
    getSetting('taxonomy:last_sync_error'),
    getSetting('taxonomy:last_sync_summary'),
    getSetting('taxonomy:cache:meta'),
  ]);

  const cacheMeta = metaSetting?.settingValue ? JSON.parse(metaSetting.settingValue) : null;

  return {
    lastSyncAt: lastRunAt?.settingValue || null,
    lastSyncBy: lastRunBy?.settingValue || null,
    lastSyncStatus: lastStatus?.settingValue || 'never',
    lastSyncError: lastError?.settingValue || null,
    lastSyncSummary: lastSummary?.settingValue || null,
    cacheMeta,
  };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!requireAdminSession(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json(await getCurrentSyncStatus());
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!requireAdminSession(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date().toISOString();
  const userId = session.user.id || 'admin';

  try {
    const gbifUserAgentSetting = await getSetting('api:gbif_user_agent');
    const gbifUserAgent = gbifUserAgentSetting?.settingValue?.trim();

    const previousMeta = await getSetting('taxonomy:cache:meta');
    const previousChunkCount = previousMeta?.settingValue
      ? Number((JSON.parse(previousMeta.settingValue) as { chunkCount?: number }).chunkCount || 0)
      : 0;

    await upsertSetting({
      settingKey: 'taxonomy:last_sync_status',
      settingValue: 'running',
      category: 'system',
      updatedBy: userId,
    });

    const countsByRank: Record<string, number> = {};
    const allEntries: CachedTaxonomyEntry[] = [];

    for (const rank of RANKS) {
      const entries = await fetchRankEntries(rank, gbifUserAgent);
      countsByRank[rank] = entries.length;
      allEntries.push(...entries);
    }

    const dedupMap = new Map<string, CachedTaxonomyEntry>();
    for (const entry of allEntries) {
      dedupMap.set(`${entry.rank}:${entry.key}`, entry);
    }

    const dedupEntries = Array.from(dedupMap.values());
    const chunks = chunkEntries(dedupEntries);

    await Promise.all(
      chunks.map((chunk, index) =>
        upsertSetting({
          settingKey: `taxonomy:cache:chunk:${index}`,
          settingValue: JSON.stringify(chunk),
          category: 'system',
          description: `Taxonomy cache chunk ${index + 1}/${chunks.length}`,
          masked: false,
          updatedBy: userId,
        }),
      ),
    );

    if (previousChunkCount > chunks.length) {
      for (let index = chunks.length; index < previousChunkCount; index += 1) {
        await deleteSetting(`taxonomy:cache:chunk:${index}`);
      }
    }

    const meta = {
      generatedAt: now,
      highertaxonKey: PLANTAE_KEY,
      totalEntries: dedupEntries.length,
      countsByRank,
      chunkSize: CHUNK_SIZE,
      chunkCount: chunks.length,
    };

    const summary = `Entries: ${meta.totalEntries} | ${RANKS.map((rank) => `${rank}: ${countsByRank[rank] || 0}`).join(' | ')}`;

    await Promise.all([
      upsertSetting({
        settingKey: 'taxonomy:cache:meta',
        settingValue: JSON.stringify(meta),
        category: 'system',
        description: 'Taxonomy cache metadata',
        masked: false,
        updatedBy: userId,
      }),
      upsertSetting({
        settingKey: 'taxonomy:last_sync_at',
        settingValue: now,
        category: 'system',
        updatedBy: userId,
      }),
      upsertSetting({
        settingKey: 'taxonomy:last_sync_by',
        settingValue: userId,
        category: 'system',
        updatedBy: userId,
      }),
      upsertSetting({
        settingKey: 'taxonomy:last_sync_status',
        settingValue: 'ok',
        category: 'system',
        updatedBy: userId,
      }),
      upsertSetting({
        settingKey: 'taxonomy:last_sync_error',
        settingValue: '',
        category: 'system',
        updatedBy: userId,
      }),
      upsertSetting({
        settingKey: 'taxonomy:last_sync_summary',
        settingValue: summary,
        category: 'system',
        updatedBy: userId,
      }),
    ]);

    return NextResponse.json({
      success: true,
      status: 'ok',
      syncedAt: now,
      summary,
      cacheMeta: meta,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    try {
      await Promise.all([
        upsertSetting({
          settingKey: 'taxonomy:last_sync_at',
          settingValue: now,
          category: 'system',
          updatedBy: userId,
        }),
        upsertSetting({
          settingKey: 'taxonomy:last_sync_by',
          settingValue: userId,
          category: 'system',
          updatedBy: userId,
        }),
        upsertSetting({
          settingKey: 'taxonomy:last_sync_status',
          settingValue: 'error',
          category: 'system',
          updatedBy: userId,
        }),
        upsertSetting({
          settingKey: 'taxonomy:last_sync_error',
          settingValue: message,
          category: 'system',
          updatedBy: userId,
        }),
      ]);
    } catch (persistError) {
      console.error('[taxonomy-sync] failed to persist error status', persistError);
    }

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
