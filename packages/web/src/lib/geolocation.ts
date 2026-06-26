/**
 * Local species search using device geolocation + GBIF API.
 * All computation happens client-side.
 */

export interface NearbySpecies {
  species: string;
  scientificName: string;
  count: number;
  distance: number;
  lastSeen: string;
  image?: string;
  kingdom: string;
  family: string;
  lat: number;
  lng: number;
}

interface GeoPosition {
  lat: number;
  lng: number;
}

/**
 * Haversine distance between two points in km.
 */
function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Get user's current position.
 */
export function getUserPosition(): Promise<GeoPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        reject(new Error(`Geolocation error: ${error.message}`));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000, // 5 minutes cache
      }
    );
  });
}

/**
 * Build WKT POLYGON for GBIF geometry filter.
 */
function buildBoundingBoxWKT(
  lat: number,
  lng: number,
  radiusKm: number
): string {
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));

  const sw = [lng - lngDelta, lat - latDelta];
  const se = [lng + lngDelta, lat - latDelta];
  const ne = [lng + lngDelta, lat + latDelta];
  const nw = [lng - lngDelta, lat + latDelta];

  return `POLYGON((${sw.join(' ')}, ${se.join(' ')}, ${ne.join(' ')}, ${nw.join(' ')}, ${sw.join(' ')}))`;
}

/**
 * Search GBIF for species near a location.
 */
export async function searchNearbySpecies(
  position: GeoPosition,
  radiusKm: number = 10,
  limit: number = 100
): Promise<NearbySpecies[]> {
  const geometry = buildBoundingBoxWKT(position.lat, position.lng, radiusKm);

  const url = new URL('https://api.gbif.org/v1/occurrence/search');
  url.searchParams.set('kingdomKey', '6');
  url.searchParams.set('hasCoordinate', 'true');
  url.searchParams.set('geometry', geometry);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('hasMedia', 'true');

  const response = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'FaceOfPlants/0.4.1 (https://facesofplants.org)',
    },
  });

  if (!response.ok) {
    throw new Error(`GBIF API error: ${response.status}`);
  }

  const data = await response.json();
  const results = data.results || [];

  // Group by species
  const speciesMap = new Map<
    string,
    {
      scientificName: string;
      count: number;
      lastSeen: string;
      image?: string;
      family: string;
      centroidLat: number;
      centroidLng: number;
    }
  >();

  for (const occ of results) {
    const species = occ.species || occ.scientificName || 'Unknown';
    const existing = speciesMap.get(species);

    if (existing) {
      existing.count++;
      if (occ.eventDate > existing.lastSeen) {
        existing.lastSeen = occ.eventDate;
      }
      if (!existing.image && occ.media?.[0]?.identifier) {
        existing.image = occ.media[0].identifier;
      }
    } else {
      speciesMap.set(species, {
        scientificName: occ.scientificName || species,
        count: 1,
        lastSeen: occ.eventDate || 'Unknown',
        image: occ.media?.[0]?.identifier,
        family: occ.family || 'Unknown',
        centroidLat: occ.decimalLatitude,
        centroidLng: occ.decimalLongitude,
      });
    }
  }

  // Convert to array and calculate distances
  const speciesList: NearbySpecies[] = [];
  for (const [species, info] of speciesMap) {
    speciesList.push({
      species,
      scientificName: info.scientificName,
      count: info.count,
      distance: haversineDistance(
        position.lat,
        position.lng,
        info.centroidLat,
        info.centroidLng
      ),
      lastSeen: info.lastSeen,
      image: info.image,
      kingdom: 'Plantae',
      family: info.family,
      lat: info.centroidLat,
      lng: info.centroidLng,
    });
  }

  return speciesList.sort((a, b) => a.distance - b.distance);
}

/**
 * Get nearby species with offline fallback.
 */
export async function searchNearbyWithFallback(
  radiusKm: number = 10
): Promise<{
  species: NearbySpecies[];
  position: GeoPosition;
  fromCache: boolean;
}> {
  const position = await getUserPosition();

  try {
    const species = await searchNearbySpecies(position, radiusKm);
    return { species, position, fromCache: false };
  } catch {
    // If offline, try to return cached data
    const { getOccurrences } = await import('../lib/indexeddb');
    const cached = await getOccurrences('nearby', 'local');
    return {
      species: cached as unknown as NearbySpecies[],
      position,
      fromCache: true,
    };
  }
}
