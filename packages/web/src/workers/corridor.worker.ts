/**
 * Corridor Analysis Web Worker.
 *
 * Runs least-cost path computation in a background thread.
 * Includes protected area integration, stepping stones, and connectivity assessment.
 */

import {
  findCorridors,
  extractCoreAreas,
  findSteppingStones,
  assessConnectivity,
  integratProtectedAreas,
  type Corridor,
  type CoreArea,
  type SteppingStone,
  type ConnectivityAssessment,
} from '../lib/corridor-analysis';
import { fetchResistanceGrid, type ResistanceGrid } from '../lib/resistance-map';
import { fetchProtectedAreas } from '../lib/protected-areas';

interface WorkerMessage {
  type: 'analyze';
  occurrences: Array<{ lat: number; lng: number }>;
  bounds: { south: number; north: number; west: number; east: number };
  coreRadiusKm?: number;
  genus?: string;
}

interface WorkerResponse {
  type: 'result' | 'progress' | 'error';
  corridors?: Corridor[];
  coreAreas?: CoreArea[];
  steppingStones?: SteppingStone[];
  connectivity?: ConnectivityAssessment;
  resistanceGrid?: ResistanceGrid;
  message?: string;
  progress?: number;
}

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const { type } = e.data;

  if (type === 'analyze') {
    try {
      const { occurrences, bounds, coreRadiusKm = 10, genus } = e.data;

      // Step 1: Extract core areas from occurrence clusters
      (self as unknown as Worker).postMessage({
        type: 'progress',
        message: 'Finding core habitat areas...',
        progress: 10,
      } satisfies WorkerResponse);

      let coreAreas = extractCoreAreas(occurrences, coreRadiusKm);

      // Step 1b: Fetch and integrate official protected areas
      (self as unknown as Worker).postMessage({
        type: 'progress',
        message: 'Loading protected areas...',
        progress: 20,
      } satisfies WorkerResponse);

      try {
        const protectedAreas = await fetchProtectedAreas(
          bounds.south, bounds.north, bounds.west, bounds.east,
        );
        if (protectedAreas.length > 0) {
          coreAreas = integratProtectedAreas(coreAreas, protectedAreas, occurrences);
        }
      } catch {
        // Non-critical: continue without protected areas
      }

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
        progress: 35,
      } satisfies WorkerResponse);

      const resistanceGrid = await fetchResistanceGrid(
        bounds.south,
        bounds.north,
        bounds.west,
        bounds.east,
        2,
        occurrences,
      );

      // Step 3: Find least-cost path corridors
      (self as unknown as Worker).postMessage({
        type: 'progress',
        message: 'Computing least-cost paths...',
        progress: 55,
      } satisfies WorkerResponse);

      const corridors = findCorridors(occurrences, resistanceGrid, coreAreas, genus);

      // Step 4: Identify stepping stones
      (self as unknown as Worker).postMessage({
        type: 'progress',
        message: 'Detecting stepping stones...',
        progress: 75,
      } satisfies WorkerResponse);

      const steppingStones = findSteppingStones(occurrences, coreAreas, corridors, genus);

      // Step 5: Assess functional connectivity
      (self as unknown as Worker).postMessage({
        type: 'progress',
        message: 'Assessing connectivity...',
        progress: 90,
      } satisfies WorkerResponse);

      const connectivity = assessConnectivity(corridors, coreAreas, genus);

      // Step 6: Return results
      (self as unknown as Worker).postMessage({
        type: 'result',
        corridors,
        coreAreas,
        steppingStones,
        connectivity,
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
