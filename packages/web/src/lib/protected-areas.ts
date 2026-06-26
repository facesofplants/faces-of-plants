/**
 * Protected Areas — fetch official protected area boundaries from OpenStreetMap.
 *
 * Uses Overpass API to get boundary=protected_area polygons within a bounding box.
 * These serve as additional core areas in corridor analysis.
 */

export interface ProtectedArea {
  id: number;
  name: string;
  designationType: string; // e.g. "national_park", "nature_reserve"
  centroid: { lat: number; lng: number };
  boundingBox: { south: number; north: number; west: number; east: number };
  areaKm2?: number;
}

/**
 * Fetch protected areas from OSM Overpass API within the given bounds.
 * Returns parks, nature reserves, and other ecological protection areas.
 */
export async function fetchProtectedAreas(
  south: number,
  north: number,
  west: number,
  east: number,
): Promise<ProtectedArea[]> {
  const bbox = `${south},${west},${north},${east}`;

  // Query for protected areas (parks, reserves, etc.) in the bbox
  const query = `
[out:json][timeout:15];
(
  relation["boundary"="protected_area"](${bbox});
  way["boundary"="protected_area"](${bbox});
  relation["leisure"="nature_reserve"](${bbox});
  way["leisure"="nature_reserve"](${bbox});
);
out center tags;
`;

  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!res.ok) {
      console.warn(`[ProtectedAreas] Overpass API returned ${res.status}`);
      return [];
    }

    const data = await res.json();
    const elements: any[] = data.elements || [];

    const areas: ProtectedArea[] = [];
    const seen = new Set<string>();

    for (const el of elements) {
      const name = el.tags?.name || el.tags?.['name:en'] || el.tags?.['name:it'] || 'Unnamed';
      const key = `${name}-${el.center?.lat?.toFixed(3)}-${el.center?.lon?.toFixed(3)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const designationType = el.tags?.protect_class
        ? getDesignationFromProtectClass(el.tags.protect_class)
        : el.tags?.leisure === 'nature_reserve'
          ? 'nature_reserve'
          : el.tags?.boundary === 'protected_area'
            ? 'protected_area'
            : 'unknown';

      // Use center point from Overpass
      const lat = el.center?.lat ?? el.lat;
      const lng = el.center?.lon ?? el.lon;
      if (!lat || !lng) continue;

      // Approximate bbox from bounds or center
      const bounds = el.bounds || { minlat: lat - 0.01, maxlat: lat + 0.01, minlon: lng - 0.01, maxlon: lng + 0.01 };

      areas.push({
        id: el.id,
        name,
        designationType,
        centroid: { lat, lng },
        boundingBox: {
          south: bounds.minlat,
          north: bounds.maxlat,
          west: bounds.minlon,
          east: bounds.maxlon,
        },
      });
    }

    console.log(`[ProtectedAreas] Found ${areas.length} protected areas in bbox`);
    return areas;
  } catch (error) {
    console.warn('[ProtectedAreas] Failed to fetch:', error instanceof Error ? error.message : error);
    return [];
  }
}

function getDesignationFromProtectClass(protectClass: string): string {
  switch (protectClass) {
    case '1': case '1a': case '1b': return 'strict_reserve';
    case '2': return 'national_park';
    case '3': return 'natural_monument';
    case '4': return 'habitat_management';
    case '5': return 'landscape_protection';
    case '6': return 'sustainable_use';
    default: return 'protected_area';
  }
}

/**
 * Fetch waterways (rivers, streams) from OSM as low-resistance corridors.
 * These serve as natural dispersal pathways (hydrochory).
 */
export async function fetchWaterways(
  south: number,
  north: number,
  west: number,
  east: number,
): Promise<Array<{ id: number; name: string; path: [number, number][] }>> {
  const bbox = `${south},${west},${north},${east}`;

  const query = `
[out:json][timeout:15];
(
  way["waterway"~"river|stream|canal"](${bbox});
);
out geom;
`;

  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!res.ok) return [];

    const data = await res.json();
    const elements: any[] = data.elements || [];

    return elements
      .filter((el: any) => el.geometry?.length >= 2)
      .map((el: any) => ({
        id: el.id,
        name: el.tags?.name || 'unnamed',
        path: el.geometry.map((pt: any) => [pt.lat, pt.lon] as [number, number]),
      }));
  } catch {
    return [];
  }
}
