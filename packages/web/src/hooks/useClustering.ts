'use client';

import { useCallback, useRef, useState } from 'react';

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

interface ClusterStats {
  totalPoints: number;
  clusterCount: number;
  noiseCount: number;
}

interface UseClusteringReturn {
  /**
   * Cluster results.
   */
  clusters: ClusterResult[];
  /**
   * Noise points (not in any cluster).
   */
  noise: Point[];
  /**
   * Clustering statistics.
   */
  stats: ClusterStats | null;
  /**
   * Whether clustering is in progress.
   */
  computing: boolean;
  /**
   * Run clustering on points.
   */
  cluster: (
    points: Array<{ lat: number; lng: number; [key: string]: unknown }>,
    epsilonKm?: number,
    minPoints?: number
  ) => Promise<void>;
}

const DEFAULT_EPSILON_KM = 10; // 10 km radius for cluster detection
const DEFAULT_MIN_POINTS = 5; // Minimum points to form a cluster

/**
 * Hook for running DBSCAN clustering in a Web Worker.
 */
export function useClustering(): UseClusteringReturn {
  const [clusters, setClusters] = useState<ClusterResult[]>([]);
  const [noise, setNoise] = useState<Point[]>([]);
  const [stats, setStats] = useState<ClusterStats | null>(null);
  const [computing, setComputing] = useState(false);

  const workerRef = useRef<Worker | null>(null);

  const cluster = useCallback(
    async (
      points: Array<{ lat: number; lng: number; [key: string]: unknown }>,
      epsilonKm: number = DEFAULT_EPSILON_KM,
      minPoints: number = DEFAULT_MIN_POINTS
    ) => {
      if (points.length === 0) {
        setClusters([]);
        setNoise([]);
        setStats(null);
        return;
      }

      setComputing(true);

      try {
        // Create worker if not exists
        if (!workerRef.current) {
          workerRef.current = new Worker(
            new URL('../workers/clustering.worker.ts', import.meta.url),
            { type: 'module' }
          );
        }

        const worker = workerRef.current;

        // Run clustering
        const result = await new Promise<{
          clusters: ClusterResult[];
          noise: Point[];
          stats: ClusterStats;
        }>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Clustering timed out'));
          }, 30000); // 30s timeout

          worker.onmessage = (event) => {
            clearTimeout(timeout);
            if (event.data.type === 'clustered') {
              resolve(event.data);
            } else if (event.data.type === 'error') {
              reject(new Error(event.data.error));
            }
          };

          worker.onerror = (error) => {
            clearTimeout(timeout);
            reject(error);
          };

          worker.postMessage({
            type: 'cluster',
            points,
            epsilonKm,
            minPoints,
          });
        });

        setClusters(result.clusters);
        setNoise(result.noise);
        setStats(result.stats);
      } catch (err) {
        console.error('[useClustering] Error:', err);
        // Fallback: treat all points as a single cluster
        if (points.length > 0) {
          const centroid = {
            lat: points.reduce((sum, p) => sum + p.lat, 0) / points.length,
            lng: points.reduce((sum, p) => sum + p.lng, 0) / points.length,
          };
          setClusters([
            {
              clusterId: 1,
              points: points.map((p, i) => ({ lat: p.lat, lng: p.lng, index: i })),
              centroid,
              count: points.length,
            },
          ]);
          setNoise([]);
          setStats({
            totalPoints: points.length,
            clusterCount: 1,
            noiseCount: 0,
          });
        }
      } finally {
        setComputing(false);
      }
    },
    []
  );

  return {
    clusters,
    noise,
    stats,
    computing,
    cluster,
  };
}
