import type { GoogleAdsCampaignView } from '@wbm/shared';
import { useEffect, useState } from 'react';
import { ApiError, getCampaigns } from '../lib/api.js';
import { formatMicros } from '../lib/format.js';

type State =
  | { kind: 'loading' }
  | { kind: 'list'; campaigns: GoogleAdsCampaignView[] }
  | { kind: 'not_connected' }
  | { kind: 'error'; message: string };

interface Props {
  // Bump to re-fetch (e.g. after connect/disconnect).
  refreshKey: number;
}

export function CampaignsTable({ refreshKey }: Props) {
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });
    getCampaigns()
      .then((res) => {
        if (!cancelled) setState({ kind: 'list', campaigns: res.campaigns });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 412) {
          setState({ kind: 'not_connected' });
          return;
        }
        setState({
          kind: 'error',
          message: err instanceof Error ? err.message : 'unknown error',
        });
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return (
    <section className="rounded-lg border bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Campaigns</h2>
      <div className="mt-2">
        {state.kind === 'loading' && <p className="text-sm text-slate-500">Loading…</p>}
        {state.kind === 'not_connected' && (
          <p className="text-sm text-slate-600">Connect Google Ads to see campaigns.</p>
        )}
        {state.kind === 'error' && (
          <p className="text-sm text-red-600">Failed to load campaigns: {state.message}</p>
        )}
        {state.kind === 'list' && state.campaigns.length === 0 && (
          <p className="text-sm text-slate-500">No campaigns.</p>
        )}
        {state.kind === 'list' && state.campaigns.length > 0 && (
          <table className="mt-2 w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4 font-medium">ID</th>
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium text-right">Daily budget</th>
                <th className="py-2 pr-4 font-medium">Currency</th>
              </tr>
            </thead>
            <tbody>
              {state.campaigns.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="py-2 pr-4 font-mono text-xs text-slate-600">{c.id}</td>
                  <td className="py-2 pr-4">{c.name}</td>
                  <td className="py-2 pr-4">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="py-2 pr-4 text-right font-mono">
                    {formatMicros(c.dailyBudgetMicros, c.currencyCode)}
                  </td>
                  <td className="py-2 pr-4 text-slate-600">{c.currencyCode}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status: GoogleAdsCampaignView['status'] }) {
  const cls =
    status === 'ENABLED'
      ? 'bg-green-100 text-green-800'
      : status === 'PAUSED'
        ? 'bg-amber-100 text-amber-800'
        : 'bg-slate-100 text-slate-700';
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${cls}`}>{status}</span>
  );
}
