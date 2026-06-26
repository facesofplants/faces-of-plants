'use client';

import { FileText, Plus, Trash, FloppyDisk, Spinner, ArrowsDownUp } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';

const DEFAULT_EXAMPLES = [
  'Quercus in Tuscany',
  'Cherry blossoms in Japan',
  'Orchids in Colombia',
  'Betula pendula',
];

export default function ContentPage() {
  const [examples, setExamples] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newQuery, setNewQuery] = useState('');

  useEffect(() => {
    loadExamples();
  }, []);

  async function loadExamples() {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      const setting = (data.settings || []).find(
        (s: { settingKey: string }) => s.settingKey === 'content:homepage_examples',
      );
      if (setting?.settingValue) {
        const parsed = JSON.parse(setting.settingValue);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setExamples(parsed);
          setLoading(false);
          return;
        }
      }
    } catch {
      // fall through
    }
    setExamples(DEFAULT_EXAMPLES);
    setLoading(false);
  }

  async function saveExamples(newExamples: string[]) {
    setSaving(true);
    setSaved(false);
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settingKey: 'content:homepage_examples',
          settingValue: JSON.stringify(newExamples),
          category: 'system',
          description: 'Homepage example queries (JSON array)',
        }),
      });
      setExamples(newExamples);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // ignore
    }
    setSaving(false);
  }

  function addQuery() {
    const trimmed = newQuery.trim();
    if (!trimmed || examples.includes(trimmed)) return;
    const updated = [...examples, trimmed];
    setNewQuery('');
    void saveExamples(updated);
  }

  function removeQuery(index: number) {
    const updated = examples.filter((_, i) => i !== index);
    void saveExamples(updated);
  }

  function moveQuery(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= examples.length) return;
    const updated = [...examples];
    [updated[index], updated[target]] = [updated[target], updated[index]];
    void saveExamples(updated);
  }

  function resetToDefaults() {
    void saveExamples(DEFAULT_EXAMPLES);
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500">
        <Spinner size={20} className="animate-spin" />
        Loading...
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <FileText size={24} className="text-green-600" />
        <h1 className="text-2xl font-bold">Content</h1>
      </div>

      {/* Homepage Example Queries */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Homepage Example Queries</h3>
            <p className="text-xs text-gray-500 mt-1">
              These appear as suggestion pills on the homepage. Users can click them to start a search.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {saved && (
              <span className="text-xs text-green-600 font-medium">Saved</span>
            )}
            {saving && (
              <Spinner size={16} className="animate-spin text-gray-400" />
            )}
            <button
              onClick={resetToDefaults}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              Reset defaults
            </button>
          </div>
        </div>

        {/* Query list */}
        <div className="space-y-2 mb-4">
          {examples.map((query, index) => (
            <div
              key={index}
              className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 group"
            >
              <span className="text-xs text-gray-400 w-5 text-center font-mono">{index + 1}</span>
              <span className="flex-1 text-sm text-gray-800">{query}</span>
              <button
                onClick={() => moveQuery(index, -1)}
                disabled={index === 0}
                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Move up"
              >
                <ArrowsDownUp size={14} />
              </button>
              <button
                onClick={() => removeQuery(index)}
                className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remove"
              >
                <Trash size={14} />
              </button>
            </div>
          ))}
          {examples.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">
              No example queries configured. Add one below or reset to defaults.
            </p>
          )}
        </div>

        {/* Add new */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addQuery();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={newQuery}
            onChange={(e) => setNewQuery(e.target.value)}
            placeholder="Add a new example query..."
            className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
          <button
            type="submit"
            disabled={!newQuery.trim() || saving}
            className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={14} />
            Add
          </button>
        </form>
      </div>
    </div>
  );
}
