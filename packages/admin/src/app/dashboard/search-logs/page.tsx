'use client';

import { useEffect, useState } from 'react';
import { MagnifyingGlass, Spinner, CaretDown, CaretRight } from '@phosphor-icons/react';
import { analyzeQueryCoverage, type QueryCoverage } from '@faces-of-plants/core/src/services/query-coverage';

interface SearchLog {
  timestamp: string;
  query: string;
  gbifParams: Record<string, any>;
  resolvedName: string;
  resolverSource: string;
  occurrences: number;
  totalCount: number;
  sessionId: string | null;
  userEmail: string | null;
  ip: string;
}

interface SessionGroup {
  sessionKey: string;
  logs: SearchLog[];
  ip: string;
  startTime: string;
  endTime: string;
  queryCount: number;
}

interface ProblematicQueryGroup {
  normalizedQuery: string;
  query: string;
  count: number;
  lastSeen: string;
  sources: string[];
  sessionCount: number;
  priorityScore: number;
  coverage: QueryCoverage;
}

interface VerificationState {
  totalCount: number;
  validCoordinates: number;
  resolvedName: string;
  resolverSource: string;
  hasResults: boolean;
  checkedAt: string;
}

interface CoverageStats {
  typoMap: number;
  aliasMap: number;
  intent: number;
  locationOnlyFallback: number;
}

interface ResolvedIssue {
  normalizedQuery: string;
  query: string;
  status: 'resolved';
  resolvedAt: string;
  resolvedBy: string;
  reason?: string;
}

/**
 * Group logs by session. Uses sessionId if available,
 * otherwise groups by IP + time proximity (< 5 min gap).
 */
function groupBySession(logs: SearchLog[]): SessionGroup[] {
  const groups: SessionGroup[] = [];
  const bySession = new Map<string, SearchLog[]>();

  for (const log of logs) {
    const key = log.sessionId || `ip:${log.ip}`;
    const existing = bySession.get(key);
    if (existing) {
      // Check if time gap is > 30 minutes for IP-based grouping (no sessionId)
      if (!log.sessionId && existing.length > 0) {
        const lastTime = new Date(existing[existing.length - 1].timestamp).getTime();
        const thisTime = new Date(log.timestamp).getTime();
        if (Math.abs(thisTime - lastTime) > 30 * 60 * 1000) {
          // Start new group
          bySession.set(`${key}:${log.timestamp}`, [log]);
          continue;
        }
      }
      existing.push(log);
    } else {
      bySession.set(key, [log]);
    }
  }

  for (const [key, sessionLogs] of bySession) {
    const sorted = sessionLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    groups.push({
      sessionKey: key,
      logs: sorted,
      ip: sorted[0].ip,
      startTime: sorted[sorted.length - 1].timestamp,
      endTime: sorted[0].timestamp,
      queryCount: sorted.length,
    });
  }

  // Sort groups by most recent activity
  groups.sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime());
  return groups;
}

function formatGbifParams(params: Record<string, any>): string {
  const keys = Object.keys(params).filter(k => !['hasCoordinate', 'limit', 'kingdomKey'].includes(k));
  return keys.map(k => `${k}=${params[k]}`).join(', ');
}

function normalizeQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ').toLowerCase();
}

function daysAgo(timestamp: string): number {
  const ms = Date.now() - new Date(timestamp).getTime();
  return Math.max(0, ms / (1000 * 60 * 60 * 24));
}

function computePriorityScore(input: { count: number; lastSeen: string; sources: string[] }): number {
  // Frequency dominates; recency and raw fallback usage increase triage urgency.
  const frequencyScore = input.count * 12;
  const recencyBoost = Math.max(0, 35 - Math.floor(daysAgo(input.lastSeen) * 2));
  const rawBoost = input.sources.includes('raw') ? 30 : 0;
  return frequencyScore + recencyBoost + rawBoost;
}

function groupProblematicQueries(logs: SearchLog[]): ProblematicQueryGroup[] {
  const map = new Map<string, ProblematicQueryGroup & { sessionIds: Set<string> }>();

  for (const log of logs) {
    if (Number(log.occurrences) !== 0 || Number(log.totalCount) !== 0) continue;
    const key = normalizeQuery(log.query);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        normalizedQuery: key,
        query: log.query,
        count: 1,
        lastSeen: log.timestamp,
        sources: [log.resolverSource],
        sessionCount: 1,
        priorityScore: 0,
        coverage: analyzeQueryCoverage(log.query),
        sessionIds: new Set([log.sessionId || `ip:${log.ip}`]),
      });
      continue;
    }

    existing.count += 1;
    if (new Date(log.timestamp).getTime() > new Date(existing.lastSeen).getTime()) {
      existing.lastSeen = log.timestamp;
      existing.query = log.query;
    }
    if (!existing.sources.includes(log.resolverSource)) {
      existing.sources.push(log.resolverSource);
    }
    existing.sessionIds.add(log.sessionId || `ip:${log.ip}`);
  }

  return [...map.values()]
    .map((row) => ({
      normalizedQuery: row.normalizedQuery,
      query: row.query,
      count: row.count,
      lastSeen: row.lastSeen,
      sources: row.sources,
      sessionCount: row.sessionIds.size,
      priorityScore: computePriorityScore({ count: row.count, lastSeen: row.lastSeen, sources: row.sources }),
      coverage: row.coverage,
    }))
    .sort((a, b) => b.priorityScore - a.priorityScore || b.count - a.count || new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime());
}

function computeCoverageStats(rows: ProblematicQueryGroup[]): CoverageStats {
  return rows.reduce<CoverageStats>((acc, row) => {
    if (row.coverage.typoMap) acc.typoMap += 1;
    if (row.coverage.aliasMap) acc.aliasMap += 1;
    if (row.coverage.intent) acc.intent += 1;
    if (row.coverage.locationOnlyFallback) acc.locationOnlyFallback += 1;
    return acc;
  }, { typoMap: 0, aliasMap: 0, intent: 0, locationOnlyFallback: 0 });
}

function exportProblematicQueriesCsv(rows: ProblematicQueryGroup[]) {
  const headers = ['query', 'normalizedQuery', 'count', 'sessionCount', 'priorityScore', 'lastSeen', 'daysAgo', 'resolverSources'];
  const csvRows = rows.map((row) => [
    row.query,
    row.normalizedQuery,
    String(row.count),
    String(row.sessionCount),
    String(row.priorityScore),
    row.lastSeen,
    daysAgo(row.lastSeen).toFixed(1),
    row.sources.join('|'),
  ]);

  const csv = [headers, ...csvRows]
    .map((line) => line.map((field) => `"${field.replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `problematic-queries-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportProblematicQueriesJson(rows: ProblematicQueryGroup[]) {
  const payload = buildProblematicQueriesPayload(rows);

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `problematic-queries-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function buildProblematicQueriesPayload(rows: ProblematicQueryGroup[]) {
  return {
    schemaVersion: '1.0',
    generatedAt: new Date().toISOString(),
    kind: 'problematic-search-queries',
    totalUniqueQueries: rows.length,
    totalOccurrences: rows.reduce((acc, row) => acc + row.count, 0),
    queries: rows.map((row) => ({
      query: row.query,
      normalizedQuery: row.normalizedQuery,
      replayUrl: buildExploreReplayUrl(row.query),
      count: row.count,
      sessionCount: row.sessionCount,
      priorityScore: row.priorityScore,
      lastSeen: row.lastSeen,
      daysAgo: Number(daysAgo(row.lastSeen).toFixed(2)),
      resolverSources: row.sources,
      coverage: {
        typoMap: row.coverage.typoMap,
        aliasMap: row.coverage.aliasMap,
        intent: row.coverage.intent,
        locationOnlyFallback: row.coverage.locationOnlyFallback,
      },
      coveredBy: [
        row.coverage.typoMap ? 'typo-map' : null,
        row.coverage.aliasMap ? 'alias-map' : null,
        row.coverage.intent ? 'intent' : null,
        row.coverage.locationOnlyFallback ? 'location-only' : null,
      ].filter(Boolean),
    })),
  };
}

function getPublicWebBaseUrl(): string {
  return 'https://facesofplants.org';
}

function buildExploreReplayUrl(query: string): string {
  return `${getPublicWebBaseUrl()}/explore?${new URLSearchParams({ q: query }).toString()}`;
}

function buildApiReplayUrl(query: string): string {
  return `${getPublicWebBaseUrl()}/api/map-search?${new URLSearchParams({ species: query, limit: '1' }).toString()}`;
}

function LogRow({ log, defaultExpanded }: { log: SearchLog; defaultExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded || false);
  const paramsText = formatGbifParams(log.gbifParams);

  return (
    <>
      <tr
        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-4 py-2.5 text-gray-400 w-5">
          {expanded ? <CaretDown size={12} /> : <CaretRight size={12} />}
        </td>
        <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap text-xs">
          {new Date(log.timestamp).toLocaleString('it-IT', {
            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
          })}
        </td>
        <td className="px-3 py-2.5 font-medium text-gray-900 text-sm">{log.query}</td>
        <td className="px-3 py-2.5 text-gray-700 italic text-sm">{log.resolvedName || '—'}</td>
        <td className="px-3 py-2.5">
          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
            log.resolverSource === 'gbif-species-api' ? 'bg-green-100 text-green-700' :
            log.resolverSource === 'llm' ? 'bg-purple-100 text-purple-700' :
            log.resolverSource === 'direct' ? 'bg-blue-100 text-blue-700' :
            'bg-gray-100 text-gray-600'
          }`}>
            {log.resolverSource}
          </span>
        </td>
        <td className="px-3 py-2.5 text-right font-mono text-sm">
          <span className="text-gray-900">{log.occurrences}</span>
          <span className="text-gray-400 text-xs"> / {log.totalCount.toLocaleString()}</span>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-gray-50 border-b border-gray-100">
          <td colSpan={6} className="px-8 py-3">
            <div className="space-y-2 text-xs">
              <div>
                <span className="font-semibold text-gray-600">GBIF Params:</span>
                <pre className="mt-1 p-2 bg-white border border-gray-200 rounded text-gray-700 font-mono whitespace-pre-wrap break-all">
                  {JSON.stringify(log.gbifParams, null, 2)}
                </pre>
              </div>
              <div className="flex gap-6 text-gray-500">
                <span><span className="font-medium">IP:</span> {log.ip}</span>
                <span><span className="font-medium">Session:</span> {log.sessionId || 'N/A'}</span>
                <span><span className="font-medium">Timestamp:</span> {log.timestamp}</span>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function SearchLogsPage() {
  const [logs, setLogs] = useState<SearchLog[]>([]);
  const [resolvedIssues, setResolvedIssues] = useState<ResolvedIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [onlyProblematic, setOnlyProblematic] = useState(false);
  const [showResolvedIssues, setShowResolvedIssues] = useState(false);
  const [timePresetDays, setTimePresetDays] = useState<number | null>(null);
  const [problemPanelOpen, setProblemPanelOpen] = useState(true);
  const [jsonCopied, setJsonCopied] = useState(false);
  const [pendingIssueUpdate, setPendingIssueUpdate] = useState<string | null>(null);
  const [pendingVerification, setPendingVerification] = useState<string | null>(null);
  const [verificationResults, setVerificationResults] = useState<Record<string, VerificationState>>({});
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const copyProblematicQueriesJson = async () => {
    try {
      const payload = buildProblematicQueriesPayload(problematicGroups);
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setJsonCopied(true);
      window.setTimeout(() => setJsonCopied(false), 1800);
    } catch {
      setJsonCopied(false);
    }
  };


  useEffect(() => {
    fetch('/api/search-logs?limit=2000')
      .then(res => res.json())
      .then(data => {
        setLogs(data.logs || []);
        setResolvedIssues(data.resolvedIssues || []);
      })
      .catch(() => {
        setLogs([]);
        setResolvedIssues([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const resolvedIssueSet = new Set(
    resolvedIssues
      .filter((issue) => issue.status === 'resolved')
      .map((issue) => normalizeQuery(issue.normalizedQuery || issue.query)),
  );
  const resolvedIssueMap = new Map(
    resolvedIssues.map((issue) => [normalizeQuery(issue.normalizedQuery || issue.query), issue]),
  );

  const timeFilteredLogs = logs.filter((l) => {
    if (!timePresetDays) return true;
    return daysAgo(l.timestamp) <= timePresetDays;
  });

  const problematicGroupsAll = groupProblematicQueries(timeFilteredLogs);
  const problematicGroups = problematicGroupsAll.filter((row) =>
    showResolvedIssues ? true : !resolvedIssueSet.has(row.normalizedQuery),
  );
  const resolvedProblematicGroups = problematicGroupsAll.filter((row) => resolvedIssueSet.has(row.normalizedQuery));
  const coverageStats = computeCoverageStats(problematicGroups);
  const problematicSet = new Set(
    timeFilteredLogs
      .filter((l) => Number(l.occurrences) === 0 && Number(l.totalCount) === 0)
      .map((l) => `${l.timestamp}::${normalizeQuery(l.query)}`),
  );

  const filtered = timeFilteredLogs.filter((l) => {
    const matchesFilter = !filter ||
      l.query.toLowerCase().includes(filter.toLowerCase()) ||
      l.resolvedName?.toLowerCase().includes(filter.toLowerCase());
    if (!matchesFilter) return false;
    if (!onlyProblematic) return true;
    return problematicSet.has(`${l.timestamp}::${normalizeQuery(l.query)}`);
  });

  const sessions = groupBySession(filtered);

  const toggleSession = (key: string) => {
    setExpandedSessions(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const updateIssueStatus = async (
    row: ProblematicQueryGroup,
    action: 'resolve' | 'reopen',
    options?: { skipPrompt?: boolean; reason?: string },
  ) => {
    let reason = '';
    if (action === 'resolve') {
      if (options?.skipPrompt) {
        reason = options.reason?.trim().slice(0, 240) || 'verify now found results';
      } else {
        const promptValue = window.prompt('Resolution reason (short note, optional):', 'resolver rule improved');
        if (promptValue === null) return;
        reason = promptValue.trim();
      }
    }

    setPendingIssueUpdate(row.normalizedQuery);
    try {
      const response = await fetch('/api/search-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          normalizedQuery: row.normalizedQuery,
          query: row.query,
          reason,
        }),
      });

      if (!response.ok) throw new Error('Issue update failed');

      setResolvedIssues((prev) => {
        if (action === 'resolve') {
          const next = prev.filter((issue) => normalizeQuery(issue.normalizedQuery) !== row.normalizedQuery);
          next.push({
            normalizedQuery: row.normalizedQuery,
            query: row.query,
            status: 'resolved',
            resolvedAt: new Date().toISOString(),
            resolvedBy: 'admin',
            reason,
          });
          return next;
        }
        return prev.filter((issue) => normalizeQuery(issue.normalizedQuery) !== row.normalizedQuery);
      });
    } catch {
      // Ignore and keep current state.
    } finally {
      setPendingIssueUpdate(null);
    }
  };

  const verifyIssue = async (row: ProblematicQueryGroup) => {
    setPendingVerification(row.normalizedQuery);
    try {
      const response = await fetch('/api/search-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify',
          normalizedQuery: row.normalizedQuery,
          query: row.query,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.verification) {
        throw new Error('Verification failed');
      }

      const nextVerification = {
        ...data.verification,
        checkedAt: new Date().toISOString(),
      };

      setVerificationResults((prev) => ({
        ...prev,
        [row.normalizedQuery]: nextVerification,
      }));

      if (nextVerification.hasResults && !resolvedIssueSet.has(row.normalizedQuery)) {
        const confirmed = window.confirm(
          `La query "${row.query}" ora restituisce ${nextVerification.validCoordinates} mapped / ${nextVerification.totalCount} total. Vuoi marcarla come risolta adesso?`,
        );

        if (confirmed) {
          await updateIssueStatus(row, 'resolve', {
            skipPrompt: true,
            reason: `verify now found results (${nextVerification.validCoordinates} mapped / ${nextVerification.totalCount} total)`,
          });
        }
      }
    } catch {
      setVerificationResults((prev) => ({
        ...prev,
        [row.normalizedQuery]: {
          totalCount: 0,
          validCoordinates: 0,
          resolvedName: '',
          resolverSource: '',
          hasResults: false,
          checkedAt: new Date().toISOString(),
        },
      }));
    } finally {
      setPendingVerification(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size={32} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <MagnifyingGlass size={24} className="text-green-600" />
          <h1 className="text-2xl font-bold text-gray-900">Search Logs</h1>
          <span className="text-sm text-gray-500">({timeFilteredLogs.length} entries · {sessions.length} sessions)</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setOnlyProblematic(true);
              setTimePresetDays(7);
            }}
            className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
              timePresetDays === 7 && onlyProblematic
                ? 'bg-amber-50 border-amber-300 text-amber-700'
                : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            Last 7d 0/0 preset
          </button>
          <button
            onClick={() => setTimePresetDays(null)}
            className="px-3 py-2 rounded-lg text-sm border border-gray-300 text-gray-600 hover:bg-gray-50"
          >
            Clear time filter
          </button>
          <button
            onClick={() => setOnlyProblematic(v => !v)}
            className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
              onlyProblematic
                ? 'bg-red-50 border-red-300 text-red-700'
                : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {onlyProblematic ? 'Showing only 0/0' : 'Show only 0/0'}
          </button>
          <input
            type="text"
            placeholder="Filter by query..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-64 focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
        </div>
      </div>

      <div className="mb-6 border border-red-200 bg-red-50 rounded-lg">
        <button
          onClick={() => setProblemPanelOpen(v => !v)}
          className="w-full flex items-center justify-between p-4 text-left"
        >
          <div>
            <h2 className="text-sm font-semibold text-red-800">Problematic Natural-Language Queries (0/0)</h2>
            <p className="text-xs text-red-700 mt-1">
              {problematicGroups.length} unique queries · {problematicGroups.reduce((acc, row) => acc + row.count, 0)} total occurrences
              {timePresetDays ? ` · filtered to last ${timePresetDays} days` : ''}
            </p>
          </div>
          <div className="text-red-700">{problemPanelOpen ? <CaretDown size={14} /> : <CaretRight size={14} />}</div>
        </button>

        {problemPanelOpen && (
          <div className="px-4 pb-4">
            <div className="flex items-center gap-2 mb-3">
              <button
                disabled={problematicGroups.length === 0}
                onClick={() => exportProblematicQueriesCsv(problematicGroups)}
                className="px-3 py-2 rounded-lg text-xs font-medium bg-red-600 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-700"
              >
                Export CSV
              </button>
              <button
                disabled={problematicGroups.length === 0}
                onClick={() => exportProblematicQueriesJson(problematicGroups)}
                className="px-3 py-2 rounded-lg text-xs font-medium bg-gray-800 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-900"
              >
                Export JSON (agents)
              </button>
              <button
                disabled={problematicGroups.length === 0}
                onClick={copyProblematicQueriesJson}
                className="px-3 py-2 rounded-lg text-xs font-medium bg-white border border-gray-300 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                {jsonCopied ? 'Copied JSON' : 'Copy JSON'}
              </button>
              <button
                onClick={() => setShowResolvedIssues((v) => !v)}
                className={`px-3 py-2 rounded-lg text-xs font-medium border ${
                  showResolvedIssues
                    ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {showResolvedIssues ? 'Hide resolved issues' : `Show resolved (${resolvedProblematicGroups.length})`}
              </button>
            </div>

            {problematicGroups.length === 0 ? (
              <p className="text-xs text-red-700">No problematic queries found in the current sample.</p>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                  <div className="bg-white border border-red-100 rounded p-2">
                    <div className="text-[11px] text-gray-500">Typo-map coverage</div>
                    <div className="text-sm font-semibold text-gray-900">{coverageStats.typoMap} / {problematicGroups.length}</div>
                  </div>
                  <div className="bg-white border border-red-100 rounded p-2">
                    <div className="text-[11px] text-gray-500">Alias-map coverage</div>
                    <div className="text-sm font-semibold text-gray-900">{coverageStats.aliasMap} / {problematicGroups.length}</div>
                  </div>
                  <div className="bg-white border border-red-100 rounded p-2">
                    <div className="text-[11px] text-gray-500">Intent coverage</div>
                    <div className="text-sm font-semibold text-gray-900">{coverageStats.intent} / {problematicGroups.length}</div>
                  </div>
                  <div className="bg-white border border-red-100 rounded p-2">
                    <div className="text-[11px] text-gray-500">Location-only coverage</div>
                    <div className="text-sm font-semibold text-gray-900">{coverageStats.locationOnlyFallback} / {problematicGroups.length}</div>
                  </div>
                </div>

                <div className="max-h-72 overflow-auto border border-red-100 rounded bg-white">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-red-50 z-10">
                    <tr className="text-left text-red-800 border-b border-red-200">
                      <th className="py-1.5 px-2">Priority</th>
                      <th className="py-1.5 px-2">Query</th>
                      <th className="py-1.5 px-2">Count</th>
                      <th className="py-1.5 px-2">Sessions</th>
                      <th className="py-1.5 px-2">Last Seen</th>
                      <th className="py-1.5 px-2">Coverage</th>
                      <th className="py-1.5 px-2">Sources</th>
                      <th className="py-1.5 px-2">Issue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {problematicGroups.map((row) => (
                      <tr key={row.normalizedQuery} className="border-b border-red-100 text-red-900 align-top">
                        <td className="py-1.5 px-2 font-mono">{row.priorityScore}</td>
                        <td className="py-1.5 px-2">
                          <div className="font-medium">{row.query}</div>
                          <div className="mt-1 flex flex-wrap gap-2 text-[11px]">
                            <a
                              href={buildExploreReplayUrl(row.query)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-700 hover:text-blue-900 underline"
                            >
                              Open search
                            </a>
                            <a
                              href={buildApiReplayUrl(row.query)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-gray-600 hover:text-gray-900 underline"
                            >
                              API
                            </a>
                          </div>
                        </td>
                        <td className="py-1.5 px-2 font-mono">{row.count}</td>
                        <td className="py-1.5 px-2 font-mono">{row.sessionCount}</td>
                        <td className="py-1.5 px-2">{new Date(row.lastSeen).toLocaleString('it-IT')}</td>
                        <td className="py-1.5 px-2">
                          <div className="flex flex-wrap gap-1">
                            {row.coverage.typoMap && <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">typo-map</span>}
                            {row.coverage.aliasMap && <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">alias-map</span>}
                            {row.coverage.intent && <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">intent</span>}
                            {row.coverage.locationOnlyFallback && <span className="px-1.5 py-0.5 rounded bg-violet-100 text-violet-800">location-only</span>}
                            {!row.coverage.typoMap && !row.coverage.aliasMap && !row.coverage.intent && !row.coverage.locationOnlyFallback && (
                              <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">none</span>
                            )}
                          </div>
                        </td>
                        <td className="py-1.5 px-2">{row.sources.join(', ')}</td>
                        <td className="py-1.5 px-2">
                          {verificationResults[row.normalizedQuery] && (
                            <div className="mb-2 text-[11px]">
                              {verificationResults[row.normalizedQuery].hasResults ? (
                                <div className="rounded bg-emerald-50 text-emerald-700 px-2 py-1 border border-emerald-200">
                                  Now returns {verificationResults[row.normalizedQuery].validCoordinates} mapped / {verificationResults[row.normalizedQuery].totalCount} total
                                  {verificationResults[row.normalizedQuery].resolvedName ? ` · ${verificationResults[row.normalizedQuery].resolvedName}` : ''}
                                </div>
                              ) : (
                                <div className="rounded bg-amber-50 text-amber-700 px-2 py-1 border border-amber-200">
                                  Still 0/0 on latest verify
                                </div>
                              )}
                            </div>
                          )}
                          <div className="flex flex-wrap items-center gap-1">
                            <button
                              onClick={() => verifyIssue(row)}
                              disabled={pendingVerification === row.normalizedQuery}
                              className="px-2 py-1 rounded text-[11px] font-medium bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                            >
                              {pendingVerification === row.normalizedQuery ? 'Verifying...' : 'Verify now'}
                            </button>
                          {resolvedIssueSet.has(row.normalizedQuery) ? (
                            <div className="flex items-center gap-1">
                            <button
                              onClick={() => updateIssueStatus(row, 'reopen')}
                              disabled={pendingIssueUpdate === row.normalizedQuery}
                              className="px-2 py-1 rounded text-[11px] font-medium bg-emerald-100 text-emerald-700 hover:bg-emerald-200 disabled:opacity-60"
                            >
                              Reopen
                            </button>
                              {resolvedIssueMap.get(row.normalizedQuery)?.reason && (
                                <span
                                  className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px]"
                                  title={resolvedIssueMap.get(row.normalizedQuery)?.reason}
                                >
                                  reason
                                </span>
                              )}
                            </div>
                          ) : (
                            <button
                              onClick={() => updateIssueStatus(row, 'resolve')}
                              disabled={pendingIssueUpdate === row.normalizedQuery}
                              className={`px-2 py-1 rounded text-[11px] font-medium disabled:opacity-60 ${verificationResults[row.normalizedQuery]?.hasResults ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                            >
                              {verificationResults[row.normalizedQuery]?.hasResults ? 'Mark resolved now' : 'Mark resolved'}
                            </button>
                          )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {sessions.length === 0 ? (
        <p className="text-gray-500 text-center py-12">No search logs yet.</p>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => {
            const isExpanded = expandedSessions.has(session.sessionKey);
            const uniqueQueries = [...new Set(session.logs.map(l => l.query))];
            return (
              <div key={session.sessionKey} className="border border-gray-200 rounded-lg overflow-hidden">
                {/* Session header */}
                <button
                  onClick={() => toggleSession(session.sessionKey)}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 transition-colors text-left"
                >
                  {isExpanded ? <CaretDown size={14} className="text-gray-400" /> : <CaretRight size={14} className="text-gray-400" />}
                  <span className="text-xs text-gray-500 font-mono whitespace-nowrap">
                    {new Date(session.startTime).toLocaleString('it-IT', {
                      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                  <span className="text-sm font-medium text-gray-900 truncate flex-1">
                    {uniqueQueries.slice(0, 3).join(' → ')}
                    {uniqueQueries.length > 3 && <span className="text-gray-400"> +{uniqueQueries.length - 3}</span>}
                  </span>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                    {session.queryCount} {session.queryCount === 1 ? 'query' : 'queries'}
                  </span>
                  <span className="text-xs text-gray-400 font-mono">{session.ip}</span>
                  {session.logs[0]?.userEmail && (
                    <span className="text-xs text-blue-600 truncate max-w-[150px]" title={session.logs[0].userEmail}>
                      {session.logs[0].userEmail}
                    </span>
                  )}
                </button>

                {/* Session logs table */}
                {isExpanded && (
                  <div className="border-t border-gray-200 overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="w-5"></th>
                          <th className="text-left px-3 py-2 font-medium text-gray-500 text-xs">Time</th>
                          <th className="text-left px-3 py-2 font-medium text-gray-500 text-xs">Query</th>
                          <th className="text-left px-3 py-2 font-medium text-gray-500 text-xs">Resolved</th>
                          <th className="text-left px-3 py-2 font-medium text-gray-500 text-xs">Source</th>
                          <th className="text-right px-3 py-2 font-medium text-gray-500 text-xs">Results</th>
                        </tr>
                      </thead>
                      <tbody>
                        {session.logs.map((log, i) => (
                          <LogRow key={i} log={log} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
