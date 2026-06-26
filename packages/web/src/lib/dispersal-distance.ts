/**
 * Dispersal Distance Lookup — maximum seed/pollen dispersal by plant genus.
 *
 * Used to determine whether corridors between core areas are ecologically
 * viable for a given species. Distances in km.
 *
 * Sources: Vittoz & Engler 2007, Cain et al. 2000, Nathan et al. 2008
 */

export interface DispersalProfile {
  genus: string;
  /** Primary dispersal mechanism */
  mechanism: 'anemochory' | 'hydrochory' | 'zoochory' | 'barochory' | 'autochory';
  /** Typical dispersal distance in km */
  typicalDistanceKm: number;
  /** Maximum recorded/modeled dispersal distance in km */
  maxDistanceKm: number;
  /** Stepping stone spacing — max gap between suitable habitat patches in km */
  maxSteppingStoneGapKm: number;
}

/**
 * Default dispersal profile when genus is not in the lookup table.
 * Conservative estimate for typical temperate forest trees.
 */
const DEFAULT_PROFILE: DispersalProfile = {
  genus: 'default',
  mechanism: 'zoochory',
  typicalDistanceKm: 1,
  maxDistanceKm: 10,
  maxSteppingStoneGapKm: 5,
};

/**
 * Dispersal profiles for common plant genera.
 * maxDistanceKm is used to filter out corridors that exceed viable dispersal.
 * maxSteppingStoneGapKm determines max gap allowed between stepping stones.
 */
const DISPERSAL_TABLE: Record<string, DispersalProfile> = {
  // ─── ANEMOCHORY (wind dispersal) ─────────────
  Pinus: { genus: 'Pinus', mechanism: 'anemochory', typicalDistanceKm: 2, maxDistanceKm: 30, maxSteppingStoneGapKm: 10 },
  Picea: { genus: 'Picea', mechanism: 'anemochory', typicalDistanceKm: 0.5, maxDistanceKm: 10, maxSteppingStoneGapKm: 5 },
  Abies: { genus: 'Abies', mechanism: 'anemochory', typicalDistanceKm: 0.3, maxDistanceKm: 5, maxSteppingStoneGapKm: 3 },
  Betula: { genus: 'Betula', mechanism: 'anemochory', typicalDistanceKm: 1, maxDistanceKm: 20, maxSteppingStoneGapKm: 8 },
  Acer: { genus: 'Acer', mechanism: 'anemochory', typicalDistanceKm: 0.2, maxDistanceKm: 5, maxSteppingStoneGapKm: 3 },
  Fraxinus: { genus: 'Fraxinus', mechanism: 'anemochory', typicalDistanceKm: 0.3, maxDistanceKm: 8, maxSteppingStoneGapKm: 4 },
  Ulmus: { genus: 'Ulmus', mechanism: 'anemochory', typicalDistanceKm: 0.4, maxDistanceKm: 10, maxSteppingStoneGapKm: 5 },
  Populus: { genus: 'Populus', mechanism: 'anemochory', typicalDistanceKm: 5, maxDistanceKm: 50, maxSteppingStoneGapKm: 15 },
  Salix: { genus: 'Salix', mechanism: 'anemochory', typicalDistanceKm: 3, maxDistanceKm: 40, maxSteppingStoneGapKm: 12 },
  Taraxacum: { genus: 'Taraxacum', mechanism: 'anemochory', typicalDistanceKm: 2, maxDistanceKm: 100, maxSteppingStoneGapKm: 20 },
  Clematis: { genus: 'Clematis', mechanism: 'anemochory', typicalDistanceKm: 0.5, maxDistanceKm: 5, maxSteppingStoneGapKm: 3 },

  // ─── ZOOCHORY (animal dispersal — nuts, fruits) ─────────────
  Quercus: { genus: 'Quercus', mechanism: 'zoochory', typicalDistanceKm: 0.5, maxDistanceKm: 15, maxSteppingStoneGapKm: 5 },
  Fagus: { genus: 'Fagus', mechanism: 'zoochory', typicalDistanceKm: 0.3, maxDistanceKm: 8, maxSteppingStoneGapKm: 4 },
  Castanea: { genus: 'Castanea', mechanism: 'zoochory', typicalDistanceKm: 0.5, maxDistanceKm: 10, maxSteppingStoneGapKm: 5 },
  Corylus: { genus: 'Corylus', mechanism: 'zoochory', typicalDistanceKm: 0.3, maxDistanceKm: 5, maxSteppingStoneGapKm: 3 },
  Juglans: { genus: 'Juglans', mechanism: 'zoochory', typicalDistanceKm: 0.5, maxDistanceKm: 8, maxSteppingStoneGapKm: 4 },
  Prunus: { genus: 'Prunus', mechanism: 'zoochory', typicalDistanceKm: 1, maxDistanceKm: 15, maxSteppingStoneGapKm: 6 },
  Rubus: { genus: 'Rubus', mechanism: 'zoochory', typicalDistanceKm: 2, maxDistanceKm: 20, maxSteppingStoneGapKm: 8 },
  Rosa: { genus: 'Rosa', mechanism: 'zoochory', typicalDistanceKm: 1, maxDistanceKm: 15, maxSteppingStoneGapKm: 6 },
  Sorbus: { genus: 'Sorbus', mechanism: 'zoochory', typicalDistanceKm: 2, maxDistanceKm: 20, maxSteppingStoneGapKm: 8 },
  Crataegus: { genus: 'Crataegus', mechanism: 'zoochory', typicalDistanceKm: 1, maxDistanceKm: 15, maxSteppingStoneGapKm: 6 },
  Viscum: { genus: 'Viscum', mechanism: 'zoochory', typicalDistanceKm: 1, maxDistanceKm: 10, maxSteppingStoneGapKm: 5 },
  Ilex: { genus: 'Ilex', mechanism: 'zoochory', typicalDistanceKm: 2, maxDistanceKm: 20, maxSteppingStoneGapKm: 8 },
  Sambucus: { genus: 'Sambucus', mechanism: 'zoochory', typicalDistanceKm: 3, maxDistanceKm: 25, maxSteppingStoneGapKm: 10 },
  Taxus: { genus: 'Taxus', mechanism: 'zoochory', typicalDistanceKm: 1, maxDistanceKm: 10, maxSteppingStoneGapKm: 5 },
  Juniperus: { genus: 'Juniperus', mechanism: 'zoochory', typicalDistanceKm: 2, maxDistanceKm: 20, maxSteppingStoneGapKm: 8 },

  // ─── HYDROCHORY (water dispersal) ─────────────
  Alnus: { genus: 'Alnus', mechanism: 'hydrochory', typicalDistanceKm: 5, maxDistanceKm: 100, maxSteppingStoneGapKm: 20 },
  Carex: { genus: 'Carex', mechanism: 'hydrochory', typicalDistanceKm: 3, maxDistanceKm: 50, maxSteppingStoneGapKm: 15 },
  Phragmites: { genus: 'Phragmites', mechanism: 'hydrochory', typicalDistanceKm: 10, maxDistanceKm: 200, maxSteppingStoneGapKm: 30 },

  // ─── BAROCHORY (gravity dispersal — heavy seeds) ─────────────
  Aesculus: { genus: 'Aesculus', mechanism: 'barochory', typicalDistanceKm: 0.05, maxDistanceKm: 2, maxSteppingStoneGapKm: 1 },
  Tilia: { genus: 'Tilia', mechanism: 'anemochory', typicalDistanceKm: 0.2, maxDistanceKm: 5, maxSteppingStoneGapKm: 3 },

  // ─── ORCHIDS (tiny wind-dispersed seeds, extreme range) ─────────────
  Orchis: { genus: 'Orchis', mechanism: 'anemochory', typicalDistanceKm: 0.1, maxDistanceKm: 200, maxSteppingStoneGapKm: 5 },
  Ophrys: { genus: 'Ophrys', mechanism: 'anemochory', typicalDistanceKm: 0.1, maxDistanceKm: 100, maxSteppingStoneGapKm: 5 },
  Dactylorhiza: { genus: 'Dactylorhiza', mechanism: 'anemochory', typicalDistanceKm: 0.1, maxDistanceKm: 150, maxSteppingStoneGapKm: 5 },
};

/**
 * Get the dispersal profile for a genus.
 * Returns default conservative profile if genus is not in the table.
 */
export function getDispersalProfile(genus: string | undefined): DispersalProfile {
  if (!genus) return DEFAULT_PROFILE;
  return DISPERSAL_TABLE[genus] || DEFAULT_PROFILE;
}

/**
 * Check if a corridor length is viable for the given genus.
 * Returns a viability rating.
 */
export function assessCorridorViability(
  lengthKm: number,
  genus: string | undefined,
): { viable: boolean; rating: 'optimal' | 'feasible' | 'marginal' | 'unlikely'; reason: string } {
  const profile = getDispersalProfile(genus);

  if (lengthKm <= profile.typicalDistanceKm) {
    return { viable: true, rating: 'optimal', reason: `Within typical dispersal range (${profile.typicalDistanceKm} km) for ${profile.genus}` };
  }
  if (lengthKm <= profile.maxDistanceKm * 0.5) {
    return { viable: true, rating: 'feasible', reason: `Within feasible dispersal range for ${profile.genus} (${profile.mechanism})` };
  }
  if (lengthKm <= profile.maxDistanceKm) {
    return { viable: true, rating: 'marginal', reason: `Near max dispersal limit (${profile.maxDistanceKm} km). Stepping stones required.` };
  }
  return { viable: false, rating: 'unlikely', reason: `Exceeds max dispersal distance (${profile.maxDistanceKm} km) for ${profile.genus}` };
}

/**
 * Get all available genera in the lookup table.
 */
export function getAvailableGenera(): string[] {
  return Object.keys(DISPERSAL_TABLE);
}
