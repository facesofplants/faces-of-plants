/**
 * SDM Engine — simplified Species Distribution Modeling.
 *
 * Uses WorldClim bioclimatic variables + GBIF occurrences
 * to predict current and future species habitat suitability.
 */

export interface WorldClimData {
  version: string;
  bounds: { south: number; north: number; west: number; east: number };
  resolution: number;
  rows: number;
  cols: number;
  bioclimLabels: Record<string, string>;
  futureShift: {
    temperatureShift: number;
    precipitationShift: number;
  };
  grid: number[][][]; // [row][col][bio1..bio19]
}

export interface OccurrenceWithBioclim {
  lat: number;
  lng: number;
  year?: number;
  bioclim: number[]; // 19 values
}

export interface BioclimStats {
  mean: number[];
  std: number[];
  min: number[];
  max: number[];
}

export interface SDMResult {
  current: GridCellSuitability[];
  future: GridCellSuitability[];
  stats: BioclimStats;
  rangeShift: {
    northwardShiftKm: number;
    suitableAreaCurrent: number;
    suitableAreaFuture: number;
    areaChange: number;
  };
}

export interface GridCellSuitability {
  lat: number;
  lng: number;
  suitability: number; // 0-100
}

/**
 * Extract bioclimatic values from WorldClim grid for a coordinate.
 */
export function extractBioclim(
  worldClim: WorldClimData,
  lat: number,
  lng: number,
): number[] | null {
  const { bounds, resolution, rows, cols, grid } = worldClim;

  // Convert lat/lng to grid indices
  const row = Math.floor((lat - bounds.south) / resolution);
  const col = Math.floor((lng - bounds.west) / resolution);

  if (row < 0 || row >= rows || col < 0 || col >= cols) {
    return null;
  }

  return grid[row]?.[col] || null;
}

/**
 * Calculate bioclimatic statistics from occurrence data.
 */
export function calculateBioclimStats(
  occurrences: OccurrenceWithBioclim[],
): BioclimStats {
  const n = occurrences.length;
  if (n === 0) {
    return {
      mean: new Array(19).fill(0),
      std: new Array(19).fill(1),
      min: new Array(19).fill(-Infinity),
      max: new Array(19).fill(Infinity),
    };
  }

  const mean = new Array(19).fill(0);
  const min = new Array(19).fill(Infinity);
  const max = new Array(19).fill(-Infinity);

  // Calculate mean and min/max
  for (const occ of occurrences) {
    for (let i = 0; i < 19; i++) {
      const val = occ.bioclim[i] || 0;
      mean[i] += val;
      if (val < min[i]) min[i] = val;
      if (val > max[i]) max[i] = val;
    }
  }

  for (let i = 0; i < 19; i++) {
    mean[i] /= n;
  }

  // Calculate standard deviation
  const std = new Array(19).fill(0);
  for (const occ of occurrences) {
    for (let i = 0; i < 19; i++) {
      const diff = (occ.bioclim[i] || 0) - mean[i];
      std[i] += diff * diff;
    }
  }

  for (let i = 0; i < 19; i++) {
    std[i] = Math.sqrt(std[i] / n) || 1; // Avoid division by zero
  }

  return { mean, std, min, max };
}

/**
 * Calculate suitability score for a grid cell.
 * Uses a simplified MaxEnt-like approach: percentage of BIO variables
 * within 1 standard deviation of the species' occurrence mean.
 */
function calculateSuitability(
  cellBioclim: number[],
  stats: BioclimStats,
  weights?: number[],
): number {
  const defaultWeights = [
    1.5,  // BIO1: Annual Mean Temperature (most important)
    0.5,  // BIO2: Mean Diurnal Range
    0.3,  // BIO3: Isothermality
    0.5,  // BIO4: Temperature Seasonality
    1.0,  // BIO5: Max Temperature
    1.0,  // BIO6: Min Temperature
    0.5,  // BIO7: Temperature Annual Range
    0.3,  // BIO8: Mean Temp Wettest Quarter
    0.3,  // BIO9: Mean Temp Driest Quarter
    0.3,  // BIO10: Mean Temp Warmest Quarter
    0.3,  // BIO11: Mean Temp Coldest Quarter
    1.0,  // BIO12: Annual Precipitation (important)
    0.5,  // BIO13: Precipitation Wettest Month
    0.5,  // BIO14: Precipitation Driest Month
    0.3,  // BIO15: Precipitation Seasonality
    0.3,  // BIO16: Precipitation Wettest Quarter
    0.3,  // BIO17: Precipitation Driest Quarter
    0.3,  // BIO18: Precipitation Warmest Quarter
    0.3,  // BIO19: Precipitation Coldest Quarter
  ];

  const w = weights || defaultWeights;
  let totalScore = 0;
  let totalWeight = 0;

  for (let i = 0; i < 19; i++) {
    const val = cellBioclim[i] || 0;
    const mean = stats.mean[i];
    const std = stats.std[i];

    // Score: how close is this value to the species' optimal range?
    // Using a Gaussian-like function
    const zScore = Math.abs(val - mean) / std;
    const score = Math.exp(-0.5 * zScore * zScore) * 100;

    totalScore += score * w[i];
    totalWeight += w[i];
  }

  return totalScore / totalWeight;
}

/**
 * Run simplified SDM for a species.
 *
 * @param worldClim - WorldClim bioclimatic data
 * @param occurrences - Species occurrences with bioclim values
 * @param threshold - Suitability threshold (0-100) for presence
 * @returns SDM result with current/future predictions
 */
export function runSDM(
  worldClim: WorldClimData,
  occurrences: OccurrenceWithBioclim[],
  threshold: number = 40,
): SDMResult {
  // Calculate species' bioclimatic niche
  const stats = calculateBioclimStats(occurrences);

  const current: GridCellSuitability[] = [];
  const future: GridCellSuitability[] = [];

  const { bounds, resolution, rows, cols, grid, futureShift } = worldClim;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const bioclim = grid[r]?.[c];
      if (!bioclim) continue;

      const lat = bounds.south + r * resolution + resolution / 2;
      const lng = bounds.west + c * resolution + resolution / 2;

      // Current suitability
      const currentSuitability = calculateSuitability(bioclim, stats);
      if (currentSuitability >= threshold) {
        current.push({ lat, lng, suitability: currentSuitability });
      }

      // Future suitability (apply climate shift)
      const futureBioclim = bioclim.map((val, i) => {
        // Temperature variables (BIO1-BIO11): shift by temperatureShift
        if (i < 11) {
          return val + futureShift.temperatureShift * 10; // Convert °C to WorldClim units
        }
        // Precipitation variables (BIO12-BIO19): multiply by precipitationShift
        return Math.round(val * futureShift.precipitationShift);
      });

      const futureSuitability = calculateSuitability(futureBioclim, stats);
      if (futureSuitability >= threshold) {
        future.push({ lat, lng, suitability: futureSuitability });
      }
    }
  }

  // Calculate range shift metrics
  const avgLatCurrent = current.length > 0
    ? current.reduce((sum, c) => sum + c.lat, 0) / current.length
    : 0;
  const avgLatFuture = future.length > 0
    ? future.reduce((sum, c) => sum + c.lat, 0) / future.length
    : 0;
  const northwardShiftKm = (avgLatFuture - avgLatCurrent) * 111;

  return {
    current,
    future,
    stats,
    rangeShift: {
      northwardShiftKm,
      suitableAreaCurrent: current.length * resolution * 111 * resolution * 111,
      suitableAreaFuture: future.length * resolution * 111 * resolution * 111,
      areaChange: current.length > 0
        ? ((future.length - current.length) / current.length) * 100
        : 0,
    },
  };
}
