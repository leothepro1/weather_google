import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, getHealth, type HealthResponse } from '../lib/api.js';
import { clearToken } from '../lib/auth.js';

export function Dashboard() {
  const navigate = useNavigate();
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getHealth()
      .then((h) => {
        if (!cancelled) setHealth(h);
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
      <header className="flex items-center justify-between border-b bg-white px-6 py-4 shadow-sm">
        <h1 className="text-lg font-semibold">Weather Budget Modifier</h1>
        <button
          onClick={logout}
          className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100"
        >
          Log out
        </button>
      </header>
      <main className="p-6">
        {error ? (
          <p className="text-red-600">API error: {error}</p>
        ) : health ? (
          <p className="text-sm text-slate-600">
            API ok — version <code className="font-mono">{health.version}</code>
          </p>
        ) : (
          <p className="text-sm text-slate-500">Checking API…</p>
        )}
      </main>
    </div>
  );
}
