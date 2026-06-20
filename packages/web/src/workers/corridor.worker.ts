/**
 * Corridor Analysis Web Worker.
 *
 * Runs least-cost path computation in a background thread.
 */

import {
  findCorridors,
  extractCoreAreas,
  type Corridor,
  type CoreArea,
} from '../lib/corridor-analysis';
import { fetchResistanceGrid, type ResistanceGrid } from '../lib/resistance-map';

interface WorkerMessage {
  type: 'analyze';
  occurrences: Array<{ lat: number; lng: number }>;
  bounds: { south: number; north: number; west: number; east: number };
  coreRadiusKm?: number;
}

interface WorkerResponse {
  type: 'result' | 'progress' | 'error';
  corridors?: Corridor[];
  coreAreas?: CoreArea[];
  resistanceGrid?: ResistanceGrid;
  message?: string;
  progress?: number;
}

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const { type } = e.data;

  if (type === 'analyze') {
    try {
      const { occurrences, bounds, coreRadiusKm = 10 } = e.data;

      // Step 1: Extract core areas
      (self as unknown as Worker).postMessage({
        type: 'progress',
        message: 'Finding core habitat areas...',
        progress: 10,
      } satisfies WorkerResponse);

      const coreAreas = extractCoreAreas(occurrences, coreRadiusKm);

      if (coreAreas.length < 2) {
        (self as unknown as Worker).postMessage({
          type: 'error',
          message: 'Need at least 2 core areas to find corridors. Try adjusting the search area.',
        } satisfies WorkerResponse);
        return;
      }

      // Step 2: Fetch resistance grid
      (self as unknown as Worker).postMessage({
        type: 'progress',
        message: 'Loading land-use data...',
        progress: 30,
      } satisfies WorkerResponse);

      const resistanceGrid = await fetchResistanceGrid(
        bounds.south,
        bounds.north,
        bounds.west,
        bounds.east,
      );

      // Step 3: Find corridors
      (self as unknown as Worker).postMessage({
        type: 'progress',
        message: 'Computing least-cost paths...',
        progress: 60,
      } satisfies WorkerResponse);

      const corridors = findCorridors(occurrences, resistanceGrid, coreAreas);

      // Step 4: Return results
      (self as unknown as Worker).postMessage({
        type: 'result',
        corridors,
        coreAreas,
        resistanceGrid,
      } satisfies WorkerResponse);
    } catch (err) {
      (self as unknown as Worker).postMessage({
        type: 'error',
        message: err instanceof Error ? err.message : 'Analysis failed',
      } satisfies WorkerResponse);
    }
  }
};
