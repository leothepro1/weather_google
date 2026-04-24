import { Hono } from 'hono';
import type { AppBindings } from '../env.js';
import {
  buildAuthorizationUrl,
  consumeOAuthState,
  createOAuthState,
  exchangeCodeForTokens,
  storeRefreshToken,
} from '../services/googleAds/oauth.js';

// /auth/google
//
// Two endpoints with different authentication models:
//
// - /start is triggered by a full-page browser navigation, which cannot
//   carry an Authorization header. We require ?token=<ADMIN_TOKEN> as a
//   query param instead. This is acceptable for a single-user tool — the
//   token ends up in the server log for this one URL, and the referrer
//   to Google is stripped by the accounts.google.com redirect.
//
// - /callback is hit by Google's redirect and cannot carry any header we
//   control. It's protected by the `state` param issued at /start, which
//   is random, single-use, and TTL-bounded in D1.
export const authRoute = new Hono<AppBindings>()
  .get('/start', async (c) => {
    if (c.req.query('token') !== c.env.ADMIN_TOKEN) {
      return c.json({ error: 'unauthorized' }, 401);
    }
    const state = await createOAuthState(c.env.DB, Date.now());
    const url = buildAuthorizationUrl(c.env, state);
    return c.redirect(url, 302);
  })
  .get('/callback', async (c) => {
    const code = c.req.query('code');
    const state = c.req.query('state');
    const error = c.req.query('error');

    if (error) {
      return c.html(callbackPage(`Google returned an error: ${error}`), 400);
    }
    if (!code || !state) {
      return c.html(callbackPage('Missing code or state parameter.'), 400);
    }
    if (!(await consumeOAuthState(c.env.DB, state, Date.now()))) {
      return c.html(callbackPage('Invalid or expired state.'), 400);
    }

    let tokens;
    try {
      tokens = await exchangeCodeForTokens(c.env, code);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return c.html(callbackPage(`Token exchange failed: ${msg}`), 500);
    }

    if (!tokens.refresh_token) {
      return c.html(
        callbackPage(
          'Google did not return a refresh token. Revoke the app in your Google account and retry.',
        ),
        500,
      );
    }

    await storeRefreshToken(c.env.DB, tokens.refresh_token, Date.now());
    return c.html(
      callbackPage('Connected — redirecting to the dashboard…', {
        ok: true,
        redirectTo: c.env.WEB_ORIGIN,
      }),
    );
  });

function callbackPage(
  message: string,
  opts: { ok?: boolean; redirectTo?: string } = {},
): string {
  const color = opts.ok ? '#16a34a' : '#dc2626';
  const refresh =
    opts.ok && opts.redirectTo
      ? `<meta http-equiv="refresh" content="2;url=${escapeHtml(opts.redirectTo)}" />`
      : '';
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Google Ads connection</title>${refresh}
<style>body{font-family:system-ui;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f8fafc;color:#0f172a}
.card{max-width:420px;padding:2rem;border-radius:.75rem;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.msg{color:${color};font-weight:500}</style></head>
<body><div class="card"><h1 style="margin-top:0">Google Ads connection</h1><p class="msg">${escapeHtml(
    message,
  )}</p></div></body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
