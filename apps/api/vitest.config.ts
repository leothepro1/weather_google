import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    include: ['src/**/*.test.ts'],
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.toml' },
        miniflare: {
          bindings: {
            ADMIN_TOKEN: 'test-token',
            GOOGLE_ADS_DEVELOPER_TOKEN: 'test',
            GOOGLE_OAUTH_CLIENT_ID: 'test',
            GOOGLE_OAUTH_CLIENT_SECRET: 'test',
            GOOGLE_ADS_LOGIN_CUSTOMER_ID: 'test',
            GOOGLE_ADS_CUSTOMER_ID: 'test',
            GOOGLE_OAUTH_REDIRECT_URI: 'http://localhost:8787/auth/google/callback',
          },
        },
      },
    },
  },
});
