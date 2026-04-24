import type { ConnectionStatus } from '@wbm/shared';
import { useCallback, useEffect, useState } from 'react';
import {
  disconnectGoogleAds,
  getConnectionStatus,
  googleOAuthStartUrl,
} from '../lib/api.js';

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; status: ConnectionStatus }
  | { kind: 'error'; message: string };

interface Props {
  onStatusChange?: (status: ConnectionStatus) => void;
}

export function ConnectionPanel({ onStatusChange }: Props) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const status = await getConnectionStatus();
      setState({ kind: 'ready', status });
    } catch (e) {
      setState({ kind: 'error', message: e instanceof Error ? e.message : 'unknown error' });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const connect = () => {
    window.location.href = googleOAuthStartUrl();
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      const status = await disconnectGoogleAds();
      setState({ kind: 'ready', status });
      onStatusChange?.(status);
    } catch (e) {
      setState({ kind: 'error', message: e instanceof Error ? e.message : 'unknown error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-lg border bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Google Ads connection
      </h2>
      <div className="mt-2">
        {state.kind === 'loading' && <p className="text-sm text-slate-500">Checking…</p>}
        {state.kind === 'error' && (
          <p className="text-sm text-red-600">Status check failed: {state.message}</p>
        )}
        {state.kind === 'ready' && state.status.connected ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm">
                Connected as{' '}
                <code className="font-mono text-slate-800">{state.status.customerId}</code>
              </p>
            </div>
            <button
              onClick={disconnect}
              disabled={busy}
              className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100 disabled:opacity-50"
            >
              Disconnect
            </button>
          </div>
        ) : state.kind === 'ready' ? (
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">Not connected.</p>
            <button
              onClick={connect}
              className="rounded bg-slate-900 px-3 py-1 text-sm text-white hover:bg-slate-700"
            >
              Connect Google Ads
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
