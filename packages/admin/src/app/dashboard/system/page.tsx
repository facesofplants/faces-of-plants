'use client';

import { useEffect, useState } from 'react';
import { ChartLineUp } from '@phosphor-icons/react';

type SyncStatusResponse = {
  lastSyncAt: string | null;
  lastSyncBy: string | null;
  lastSyncStatus: string;
  lastSyncError: string | null;
  lastSyncSummary: string | null;
  cacheMeta?: {
    generatedAt: string;
    totalEntries: number;
    countsByRank: Record<string, number>;
    chunkCount: number;
    chunkSize: number;
  };
};

export default function SystemPage() {
  const [status, setStatus] = useState<SyncStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');

  async function parseJsonResponse<T>(response: Response): Promise<T> {
    const raw = await response.text();
    try {
      return JSON.parse(raw) as T;
    } catch {
      const snippet = raw.slice(0, 120).replace(/\s+/g, ' ');
      throw new Error(`Invalid API response (${response.status}): ${snippet}`);
    }
  }

  async function loadStatus() {
    const response = await fetch('/api/system/taxonomy-sync', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Unable to load taxonomy sync status');
    }
    const data = await parseJsonResponse<SyncStatusResponse>(response);
    setStatus(data);
  }

  useEffect(() => {
    loadStatus().catch((error) => {
      setMessage(error instanceof Error ? error.message : 'Unable to load status');
    });
  }, []);

  async function triggerSync() {
    setIsLoading(true);
    setMessage(null);
    setMessageType('success');

    try {
      const response = await fetch('/api/system/taxonomy-sync', { method: 'POST' });
      const data = await parseJsonResponse<{ summary?: string; error?: string }>(response);
      if (!response.ok) {
        throw new Error(data?.error || 'Sync failed');
      }

      setMessage(`Taxonomy sync completed: ${data.summary || 'ok'}`);
      setMessageType('success');
      await loadStatus();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Sync failed');
      setMessageType('error');
      await loadStatus().catch(() => null);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <ChartLineUp size={24} className="text-green-600" />
        <h1 className="text-2xl font-bold">System</h1>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        System health, cache management, and usage metrics.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">API Status</h3>
          <p className="text-2xl font-bold text-green-600">Operational</p>
          <p className="text-xs text-gray-500 mt-1">All systems functioning normally</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">GBIF API</h3>
          <p className="text-2xl font-bold text-green-600">Connected</p>
          <p className="text-xs text-gray-500 mt-1">Public API — no key required</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Taxonomy Sync</h3>
            <p className="text-sm text-gray-500 mt-1">
              Run GBIF taxonomy cache sync on demand (PHYLUM, CLASS, ORDER, FAMILY, GENUS).
            </p>
          </div>
          <button
            type="button"
            onClick={triggerSync}
            disabled={isLoading}
            className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Sync running...' : 'Run Sync Now'}
          </button>
        </div>

        <div className="space-y-2 text-sm text-gray-700">
          <p><span className="font-medium">Last status:</span> {status?.lastSyncStatus || 'unknown'}</p>
          <p><span className="font-medium">Last run:</span> {status?.lastSyncAt || 'never'}</p>
          <p><span className="font-medium">Triggered by:</span> {status?.lastSyncBy || 'n/a'}</p>
          {status?.cacheMeta ? (
            <>
              <p><span className="font-medium">Cache generated:</span> {status.cacheMeta.generatedAt}</p>
              <p><span className="font-medium">Cached entries:</span> {status.cacheMeta.totalEntries}</p>
              <p><span className="font-medium">Chunks:</span> {status.cacheMeta.chunkCount} ({status.cacheMeta.chunkSize} entries/chunk)</p>
            </>
          ) : (
            <p className="text-amber-700">No taxonomy cache metadata found yet. Run sync once.</p>
          )}
          {status?.lastSyncSummary ? <p><span className="font-medium">Summary:</span> {status.lastSyncSummary}</p> : null}
          {status?.lastSyncError ? <p className="text-red-600"><span className="font-medium">Error:</span> {status.lastSyncError}</p> : null}
          {message ? <p className={messageType === 'error' ? 'text-red-600' : 'text-green-700'}>{message}</p> : null}
        </div>
      </div>
    </div>
  );
}
