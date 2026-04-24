import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { AppBindings, Env } from './env.js';
import { requireAdminToken } from './middleware/auth.js';
import { authRoute } from './routes/auth.js';
import { campaignsRoute } from './routes/campaigns.js';
import { connectionRoute } from './routes/connection.js';
import { healthRoute } from './routes/health.js';
import { createGoogleAdsClient } from './services/googleAds/index.js';
import type { GoogleAdsClient } from './services/googleAds/index.js';
import { OpenMeteoClient } from './services/weather/openMeteo.js';
import type { WeatherClient } from './services/weather/types.js';

export interface AppDeps {
  googleAds?: GoogleAdsClient;
  weather?: WeatherClient;
}

export function createApp(deps: AppDeps = {}) {
  const app = new Hono<AppBindings>();

  app.use('*', async (c, next) => {
    c.set('googleAds', deps.googleAds ?? createGoogleAdsClient(c.env));
    c.set('weather', deps.weather ?? new OpenMeteoClient());
    await next();
  });

  // CORS applies to every browser-reachable route — /api/* AND /health
  // (the dashboard pings /health to verify the admin token). Must come
  // before auth so preflight OPTIONS requests succeed without Authorization.
  // Navigation-only endpoints (/auth/google/*) don't hit CORS from fetch,
  // so the extra headers on them are harmless.
  app.use('*', (c, next) =>
    cors({
      origin: c.env.WEB_ORIGIN,
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Authorization', 'Content-Type'],
    })(c, next),
  );

  // Public endpoints first.
  app.route('/health', healthRoute);
  // /auth/google/start is self-authed via ?token=; /callback is state-authed.
  app.route('/auth/google', authRoute);

  // Admin bearer gate applies to everything below.
  app.use('*', requireAdminToken);

  app.route('/api/connection', connectionRoute);
  app.route('/api/campaigns', campaignsRoute);

  app.notFound((c) => c.json({ error: 'not_found' }, 404));
  app.onError((err, c) => {
    console.error('[api] unhandled error', err);
    return c.json({ error: 'internal_error' }, 500);
  });

  return app;
}

const app = createApp();

export default {
  fetch: (req: Request, env: Env, ctx: ExecutionContext) => app.fetch(req, env, ctx),
} satisfies ExportedHandler<Env>;
