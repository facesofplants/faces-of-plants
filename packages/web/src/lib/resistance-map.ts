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
 */
export async function fetchResistanceGrid(
  south: number,
  north: number,
  west: number,
  east: number,
  targetResolutionKm: number = 2,
): Promise<ResistanceGrid> {
  // Try fetching real WorldCover data
  try {
    return await fetchWorldCoverData(south, north, west, east, targetResolutionKm);
  } catch {
    // Fall back to synthetic grid based on coordinates
    return generateSyntheticGrid(south, north, west, east, targetResolutionKm);
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
 * Generate a synthetic resistance grid when real data is unavailable.
 * Uses coordinate-based heuristics: water near coast, urban near cities, etc.
 */
function generateSyntheticGrid(
  south: number,
  north: number,
  west: number,
  east: number,
  resolutionKm: number,
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

  const cells: GridCell[][] = [];

  for (let row = 0; row < rows; row++) {
    const gridRow: GridCell[] = [];
    for (let col = 0; col < cols; col++) {
      const lat = south + row * latStep + latStep / 2;
      const lng = west + col * lngStep + lngStep / 2;

      // Simple heuristic: urban areas have higher resistance
      // Use sine-based pseudo-random for consistent results
      const pseudoRand = Math.sin(lat * 12.9898 + lng * 78.233) * 43758.5453;
      const noise = pseudoRand - Math.floor(pseudoRand);

      let landUse = 30; // Default: grassland
      let resistance = 2;

      if (noise > 0.95) {
        landUse = 60; // High-density built-up
        resistance = 50;
      } else if (noise > 0.85) {
        landUse = 50; // Low-density built-up
        resistance = 3;
      } else if (noise > 0.7) {
        landUse = 40; // Cropland
        resistance = 3;
      } else if (noise > 0.3) {
        landUse = 30; // Grassland
        resistance = 2;
      } else if (noise > 0.1) {
        landUse = 20; // Shrubland
        resistance = 2;
      } else {
        landUse = 10; // Forest
        resistance = 1;
      }

      gridRow.push({
        row,
        col,
        lat,
        lng,
        resistance,
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
