'use client';

import { useState, useEffect } from 'react';

import {
  useMultiSourceSearch,
  useDataSources,
  useHealthCheck,
} from '../../hooks/useMultiSourceSearch';

export default function MultiSourceDemoPage() {
  const { search, isLoading, error, result } = useMultiSourceSearch();
  const { sources, fetchSources } = useDataSources();
  const { health, checkHealth } = useHealthCheck();

  const [query, setQuery] = useState('quercus');
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [maxResults, setMaxResults] = useState(50);
  const [mergeStrategy, setMergeStrategy] = useState<'union' | 'intersection'>('union');
  const [enableDeduplication, setEnableDeduplication] = useState(true);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    fetchSources();
    checkHealth();
  }, [fetchSources, checkHealth]);

  const handleSearch = async () => {
    setSearchError(null);
    try {
      await search({
        query,
        sources: selectedSources.length > 0 ? selectedSources : undefined,
        options: {
          maxResults,
          mergeStrategy,
          deduplication: enableDeduplication,
        },
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setSearchError(errorMessage);
      console.error('Search failed:', err);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="border-b border-gray-200 pb-5">
        <h3 className="text-2xl leading-6 font-medium text-gray-900">
          Multi-Source Biodiversity Search Demo
        </h3>
        <p className="mt-2 max-w-4xl text-sm text-gray-500">
          Test the new service abstraction layer with multi-source data integration
        </p>
      </div>

      {/* Data Sources Status */}
      <div className="bg-white shadow rounded-lg p-6">
        <h4 className="text-lg font-medium text-gray-900 mb-4">Available Data Sources</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sources.map((source) => (
            <div key={source.id} className="border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <h5 className="font-medium text-gray-900">{source.name}</h5>
                <span
                  className={`px-2 py-1 text-xs rounded-full ${
                    health?.sources?.[source.id]?.healthy
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {health?.sources?.[source.id]?.healthy ? 'Healthy' : 'Down'}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">v{source.version}</p>
              <div className="mt-2">
                <p className="text-xs text-gray-400">{source.capabilities.length} capabilities</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* System Health */}
      <div className="bg-white shadow rounded-lg p-6">
        <h4 className="text-lg font-medium text-gray-900 mb-4">System Health</h4>
        {health && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {health.overall.totalProviders}
              </div>
              <div className="text-sm text-gray-500">Total Sources</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {health.overall.healthyProviders}
              </div>
              <div className="text-sm text-gray-500">Healthy Sources</div>
            </div>
            <div className="text-center">
              <div
                className={`text-2xl font-bold ${
                  health.overall.status === 'healthy' ? 'text-green-600' : 'text-yellow-600'
                }`}
              >
                {health.overall.status.toUpperCase()}
              </div>
              <div className="text-sm text-gray-500">Overall Status</div>
            </div>
          </div>
        )}
      </div>

      {/* Search Interface */}
      <div className="bg-white shadow rounded-lg p-6">
        <h4 className="text-lg font-medium text-gray-900 mb-4">Search</h4>

        <div className="space-y-4">
          {/* Quick Examples */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Quick Examples</label>
            <div className="flex flex-wrap gap-2">
              {[
                { query: 'quercus', label: 'Oak trees' },
                { query: 'rosa', label: 'Roses' },
                { query: 'pinus', label: 'Pine trees' },
                { query: 'solanum', label: 'Nightshades' },
                { query: 'ficus', label: 'Fig trees' },
              ].map((example) => (
                <button
                  key={example.query}
                  onClick={() => setQuery(example.query)}
                  className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md text-gray-700"
                >
                  {example.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="query" className="block text-sm font-medium text-gray-700">
              Search Query
            </label>
            <input
              type="text"
              id="query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="Enter species name or search term..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Data Sources (leave empty for all)
            </label>
            <div className="space-y-2">
              {sources.map((source) => (
                <label key={source.id} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedSources.includes(source.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedSources([...selectedSources, source.id]);
                      } else {
                        setSelectedSources(selectedSources.filter((id) => id !== source.id));
                      }
                    }}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">{source.name}</span>
                  <span
                    className={`ml-2 px-2 py-1 text-xs rounded-full ${
                      health?.sources?.[source.id]?.healthy
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {health?.sources?.[source.id]?.healthy ? 'Active' : 'Inactive'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Advanced Options */}
          <div>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              <span>Advanced Options</span>
              <svg
                className={`ml-1 h-4 w-4 transform transition-transform ${
                  showAdvanced ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {showAdvanced && (
              <div className="mt-3 space-y-3 p-3 bg-gray-50 rounded-md">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Max Results</label>
                    <select
                      value={maxResults}
                      onChange={(e) => setMaxResults(Number(e.target.value))}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    >
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                      <option value={200}>200</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Merge Strategy
                    </label>
                    <select
                      value={mergeStrategy}
                      onChange={(e) => setMergeStrategy(e.target.value as 'union' | 'intersection')}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    >
                      <option value="union">Union (combine all)</option>
                      <option value="intersection">Intersection (common only)</option>
                    </select>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="deduplication"
                      checked={enableDeduplication}
                      onChange={(e) => setEnableDeduplication(e.target.checked)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <label htmlFor="deduplication" className="ml-2 text-sm text-gray-700">
                      Enable deduplication
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleSearch}
            disabled={isLoading || !query.trim()}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Searching...
              </>
            ) : (
              'Search'
            )}
          </button>
        </div>
      </div>

      {/* Error Display */}
      {(error || searchError) && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Search Error</h3>
              <div className="mt-2 text-sm text-red-700">{error || searchError}</div>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="bg-white shadow rounded-lg p-6">
          <h4 className="text-lg font-medium text-gray-900 mb-4">Search Results</h4>

          {/* Metadata */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="font-medium">Total Results:</span> {result.metadata.totalCount}
              </div>
              <div>
                <span className="font-medium">Execution Time:</span> {result.metadata.executionTime}
                ms
              </div>
              <div>
                <span className="font-medium">Sources Queried:</span>{' '}
                {result.metadata.sourcesQueried}
              </div>
              <div>
                <span className="font-medium">Sources Successful:</span>{' '}
                {result.metadata.sourcesSuccessful}
              </div>
            </div>
          </div>

          {/* Source Results Summary */}
          <div className="mb-6">
            <h5 className="font-medium text-gray-900 mb-2">Source Results</h5>
            <div className="space-y-2">
              {result.sources.map((source) => (
                <div
                  key={source.source}
                  className="flex items-center justify-between bg-gray-50 rounded px-3 py-2"
                >
                  <span className="font-medium">{source.source}</span>
                  <div className="flex items-center space-x-4 text-sm">
                    <span className={source.success ? 'text-green-600' : 'text-red-600'}>
                      {source.success ? `${source.count} results` : 'Failed'}
                    </span>
                    <span className="text-gray-500">{source.executionTime}ms</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Results List */}
          <div className="space-y-3">
            {result.results.slice(0, 10).map((occurrence, index) => (
              <div key={occurrence.key || index} className="border rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h6 className="font-medium text-gray-900">
                      {occurrence.scientificName || 'Unknown species'}
                    </h6>
                    {occurrence.vernacularName && (
                      <p className="text-sm text-gray-500">{occurrence.vernacularName}</p>
                    )}
                    <div className="mt-2 text-sm text-gray-600">
                      {occurrence.country && <span className="mr-4">📍 {occurrence.country}</span>}
                      {occurrence.eventDate && (
                        <span className="mr-4">📅 {occurrence.eventDate}</span>
                      )}
                      <span className="text-xs bg-gray-100 px-2 py-1 rounded">GBIF</span>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">Family: {occurrence.family}</div>
                </div>
              </div>
            ))}
          </div>

          {result.results.length > 10 && (
            <div className="mt-4 text-center text-sm text-gray-500">
              Showing 10 of {result.results.length} results
            </div>
          )}
        </div>
      )}
    </div>
  );
}
export const dynamic = 'force-dynamic';
