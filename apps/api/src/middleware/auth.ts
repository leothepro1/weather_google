import type { MiddlewareHandler } from 'hono';
import type { AppBindings } from '../env.js';

export const requireAdminToken: MiddlewareHandler<AppBindings> = async (c, next) => {
  const header = c.req.header('Authorization') ?? '';
  const expected = c.env.ADMIN_TOKEN;

  if (!expected) {
    return c.json({ error: 'server_misconfigured' }, 500);
  }

  const [scheme, token] = header.split(' ', 2);
  if (scheme !== 'Bearer' || !token || token !== expected) {
    return c.json({ error: 'unauthorized' }, 401);
  }

  await next();
};
