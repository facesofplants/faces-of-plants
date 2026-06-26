import { GBIF_TAXONOMY_CACHE, type CachedTaxonomyEntry, type CachedTaxonomyRank } from '../data/gbif-taxonomy-cache';
import { buildTaxonomyCandidates } from './query-coverage';

export interface LocalTaxonomyMatch {
  canonicalName: string;
  taxonKey: number;
  rank: CachedTaxonomyRank;
  source: 'taxonomy-cache-exact' | 'taxonomy-cache-prefix' | 'taxonomy-cache-fuzzy';
  matchedTerm: string;
}

const rankSpecificity: Record<CachedTaxonomyRank, number> = {
  PHYLUM: 1,
  CLASS: 2,
  ORDER: 3,
  FAMILY: 4,
  GENUS: 5,
};

function buildEntriesByNormalized(entries: CachedTaxonomyEntry[]): Map<string, CachedTaxonomyEntry[]> {
  const map = new Map<string, CachedTaxonomyEntry[]>();
  for (const entry of entries) {
    const list = map.get(entry.normalized);
    if (list) {
      list.push(entry);
    } else {
      map.set(entry.normalized, [entry]);
    }
  }
  return map;
}

function normalizeTaxonomyInput(value: string): string {
  return value
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function chooseMostSpecific(entries: CachedTaxonomyEntry[]): CachedTaxonomyEntry {
  return [...entries].sort((a, b) => rankSpecificity[b.rank] - rankSpecificity[a.rank])[0];
}

function getPrefixMatch(token: string, entries: CachedTaxonomyEntry[]): CachedTaxonomyEntry | null {
  if (token.length < 4) return null;

  let best: CachedTaxonomyEntry | null = null;
  for (const entry of entries) {
    if (!entry.normalized.startsWith(token)) continue;

    if (!best || rankSpecificity[entry.rank] > rankSpecificity[best.rank]) {
      best = entry;
    }
  }

  return best;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= b.length; j += 1) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[a.length][b.length];
}

function getFuzzyMatch(candidate: string, entries: CachedTaxonomyEntry[]): CachedTaxonomyEntry | null {
  if (candidate.length < 5) return null;

  let bestEntry: CachedTaxonomyEntry | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const entry of entries) {
    if (Math.abs(entry.normalized.length - candidate.length) > 2) continue;

    const distance = levenshtein(entry.normalized, candidate);
    if (distance > 2) continue;

    if (
      distance < bestDistance ||
      (distance === bestDistance && bestEntry && rankSpecificity[entry.rank] > rankSpecificity[bestEntry.rank])
    ) {
      bestDistance = distance;
      bestEntry = entry;
    }
  }

  return bestEntry;
}

export function resolveLocalTaxonomyFromEntries(
  input: string,
  entries: CachedTaxonomyEntry[],
): LocalTaxonomyMatch | null {
  const normalizedInput = normalizeTaxonomyInput(input);
  if (!normalizedInput) return null;

  const entriesByNormalized = buildEntriesByNormalized(entries);
  const candidates = buildTaxonomyCandidates(normalizedInput);
  for (const candidate of candidates) {
    const exactMatches = entriesByNormalized.get(candidate);
    if (exactMatches && exactMatches.length > 0) {
      const best = chooseMostSpecific(exactMatches);
      return {
        canonicalName: best.canonicalName,
        taxonKey: best.key,
        rank: best.rank,
        source: 'taxonomy-cache-exact',
        matchedTerm: candidate,
      };
    }
  }

  const firstToken = normalizedInput.split(/\s+/)[0];
  const prefixMatch = getPrefixMatch(firstToken, entries);
  if (prefixMatch) {
    return {
      canonicalName: prefixMatch.canonicalName,
      taxonKey: prefixMatch.key,
      rank: prefixMatch.rank,
      source: 'taxonomy-cache-prefix',
      matchedTerm: firstToken,
    };
  }

  for (const candidate of candidates) {
    const fuzzyMatch = getFuzzyMatch(candidate, entries);
    if (fuzzyMatch) {
      return {
        canonicalName: fuzzyMatch.canonicalName,
        taxonKey: fuzzyMatch.key,
        rank: fuzzyMatch.rank,
        source: 'taxonomy-cache-fuzzy',
        matchedTerm: candidate,
      };
    }
  }

  return null;
}

export function resolveLocalTaxonomy(input: string): LocalTaxonomyMatch | null {
  return resolveLocalTaxonomyFromEntries(input, GBIF_TAXONOMY_CACHE.entries);
}
