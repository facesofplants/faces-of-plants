/**
 * Resistance Map — land-use data for ecological corridor analysis.
 *
 * Fetches real Copernicus/ESA WorldCover land-use data and maps it to
 * resistance values for least-cost path computation.
 *
 * Falls back to a simplified synthetic grid when API is unavailable.
 */

// Resistance values for land-use classes (Copernicus/ESA WorldCover)
export const LAND_USE_RESISTANCE: Record<number, number> = {
  10: 1,   // Trees (forest)
  20: 2,   // Shrubland
  30: 2,   // Grassland
  40: 3,   // Cropland
  50: 3,   // Built-up (low density)
  60: 50,  // Built-up (high density / road)
  70: 10,  // Snow/Ice
  80: 10,  // Water bodies
  90: 100, // Wetland (partial barrier)
  95: 100, // Mangroves
  100: 100, // Moss/Lichen
};

export const LAND_USE_LABELS: Record<number, string> = {
  10: 'Forest',
  20: 'Shrubland',
  30: 'Grassland',
  40: 'Cropland',
  50: 'Low-density built-up',
  60: 'High-density built-up',
  70: 'Snow/Ice',
  80: 'Water',
  90: 'Wetland',
  95: 'Mangroves',
  100: 'Moss/Lichen',
};

export interface GridCell {
  row: number;
  col: number;
  lat: number;
  lng: number;
  resistance: number;
  landUse: number;
}

export interface ResistanceGrid {
  cells: GridCell[][];
  bounds: {
    south: number;
    north: number;
    west: number;
    east: number;
  };
  resolution: number; // km per cell
  rows: number;
  cols: number;
}

/**
 * Fetch land-use data from ESA WorldCover API.
 * Returns a simplified resistance grid for the given bounds.
 * Uses occurrence density to improve corridors when real land-use is unavailable.
 */
export async function fetchResistanceGrid(
  south: number,
  north: number,
  west: number,
  east: number,
  targetResolutionKm: number = 2,
  occurrences?: Array<{ lat: number; lng: number }>,
): Promise<ResistanceGrid> {
  // Try fetching real WorldCover data
  try {
    return await fetchWorldCoverData(south, north, west, east, targetResolutionKm);
  } catch {
    // Fall back to occurrence-density-based grid
    return generateSyntheticGrid(south, north, west, east, targetResolutionKm, occurrences);
  }
}

/**
 * Fetch from ESA WorldCover 100m API.
 * https://worldcover2021.esa.int/
 */
async function fetchWorldCoverData(
  south: number,
  north: number,
  west: number,
  east: number,
  resolutionKm: number,
): Promise<ResistanceGrid> {
  // WorldCover 100m V2 API (mosaic)
  const bbox = `${west},${south},${east},${north}`;
  const url = `https://worldcover2021.esa.int/mosaic/2021/100m/rgb?bbox=${bbox}`;

  const response = await fetch(url, {
    headers: { Accept: 'image/png' },
  });

  if (!response.ok) {
    throw new Error(`WorldCover API returned ${response.status}`);
  }

  // Parse the land-use raster and build the grid
  const arrayBuffer = await response.arrayBuffer();
  return parseWorldCoverRaster(arrayBuffer, south, north, west, east, resolutionKm);
}

/**
 * Parse WorldCover PNG raster into a resistance grid.
 * WorldCover uses a palette: pixel value = land-use class ID.
 */
async function parseWorldCoverRaster(
  buffer: ArrayBuffer,
  south: number,
  north: number,
  west: number,
  east: number,
  resolutionKm: number,
): Promise<ResistanceGrid> {
  // Create an image from the PNG data
  const blob = new Blob([buffer], { type: 'image/png' });
  const url = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Canvas not supported'));
        return;
      }

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, img.width, img.height);
      URL.revokeObjectURL(url);

      const { data, width, height } = imageData;

      // Calculate grid dimensions
      const latRange = north - south;
      const lngRange = east - west;
      const latStep = latRange / height;
      const lngStep = lngRange / width;

      // Build grid
      const cells: GridCell[][] = [];

      for (let row = 0; row < height; row++) {
        const gridRow: GridCell[] = [];
        for (let col = 0; col < width; col++) {
          const idx = (row * width + col) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];

          // WorldEncode encodes class ID in R channel (for classes <= 255)
          const landUseClass = r;
          const resistance = LAND_USE_RESISTANCE[landUseClass] ?? 50;

          gridRow.push({
            row,
            col,
            lat: south + row * latStep + latStep / 2,
            lng: west + col * lngStep + lngStep / 2,
            resistance,
            landUse: landUseClass,
          });
        }
        cells.push(gridRow);
      }

      resolve({
        cells,
        bounds: { south, north, west, east },
        resolution: resolutionKm,
        rows: height,
        cols: width,
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load WorldCover image'));
    };

    img.src = url;
  });
}

/**
 * Generate a resistance grid incorporating occurrence density.
 * Areas with more observations get lower resistance (confirmed habitat).
 * This creates natural-looking corridors that route through known habitat patches.
 */
function generateSyntheticGrid(
  south: number,
  north: number,
  west: number,
  east: number,
  resolutionKm: number,
  occurrences?: Array<{ lat: number; lng: number }>,
): ResistanceGrid {
  const latRange = north - south;
  const lngRange = east - west;

  // Calculate grid size based on resolution
  const latKm = latRange * 111; // ~111 km per degree latitude
  const lngKm = lngRange * 111 * Math.cos(((south + north) / 2 * Math.PI) / 180);
  const rows = Math.max(10, Math.min(100, Math.ceil(latKm / resolutionKm)));
  const cols = Math.max(10, Math.min(100, Math.ceil(lngKm / resolutionKm)));

  const latStep = latRange / rows;
  const lngStep = lngRange / cols;

  // Pre-compute occurrence density per grid cell
  const densityGrid: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));
  if (occurrences && occurrences.length > 0) {
    for (const occ of occurrences) {
      const row = Math.floor((occ.lat - south) / latStep);
      const col = Math.floor((occ.lng - west) / lngStep);
      if (row >= 0 && row < rows && col >= 0 && col < cols) {
        densityGrid[row][col]++;
      }
    }
    // Gaussian blur the density to create smooth gradients (3x3 kernel)
    const blurred: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let sum = 0;
        let count = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
              sum += densityGrid[nr][nc];
              count++;
            }
          }
        }
        blurred[r][c] = sum / count;
      }
    }
    // Copy blurred back
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        densityGrid[r][c] = blurred[r][c];
      }
    }
  }

  // Find max density for normalization
  let maxDensity = 0;
  for (const row of densityGrid) {
    for (const val of row) {
      if (val > maxDensity) maxDensity = val;
    }
  }

  const cells: GridCell[][] = [];

  for (let row = 0; row < rows; row++) {
    const gridRow: GridCell[] = [];
    for (let col = 0; col < cols; col++) {
      const lat = south + row * latStep + latStep / 2;
      const lng = west + col * lngStep + lngStep / 2;

      // Base resistance from pseudo-random landscape
      const pseudoRand = Math.sin(lat * 12.9898 + lng * 78.233) * 43758.5453;
      const noise = pseudoRand - Math.floor(pseudoRand);

      let landUse = 30; // Default: grassland
      let resistance = 5; // Higher base resistance

      if (noise > 0.95) {
        landUse = 60;
        resistance = 50;
      } else if (noise > 0.85) {
        landUse = 50;
        resistance = 15;
      } else if (noise > 0.7) {
        landUse = 40;
        resistance = 8;
      } else if (noise > 0.3) {
        landUse = 30;
        resistance = 5;
      } else if (noise > 0.1) {
        landUse = 20;
        resistance = 3;
      } else {
        landUse = 10;
        resistance = 1;
      }

      // Reduce resistance based on occurrence density
      // High density = confirmed habitat = very low resistance
      if (maxDensity > 0) {
        const densityFactor = densityGrid[row][col] / maxDensity; // 0..1
        resistance = resistance * (1 - densityFactor * 0.9); // Up to 90% reduction
        if (densityFactor > 0.1) {
          landUse = 10; // Reclassify as forest/habitat
        }
      }

      gridRow.push({
        row,
        col,
        lat,
        lng,
        resistance: Math.max(0.1, resistance),
        landUse,
      });
    }
    cells.push(gridRow);
  }

  return {
    cells,
    bounds: { south, north, west, east },
    resolution: resolutionKm,
    rows,
    cols,
  };
}
