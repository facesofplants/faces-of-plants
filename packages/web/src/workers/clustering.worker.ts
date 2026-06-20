/**
 * Web Worker for spatial clustering of GBIF occurrence data.
 * Runs DBSCAN clustering in a background thread to keep UI responsive.
 */

interface Point {
  lat: number;
  lng: number;
  index: number;
}

interface ClusterResult {
  clusterId: number;
  points: Point[];
  centroid: { lat: number; lng: number };
  count: number;
}

interface WorkerMessage {
  type: 'cluster';
  points: Array<{ lat: number; lng: number; [key: string]: unknown }>;
  epsilonKm: number;
  minPoints: number;
}

interface WorkerResponse {
  type: 'clustered';
  clusters: ClusterResult[];
  noise: Point[];
  stats: {
    totalPoints: number;
    clusterCount: number;
    noiseCount: number;
  };
}

/**
 * Haversine distance between two points in kilometers.
 */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * DBSCAN clustering for geographic points.
 */
function dbscan(
  points: Point[],
  epsilonKm: number,
  minPoints: number
): { labels: number[]; clusterCount: number } {
  const n = points.length;
  const labels = new Array(n).fill(-1); // -1 = unvisited
  let clusterCount = 0;

  for (let i = 0; i < n; i++) {
    if (labels[i] !== -1) continue;

    // Find neighbors
    const neighbors: number[] = [];
    for (let j = 0; j < n; j++) {
      if (i !== j && haversineDistance(points[i].lat, points[i].lng, points[j].lat, points[j].lng) <= epsilonKm) {
        neighbors.push(j);
      }
    }

    if (neighbors.length < minPoints) {
      labels[i] = -2; // noise
      continue;
    }

    // Start new cluster
    clusterCount++;
    labels[i] = clusterCount;

    // Expand cluster
    const seeds = [...neighbors];
    const visited = new Set([i]);

    while (seeds.length > 0) {
      const current = seeds.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);

      if (labels[current] === -2) {
        labels[current] = clusterCount; // noise point becomes border point
      }

      if (labels[current] !== -1) continue; // already processed

      labels[current] = clusterCount;

      // Find neighbors of current
      const currentNeighbors: number[] = [];
      for (let j = 0; j < n; j++) {
        if (current !== j && haversineDistance(points[current].lat, points[current].lng, points[j].lat, points[j].lng) <= epsilonKm) {
          currentNeighbors.push(j);
        }
      }

      if (currentNeighbors.length >= minPoints) {
        for (const nn of currentNeighbors) {
          if (!visited.has(nn)) {
            seeds.push(nn);
          }
        }
      }
    }
  }

  return { labels, clusterCount };
}

/**
 * Calculate centroid of a set of points.
 */
function calculateCentroid(points: Point[]): { lat: number; lng: number } {
  const sumLat = points.reduce((sum, p) => sum + p.lat, 0);
  const sumLng = points.reduce((sum, p) => sum + p.lng, 0);
  return {
    lat: sumLat / points.length,
    lng: sumLng / points.length,
  };
}

/**
 * Process clustering in the worker.
 */
function processClustering(
  points: Array<{ lat: number; lng: number; [key: string]: unknown }>,
  epsilonKm: number,
  minPoints: number
): WorkerResponse {
  const indexedPoints: Point[] = points.map((p, i) => ({
    lat: p.lat,
    lng: p.lng,
    index: i,
  }));

  const { labels, clusterCount } = dbscan(indexedPoints, epsilonKm, minPoints);

  // Group points by cluster
  const clusterMap = new Map<number, Point[]>();
  const noise: Point[] = [];

  for (let i = 0; i < indexedPoints.length; i++) {
    const label = labels[i];
    if (label === -2 || label === -1) {
      noise.push(indexedPoints[i]);
    } else {
      if (!clusterMap.has(label)) {
        clusterMap.set(label, []);
      }
      clusterMap.get(label)!.push(indexedPoints[i]);
    }
  }

  // Build cluster results
  const clusters: ClusterResult[] = [];
  for (const [clusterId, clusterPoints] of clusterMap) {
    clusters.push({
      clusterId,
      points: clusterPoints,
      centroid: calculateCentroid(clusterPoints),
      count: clusterPoints.length,
    });
  }

  // Sort clusters by count (largest first)
  clusters.sort((a, b) => b.count - a.count);

  return {
    type: 'clustered',
    clusters,
    noise,
    stats: {
      totalPoints: points.length,
      clusterCount: clusters.length,
      noiseCount: noise.length,
    },
  };
}

// Message handler
self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const { type, points, epsilonKm, minPoints } = event.data;

  if (type === 'cluster') {
    try {
      const result = processClustering(points, epsilonKm, minPoints);
      self.postMessage(result);
    } catch (error) {
      self.postMessage({
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
};

// Export for TypeScript (not actually used in worker context)
export {};
