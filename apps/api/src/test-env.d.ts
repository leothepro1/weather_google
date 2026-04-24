import type { D1Migration } from '@cloudflare/vitest-pool-workers/config';
import type { Env } from './env.js';

declare module 'cloudflare:test' {
  // Augments vitest-pool-workers' `env` export with our concrete bindings
  // plus the TEST_MIGRATIONS fixture injected by vitest.config.ts.
  interface ProvidedEnv extends Env {
    TEST_MIGRATIONS: D1Migration[];
  }
}
