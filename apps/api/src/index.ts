import { Hono } from 'hono';
import type { AppBindings, Env } from './env.js';
import { requireAdminToken } from './middleware/auth.js';
import { healthRoute } from './routes/health.js';
import { createGoogleAdsClient } from './services/googleAds/index.js';
import type { GoogleAdsClient } from './services/googleAds/index.js';
import { OpenMeteoClient } from './services/weather/openMeteo.js';
import type { WeatherClient } from './services/weather/types.js';

export interface AppDeps {
  googleAds?: GoogleAdsClient;
  weather?: WeatherClient;
}

// Factory so tests can inject fakes. Prod wiring lives in `fetch` below.
export function createApp(deps: AppDeps = {}) {
  const app = new Hono<AppBindings>();

  app.use('*', async (c, next) => {
    c.set('googleAds', deps.googleAds ?? createGoogleAdsClient(c.env));
    c.set('weather', deps.weather ?? new OpenMeteoClient());
    await next();
  });

  app.route('/health', healthRoute);

  app.use('*', requireAdminToken);

  // Future phases mount their routers here:
  //   app.route('/campaigns', campaignsRoute);
  //   app.route('/buckets', bucketsRoute);

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
