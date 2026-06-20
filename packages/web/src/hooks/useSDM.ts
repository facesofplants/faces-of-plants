'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

import type { WorldClimData, SDMResult } from '../lib/sdm-engine';
import type { GBIFOccurrence } from '@faces-of-plants/core/src/types';

interface UseSDMReturn {
  result: SDMResult | null;
  worldClim: WorldClimData | null;
  loading: boolean;
  progress: string;
  error: string | null;
  analyze: (occurrences: GBIFOccurrence[], threshold?: number) => Promise<void>;
  reset: () => void;
}

export function useSDM(): UseSDMReturn {
  const [result, setResult] = useState<SDMResult | null>(null);
  const [worldClim, setWorldClim] = useState<WorldClimData | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);

  // Cleanup worker on unmount
  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const analyze = useCallback(
    async (occurrences: GBIFOccurrence[], threshold: number = 40) => {
      // Load WorldClim data if not cached
      let wc = worldClim;
      if (!wc) {
        try {
          setProgress('Loading climate data...');
          const response = await fetch('/data/worldclim-subset.json');
          wc = await response.json();
          setWorldClim(wc);
        } catch {
          setError('Failed to load WorldClim data');
          return;
        }
      }

      // Clean up previous worker
      workerRef.current?.terminate();

      setLoading(true);
      setError(null);
      setResult(null);
      setProgress('Starting SDM analysis...');

      // Create new worker
      const worker = new Worker(
        new URL('../workers/sdm.worker.ts', import.meta.url),
        { type: 'module' },
      );
      workerRef.current = worker;

      worker.onmessage = (e) => {
        const data = e.data;

        switch (data.type) {
          case 'progress':
            setProgress(data.message);
            break;

          case 'result':
            setResult(data.result);
            setLoading(false);
            setProgress('');
            worker.terminate();
            break;

          case 'error':
            setError(data.message);
            setLoading(false);
            setProgress('');
            worker.terminate();
            break;
        }
      };

      worker.onerror = () => {
        setError('SDM worker failed');
        setLoading(false);
        setProgress('');
        worker.terminate();
      };

      // Extract coordinates from occurrences
      const coords = occurrences
        .filter((occ) => occ.decimalLatitude && occ.decimalLongitude)
        .map((occ) => ({
          lat: occ.decimalLatitude!,
          lng: occ.decimalLongitude!,
          year: occ.eventDate ? new Date(occ.eventDate).getFullYear() : undefined,
        }));

      // Send work to worker
      worker.postMessage({
        type: 'analyze',
        occurrences: coords,
        worldClim: wc,
        threshold,
      });
    },
    [worldClim],
  );

  const reset = useCallback(() => {
    workerRef.current?.terminate();
    setResult(null);
    setLoading(false);
    setProgress('');
    setError(null);
  }, []);

  return {
    result,
    worldClim,
    loading,
    progress,
    error,
    analyze,
    reset,
  };
}
