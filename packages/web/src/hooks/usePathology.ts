'use client';

import { useState, useCallback, useRef } from 'react';

import { isModelAvailable, type PathologyResult } from '../lib/pathology-detector';

interface UsePathologyReturn {
  results: PathologyResult[];
  loading: boolean;
  error: string | null;
  modelReady: boolean;
  detect: (file: File) => Promise<void>;
  reset: () => void;
}

export function usePathology(): UsePathologyReturn {
  const [results, setResults] = useState<PathologyResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelReady, setModelReady] = useState(false);
  const detectingRef = useRef(false);
  const workerRef = useRef<Worker | null>(null);

  const checkModel = useCallback(async () => {
    const available = await isModelAvailable();
    setModelReady(available);
    return available;
  }, []);

  const detect = useCallback(
    async (file: File) => {
      if (detectingRef.current) return;
      detectingRef.current = true;

      setLoading(true);
      setError(null);
      setResults([]);

      try {
        if (!modelReady) {
          const available = await checkModel();
          if (!available) {
            throw new Error(
              'Plant pathology model not found. Run: python scripts/convert-to-onnx.py',
            );
          }
        }

        if (!file.type.startsWith('image/')) {
          throw new Error('Please upload an image file (JPEG or PNG)');
        }

        if (file.size > 10 * 1024 * 1024) {
          throw new Error('Image must be less than 10MB');
        }

        const imageData = await file.arrayBuffer();

        const pathologyResults = await new Promise<PathologyResult[]>((resolve, reject) => {
          const worker = new Worker(
            new URL('../workers/pathology.worker.ts', import.meta.url),
            { type: 'module' },
          );
          workerRef.current = worker;

          worker.onmessage = (event) => {
            const data = event.data;
            if (data.type === 'result') {
              resolve(data.results as PathologyResult[]);
            } else if (data.type === 'error') {
              reject(new Error(data.error));
            }
            worker.terminate();
            workerRef.current = null;
          };

          worker.onerror = (err) => {
            reject(new Error(err.message));
            worker.terminate();
            workerRef.current = null;
          };

          worker.postMessage({ type: 'detect', imageData, topK: 5 });
        });

        setResults(pathologyResults);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Detection failed');
      } finally {
        setLoading(false);
        detectingRef.current = false;
      }
    },
    [modelReady, checkModel],
  );

  const reset = useCallback(() => {
    setResults([]);
    setError(null);
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
  }, []);

  return { results, loading, error, modelReady, detect, reset };
}
