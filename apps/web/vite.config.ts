import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Dev-time proxy: the browser only ever sees the Vite origin. Fetches to
// /health, /api/*, and /auth/* are forwarded to the Worker on :8787 over
// localhost, avoiding cross-origin CORS + Codespaces tunnel quirks entirely.
// In production the web app is served from Cloudflare Pages and the fetches
// cross an origin boundary again — that's what the CORS middleware is for.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/health': 'http://localhost:8787',
      '/api': 'http://localhost:8787',
      '/auth': 'http://localhost:8787',
    },
  },
});
