'use client';

import { useEffect, useState } from 'react';
import { ToggleLeft, Spinner } from '@phosphor-icons/react';
import { FEATURE_FLAGS } from '@/types';
import type { SystemSetting } from '@/types';

export default function FeaturesPage() {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    const res = await fetch('/api/settings');
    const data = await res.json();
    setSettings(data.settings || []);
    setLoading(false);
  }

  function isEnabled(key: string): boolean {
    const setting = settings.find((s) => s.settingKey === key);
    return setting?.settingValue === 'true';
  }

  async function toggleFeature(key: string) {
    setSaving(key);
    const newValue = isEnabled(key) ? 'false' : 'true';

    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        settingKey: key,
        settingValue: newValue,
        category: 'features',
      }),
    });

    await fetchSettings();
    setSaving(null);
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500">
        <Spinner size={20} className="animate-spin" />
        Loading features...
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <ToggleLeft size={24} className="text-green-600" />
        <h1 className="text-2xl font-bold">Feature Flags</h1>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Toggle features on or off for all users.
      </p>

      <div className="space-y-3">
        {FEATURE_FLAGS.map((def) => {
          const enabled = isEnabled(def.settingKey);
          const isSaving = saving === def.settingKey;

          return (
            <div key={def.settingKey} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">{def.description}</h3>
                <p className="text-xs text-gray-400 font-mono">{def.settingKey}</p>
              </div>
              <button
                onClick={() => toggleFeature(def.settingKey)}
                disabled={isSaving}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  enabled ? 'bg-green-600' : 'bg-gray-300'
                } ${isSaving ? 'opacity-50' : ''}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
