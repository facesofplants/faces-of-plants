import { describe, expect, it } from 'vitest';

import { resolveLocalTaxonomy } from '../localTaxonomyResolver';

describe('resolveLocalTaxonomy', () => {
  it('matches exact family names from cache', () => {
    const match = resolveLocalTaxonomy('Rosaceae');

    expect(match).not.toBeNull();
    expect(match?.canonicalName).toBe('Rosaceae');
    expect(match?.rank).toBe('FAMILY');
    expect(match?.source).toBe('taxonomy-cache-exact');
  });

  it('matches exact genus names from cache', () => {
    const match = resolveLocalTaxonomy('Quercus');

    expect(match).not.toBeNull();
    expect(match?.canonicalName).toBe('Quercus');
    expect(match?.rank).toBe('GENUS');
    expect(match?.source).toBe('taxonomy-cache-exact');
  });

  it('supports fuzzy matching for small typos', () => {
    const match = resolveLocalTaxonomy('Rosacee');

    expect(match).not.toBeNull();
    expect(match?.canonicalName).toBe('Rosaceae');
    expect(match?.source).toBe('taxonomy-cache-fuzzy');
  });
});
