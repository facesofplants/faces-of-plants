'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

import type { Corridor, CoreArea } from '../lib/corridor-analysis';
import type { ResistanceGrid } from '../lib/resistance-map';
import type { GBIFOccurrence } from '@faces-of-plants/core/src/types';

interface UseCorridorsReturn {
  corridors: Corridor[];
  coreAreas: CoreArea[];
  resistanceGrid: ResistanceGrid | null;
  loading: boolean;
  progress: string;
  error: string | null;
  analyze: (
    occurrences: GBIFOccurrence[],
    bounds: { south: number; north: number; west: number; east: number },
    coreRadiusKm?: number,
  ) => void;
  reset: () => void;
}

export function useCorridors(): UseCorridorsReturn {
  const [corridors, setCorridors] = useState<Corridor[]>([]);
  const [coreAreas, setCoreAreas] = useState<CoreArea[]>([]);
  const [resistanceGrid, setResistanceGrid] = useState<ResistanceGrid | null>(null);
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
    (
      occurrences: GBIFOccurrence[],
      bounds: { south: number; north: number; west: number; east: number },
      coreRadiusKm: number = 10,
    ) => {
      // Clean up previous worker
      workerRef.current?.terminate();

      setLoading(true);
      setError(null);
      setCorridors([]);
      setCoreAreas([]);
      setResistanceGrid(null);
      setProgress('Starting analysis...');

      // Create new worker
      const worker = new Worker(
        new URL('../workers/corridor.worker.ts', import.meta.url),
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
            setCorridors(data.corridors);
            setCoreAreas(data.coreAreas);
            setResistanceGrid(data.resistanceGrid);
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
        setError('Worker failed. Try reducing the search area.');
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
        }));

      // Send work to worker
      worker.postMessage({
        type: 'analyze',
        occurrences: coords,
        bounds,
        coreRadiusKm,
      });
    },
    [],
  );

  const reset = useCallback(() => {
    workerRef.current?.terminate();
    setCorridors([]);
    setCoreAreas([]);
    setResistanceGrid(null);
    setLoading(false);
    setProgress('');
    setError(null);
  }, []);

  return {
    corridors,
    coreAreas,
    resistanceGrid,
    loading,
    progress,
    error,
    analyze,
    reset,
  };
}
