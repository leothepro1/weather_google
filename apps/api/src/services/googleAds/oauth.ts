import { NotConnectedError } from './errors.js';

const CONFIG_KEY_REFRESH_TOKEN = 'google_refresh_token';
const CONFIG_KEY_STATE_PREFIX = 'oauth_state:';
const STATE_TTL_MS = 10 * 60 * 1000;

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const ADS_SCOPE = 'https://www.googleapis.com/auth/adwords';

export interface OAuthEnv {
  GOOGLE_OAUTH_CLIENT_ID: string;
  GOOGLE_OAUTH_CLIENT_SECRET: string;
  GOOGLE_OAUTH_REDIRECT_URI: string;
}

// ---- State --------------------------------------------------------------
// Random token, stored in D1 `config` under `oauth_state:<token>` with the
// write timestamp. On callback we look it up, verify freshness, and delete.

function randomStateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function createOAuthState(db: D1Database, now: number): Promise<string> {
  const token = randomStateToken();
  await db
    .prepare('INSERT INTO config (key, value, updated_at) VALUES (?, ?, ?)')
    .bind(`${CONFIG_KEY_STATE_PREFIX}${token}`, '1', now)
    .run();
  return token;
}

export async function consumeOAuthState(
  db: D1Database,
  token: string,
  now: number,
): Promise<boolean> {
  if (!token) return false;
  const row = await db
    .prepare('SELECT updated_at FROM config WHERE key = ?')
    .bind(`${CONFIG_KEY_STATE_PREFIX}${token}`)
    .first<{ updated_at: number }>();
  if (!row) return false;

  await db
    .prepare('DELETE FROM config WHERE key = ?')
    .bind(`${CONFIG_KEY_STATE_PREFIX}${token}`)
    .run();

  return now - row.updated_at <= STATE_TTL_MS;
}

// ---- Authorization URL --------------------------------------------------

export function buildAuthorizationUrl(env: OAuthEnv, state: string): string {
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set('client_id', env.GOOGLE_OAUTH_CLIENT_ID);
  url.searchParams.set('redirect_uri', env.GOOGLE_OAUTH_REDIRECT_URI);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', ADS_SCOPE);
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('state', state);
  return url.toString();
}

// ---- Token exchange -----------------------------------------------------

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

async function postToken(body: URLSearchParams, fetchImpl: typeof fetch): Promise<TokenResponse> {
  const res = await fetchImpl(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`google oauth token exchange failed (${res.status}): ${text}`);
  }
  return JSON.parse(text) as TokenResponse;
}

export async function exchangeCodeForTokens(
  env: OAuthEnv,
  code: string,
  fetchImpl: typeof fetch = fetch,
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    client_id: env.GOOGLE_OAUTH_CLIENT_ID,
    client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET,
    redirect_uri: env.GOOGLE_OAUTH_REDIRECT_URI,
    grant_type: 'authorization_code',
    code,
  });
  return postToken(body, fetchImpl);
}

export async function exchangeRefreshForAccess(
  env: OAuthEnv,
  refreshToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    client_id: env.GOOGLE_OAUTH_CLIENT_ID,
    client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
  return postToken(body, fetchImpl);
}

export async function revokeRefreshToken(
  refreshToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  await fetchImpl(GOOGLE_REVOKE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token: refreshToken }),
  });
}

// ---- Refresh token storage ---------------------------------------------

export async function storeRefreshToken(
  db: D1Database,
  refreshToken: string,
  now: number,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO config (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .bind(CONFIG_KEY_REFRESH_TOKEN, refreshToken, now)
    .run();
}

export async function loadRefreshToken(db: D1Database): Promise<string | null> {
  const row = await db
    .prepare('SELECT value FROM config WHERE key = ?')
    .bind(CONFIG_KEY_REFRESH_TOKEN)
    .first<{ value: string }>();
  return row?.value ?? null;
}

export async function clearRefreshToken(db: D1Database): Promise<void> {
  await db.prepare('DELETE FROM config WHERE key = ?').bind(CONFIG_KEY_REFRESH_TOKEN).run();
}

export async function requireRefreshToken(db: D1Database): Promise<string> {
  const token = await loadRefreshToken(db);
  if (!token) throw new NotConnectedError();
  return token;
}

// ---- In-memory access token cache --------------------------------------
// Keyed by refresh token so rotating the refresh token invalidates the
// cache entry. Scoped to the Worker isolate — cold starts skip it.

interface CachedAccessToken {
  accessToken: string;
  expiresAtMs: number;
}

const ACCESS_TOKEN_CACHE = new Map<string, CachedAccessToken>();
const REFRESH_SKEW_MS = 60_000;

export async function getAccessToken(
  env: OAuthEnv,
  refreshToken: string,
  now: number = Date.now(),
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const cached = ACCESS_TOKEN_CACHE.get(refreshToken);
  if (cached && cached.expiresAtMs - now > REFRESH_SKEW_MS) {
    return cached.accessToken;
  }
  const token = await exchangeRefreshForAccess(env, refreshToken, fetchImpl);
  ACCESS_TOKEN_CACHE.set(refreshToken, {
    accessToken: token.access_token,
    expiresAtMs: now + token.expires_in * 1000,
  });
  return token.access_token;
}

export function _clearAccessTokenCacheForTesting(): void {
  ACCESS_TOKEN_CACHE.clear();
}
