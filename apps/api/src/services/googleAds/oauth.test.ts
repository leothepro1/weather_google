import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  _clearAccessTokenCacheForTesting,
  buildAuthorizationUrl,
  consumeOAuthState,
  createOAuthState,
  exchangeCodeForTokens,
  getAccessToken,
} from './oauth.js';

beforeEach(async () => {
  _clearAccessTokenCacheForTesting();
  await env.DB.prepare("DELETE FROM config WHERE key LIKE 'oauth_state:%'").run();
  await env.DB.prepare("DELETE FROM config WHERE key = 'google_refresh_token'").run();
});

describe('buildAuthorizationUrl', () => {
  it('includes every required OAuth param', () => {
    const url = new URL(buildAuthorizationUrl(env, 'abc123'));
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('client_id')).toBe(env.GOOGLE_OAUTH_CLIENT_ID);
    expect(url.searchParams.get('redirect_uri')).toBe(env.GOOGLE_OAUTH_REDIRECT_URI);
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/adwords');
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('prompt')).toBe('consent');
    expect(url.searchParams.get('state')).toBe('abc123');
  });
});

describe('state lifecycle', () => {
  it('creates a state token and validates it once', async () => {
    const now = Date.now();
    const token = await createOAuthState(env.DB, now);
    expect(token).toHaveLength(64);
    expect(await consumeOAuthState(env.DB, token, now)).toBe(true);
    // second consume returns false — token is single-use.
    expect(await consumeOAuthState(env.DB, token, now)).toBe(false);
  });

  it('rejects expired state tokens', async () => {
    const t0 = Date.now();
    const token = await createOAuthState(env.DB, t0);
    const eleven_min_later = t0 + 11 * 60 * 1000;
    expect(await consumeOAuthState(env.DB, token, eleven_min_later)).toBe(false);
  });

  it('rejects unknown state tokens', async () => {
    expect(await consumeOAuthState(env.DB, 'never-issued', Date.now())).toBe(false);
    expect(await consumeOAuthState(env.DB, '', Date.now())).toBe(false);
  });
});

describe('exchangeCodeForTokens', () => {
  it('posts the expected form body and returns parsed tokens', async () => {
    const fetchStub = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = init?.body instanceof URLSearchParams ? init.body : new URLSearchParams();
      expect(body.get('grant_type')).toBe('authorization_code');
      expect(body.get('code')).toBe('THE_CODE');
      expect(body.get('client_id')).toBe(env.GOOGLE_OAUTH_CLIENT_ID);
      return new Response(
        JSON.stringify({
          access_token: 'acc-1',
          refresh_token: 'ref-1',
          expires_in: 3600,
          token_type: 'Bearer',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });
    const tok = await exchangeCodeForTokens(env, 'THE_CODE', fetchStub as unknown as typeof fetch);
    expect(tok.refresh_token).toBe('ref-1');
    expect(fetchStub).toHaveBeenCalledTimes(1);
  });

  it('throws on non-2xx responses', async () => {
    const fetchStub = vi.fn(
      async () => new Response('invalid_grant', { status: 400 }),
    );
    await expect(
      exchangeCodeForTokens(env, 'bad', fetchStub as unknown as typeof fetch),
    ).rejects.toThrow(/400/);
  });
});

describe('getAccessToken caching', () => {
  it('caches the access token until near expiry, then refreshes', async () => {
    const fetchStub = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ access_token: 'acc-X', expires_in: 3600, token_type: 'Bearer' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    );
    const t0 = 1_000_000;
    const first = await getAccessToken(env, 'ref-xyz', t0, fetchStub as unknown as typeof fetch);
    const second = await getAccessToken(
      env,
      'ref-xyz',
      t0 + 60_000,
      fetchStub as unknown as typeof fetch,
    );
    expect(first).toBe('acc-X');
    expect(second).toBe('acc-X');
    expect(fetchStub).toHaveBeenCalledTimes(1);

    // within the 60s skew — refreshes.
    await getAccessToken(
      env,
      'ref-xyz',
      t0 + 3600_000 - 30_000,
      fetchStub as unknown as typeof fetch,
    );
    expect(fetchStub).toHaveBeenCalledTimes(2);
  });
});
