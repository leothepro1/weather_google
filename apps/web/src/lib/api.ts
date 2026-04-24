import type { CampaignListResponse, ConnectionStatus } from '@wbm/shared';
import { clearToken, getToken } from './auth.js';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });

  if (res.status === 401) {
    clearToken();
    throw new ApiError('unauthorized', 401);
  }
  if (!res.ok) {
    throw new ApiError(`request failed: ${res.status}`, res.status);
  }
  return (await res.json()) as T;
}

export interface HealthResponse {
  ok: boolean;
  version: string;
}

export function getHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>('/health');
}

export function getConnectionStatus(): Promise<ConnectionStatus> {
  return apiFetch<ConnectionStatus>('/api/connection/status');
}

export function disconnectGoogleAds(): Promise<ConnectionStatus> {
  return apiFetch<ConnectionStatus>('/api/connection', { method: 'DELETE' });
}

export function getCampaigns(): Promise<CampaignListResponse> {
  return apiFetch<CampaignListResponse>('/api/campaigns');
}

// URL for the full-page navigation that kicks off the OAuth flow. Admin
// token is passed as a query param because a GET navigation can't carry
// an Authorization header.
export function googleOAuthStartUrl(): string {
  const token = getToken() ?? '';
  return `${BASE_URL}/auth/google/start?token=${encodeURIComponent(token)}`;
}
