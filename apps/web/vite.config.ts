import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/auth': 'http://localhost:4000',
      '/agents': 'http://localhost:4000',
      '/runs': 'http://localhost:4000',
      '/approvals': 'http://localhost:4000',
      '/health': 'http://localhost:4000',
      '/metrics': 'http://localhost:4000',
      '/settings': 'http://localhost:4000',
    },
  },
});
