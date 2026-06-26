'use client';

import { useEffect, useState } from 'react';
import { Key, Eye, EyeSlash, Pencil, Check, X, Spinner } from '@phosphor-icons/react';
import { API_KEY_DEFINITIONS } from '@/types';
import type { SystemSetting } from '@/types';

export default function ApiKeysPage() {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    const res = await fetch('/api/settings');
    const data = await res.json();
    setSettings(data.settings || []);
    setLoading(false);
  }

  function getValue(key: string): string {
    return settings.find((s) => s.settingKey === key)?.settingValue || '';
  }

  async function saveSetting(key: string) {
    setSaving(true);
    const existing = settings.find((s) => s.settingKey === key);
    const def = API_KEY_DEFINITIONS.find((d) => d.settingKey === key);

    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        settingKey: key,
        settingValue: editValue,
        category: def?.category || 'api_keys',
        description: def?.description,
        masked: def?.masked,
      }),
    });

    setEditingKey(null);
    setEditValue('');
    await fetchSettings();
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500">
        <Spinner size={20} className="animate-spin" />
        Loading settings...
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Key size={24} className="text-green-600" />
        <h1 className="text-2xl font-bold">API Keys</h1>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Manage API keys used by Faces of Plants. Keys are stored securely in DynamoDB and never exposed to end users.
      </p>

      <div className="space-y-4">
        {API_KEY_DEFINITIONS.map((def) => {
          const value = getValue(def.settingKey);
          const isEditing = editingKey === def.settingKey;
          const isShown = showValues[def.settingKey];

          return (
            <div key={def.settingKey} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{def.description}</h3>
                  <p className="text-xs text-gray-400 font-mono">{def.settingKey}</p>
                </div>
                {value ? (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                    Configured
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                    Not set
                  </span>
                )}
              </div>

              {isEditing ? (
                <div className="flex items-center gap-2 mt-3">
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    placeholder="Enter value"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    autoFocus
                  />
                  <button
                    onClick={() => saveSetting(def.settingKey)}
                    disabled={saving}
                    className="p-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    onClick={() => { setEditingKey(null); setEditValue(''); }}
                    className="p-2 rounded-lg bg-gray-200 text-gray-600 hover:bg-gray-300"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-3">
                  <div className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono text-gray-600 truncate">
                    {value
                      ? isShown || !def.masked
                        ? value
                        : '•'.repeat(Math.min(value.length, 30))
                      : '(not set)'}
                  </div>
                  {def.masked && value && (
                    <button
                      onClick={() => setShowValues((prev) => ({ ...prev, [def.settingKey]: !prev[def.settingKey] }))}
                      className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                    >
                      {isShown ? <EyeSlash size={16} /> : <Eye size={16} />}
                    </button>
                  )}
                  <button
                    onClick={() => { setEditingKey(def.settingKey); setEditValue(value); }}
                    className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                  >
                    <Pencil size={16} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
