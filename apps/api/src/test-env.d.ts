import type { Env } from './env.js';

declare module 'cloudflare:test' {
  // Augments vitest-pool-workers' `env` export with our concrete bindings.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface ProvidedEnv extends Env {}
}
