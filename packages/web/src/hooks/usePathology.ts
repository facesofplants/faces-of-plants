'use client';

import { useState, useCallback, useRef } from 'react';

import {
  detectPathology,
  isModelAvailable,
  type PathologyResult,
} from '../lib/pathology-detector';

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

  // Check model availability on first use
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
        // Check model availability
        if (!modelReady) {
          const available = await checkModel();
          if (!available) {
            throw new Error(
              'Plant pathology model not found. Run: python scripts/convert-to-onnx.py',
            );
          }
        }

        // Validate file
        if (!file.type.startsWith('image/')) {
          throw new Error('Please upload an image file (JPEG or PNG)');
        }

        if (file.size > 10 * 1024 * 1024) {
          throw new Error('Image must be less than 10MB');
        }

        const pathologyResults = await detectPathology(file, 5);
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
  }, []);

  return { results, loading, error, modelReady, detect, reset };
}
