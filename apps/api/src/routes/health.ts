import { Hono } from 'hono';
import type { AppBindings } from '../env.js';

export const healthRoute = new Hono<AppBindings>().get('/', (c) =>
  c.json({ ok: true, version: c.env.APP_VERSION }),
);
