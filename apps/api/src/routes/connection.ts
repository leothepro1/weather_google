import { Hono } from 'hono';
import type { AppBindings } from '../env.js';
import {
  clearRefreshToken,
  loadRefreshToken,
  revokeRefreshToken,
} from '../services/googleAds/oauth.js';

export const connectionRoute = new Hono<AppBindings>()
  .get('/status', async (c) => {
    const token = await loadRefreshToken(c.env.DB);
    return c.json(
      token
        ? { connected: true as const, customerId: c.env.GOOGLE_ADS_CUSTOMER_ID }
        : { connected: false as const },
    );
  })
  .delete('/', async (c) => {
    const token = await loadRefreshToken(c.env.DB);
    if (token) {
      // Best-effort revoke — we clear the DB row regardless.
      try {
        await revokeRefreshToken(token);
      } catch (e) {
        console.warn('[connection] revoke failed', e);
      }
    }
    await clearRefreshToken(c.env.DB);
    return c.json({ connected: false as const });
  });
