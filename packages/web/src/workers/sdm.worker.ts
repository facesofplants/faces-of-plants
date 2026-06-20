/**
 * SDM Web Worker — runs species distribution modeling in background.
 */

import type { WorldClimData, OccurrenceWithBioclim, SDMResult } from '../lib/sdm-engine';
import { extractBioclim, runSDM } from '../lib/sdm-engine';

interface WorkerMessage {
  type: 'analyze';
  occurrences: Array<{ lat: number; lng: number; year?: number }>;
  worldClim: WorldClimData;
  threshold?: number;
}

interface WorkerResponse {
  type: 'progress' | 'result' | 'error';
  message?: string;
  progress?: number;
  result?: SDMResult;
}

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const { type } = e.data;

  if (type === 'analyze') {
    try {
      const { occurrences, worldClim, threshold = 40 } = e.data;

      // Step 1: Extract bioclim values for each occurrence
      (self as unknown as Worker).postMessage({
        type: 'progress',
        message: 'Extracting climate data for occurrences...',
        progress: 20,
      } satisfies WorkerResponse);

      const occurrencesWithBioclim: OccurrenceWithBioclim[] = [];

      for (const occ of occurrences) {
        if (!occ.lat || !occ.lng) continue;

        const bioclim = extractBioclim(worldClim, occ.lat, occ.lng);
        if (bioclim) {
          occurrencesWithBioclim.push({
            lat: occ.lat,
            lng: occ.lng,
            year: occ.year,
            bioclim,
          });
        }
      }

      if (occurrencesWithBioclim.length < 5) {
        (self as unknown as Worker).postMessage({
          type: 'error',
          message: 'Need at least 5 occurrences with valid climate data for SDM.',
        } satisfies WorkerResponse);
        return;
      }

      // Step 2: Run SDM
      (self as unknown as Worker).postMessage({
        type: 'progress',
        message: 'Running species distribution model...',
        progress: 50,
      } satisfies WorkerResponse);

      const result = runSDM(worldClim, occurrencesWithBioclim, threshold);

      // Step 3: Return results
      (self as unknown as Worker).postMessage({
        type: 'progress',
        message: 'SDM complete.',
        progress: 100,
      } satisfies WorkerResponse);

      (self as unknown as Worker).postMessage({
        type: 'result',
        result,
      } satisfies WorkerResponse);
    } catch (err) {
      (self as unknown as Worker).postMessage({
        type: 'error',
        message: err instanceof Error ? err.message : 'SDM analysis failed',
      } satisfies WorkerResponse);
    }
  }
};
