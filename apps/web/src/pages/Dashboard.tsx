import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CampaignsTable } from '../components/CampaignsTable.js';
import { ConnectionPanel } from '../components/ConnectionPanel.js';
import { ApiError, getHealth } from '../lib/api.js';
import { clearToken } from '../lib/auth.js';

export function Dashboard() {
  const navigate = useNavigate();
  const [tokenValid, setTokenValid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getHealth()
      .then(() => {
        if (!cancelled) setTokenValid(true);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          navigate('/login', { replace: true });
          return;
        }
        setError(err instanceof Error ? err.message : 'unknown error');
      });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const logout = () => {
    clearToken();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-end border-b bg-white px-6 py-4 shadow-sm">
        <button
          onClick={logout}
          className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100"
        >
          Log out
        </button>
      </header>
      <main className="mx-auto max-w-4xl space-y-4 p-6">
        {error && <p className="text-sm text-red-600">API error: {error}</p>}
        {tokenValid && (
          <>
            <ConnectionPanel onStatusChange={() => setRefreshKey((k) => k + 1)} />
            <CampaignsTable refreshKey={refreshKey} />
          </>
        )}
      </main>
    </div>
  );
}
