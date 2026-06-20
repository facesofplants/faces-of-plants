import React, { useEffect, useState } from 'react';

import { type DataSource } from '../types/dataSource';

const QUERY_API_URL = '/api/data-sources';

const QueryDataSources: React.FC = () => {
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(QUERY_API_URL)
      .then((res) => res.json())
      .then((data) => {
        setDataSources(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-2">Data Sources</h2>
      {loading && <div>Loading...</div>}
      {error && <div className="text-red-500">Error: {error}</div>}
      <ul className="space-y-2">
        {dataSources.map((ds) => (
          <li key={ds.id} className="border p-2 rounded">
            <div className="font-semibold">{ds.name}</div>
            <div>ID: {ds.id}</div>
            <div>Provider: {ds.provider}</div>
            <div>is_active: {ds.is_active ? 'Yes' : 'No'}</div>
            <div>
              URL:{' '}
              <a href={ds.url} className="text-blue-600 underline">
                {ds.url}
              </a>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default QueryDataSources;
