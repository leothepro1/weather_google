import { Hono } from 'hono';
import type { AppBindings } from '../env.js';
import { NotConnectedError } from '../services/googleAds/errors.js';

export const campaignsRoute = new Hono<AppBindings>().get('/', async (c) => {
  const client = c.var.googleAds;
  try {
    const campaigns = await client.listCampaigns();
    return c.json({ campaigns });
  } catch (e) {
    if (e instanceof NotConnectedError) {
      return c.json({ error: 'not_connected' }, 412);
    }
    const message = e instanceof Error ? e.message : 'unknown error';
    console.error('[campaigns] list failed', e);
    return c.json({ error: 'google_ads_error', message }, 502);
  }
});
