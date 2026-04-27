import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const API_PATHS = [
  '/auth', '/agents', '/runs', '/approvals', '/health', '/metrics',
  '/settings', '/integrations', '/dashboard', '/mcp', '/knowledge-base', '/tasks',
];

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: Object.fromEntries(
      API_PATHS.map((p) => [
        p,
        {
          target: 'http://localhost:4000',
          changeOrigin: true,
          bypass(req: { headers: Record<string, string | undefined> }) {
            // Page navigations send Accept: text/html — serve the SPA, not the API
            if (req.headers['accept']?.includes('text/html')) return '/index.html';
          },
        },
      ]),
    ),
  },
});
