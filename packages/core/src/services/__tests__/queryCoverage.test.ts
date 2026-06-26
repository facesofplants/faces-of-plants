import { describe, expect, it } from 'vitest';

import { buildTaxonomyCandidates, isLikelyLocationOnlyQuery, splitPlantAndLocation } from '../query-coverage';

describe('query coverage taxonomy precedence', () => {
  it('builds leading taxonomy candidates from the full phrase', () => {
    expect(buildTaxonomyCandidates('Betulla bianca')).toEqual([
      'betulla bianca',
      'betulla',
    ]);
  });

  it('does not classify vernacular plant phrases as location-only queries', () => {
    expect(isLikelyLocationOnlyQuery('Betulla bianca')).toBe(false);
  });

  it('preserves explicit location splitting for plant-first phrases', () => {
    expect(splitPlantAndLocation('Betulla bianca in Lombardia')).toEqual({
      plantPart: 'Betulla bianca',
      locationPart: 'Lombardia',
    });
  });
});