import { defineConfig } from 'vite';
import path from 'path';

// Builds the embeddable live chat widget as a single IIFE bundle.
// Output: apps/api/public/livechat.js (served by Fastify at GET /livechat.js).
// Entry: apps/web/widget/index.ts (vanilla TS, no React).
export default defineConfig({
  publicDir: false,
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    outDir: path.resolve(__dirname, '../api/public'),
    emptyOutDir: false,
    minify: 'esbuild',
    target: 'es2017',
    lib: {
      entry: path.resolve(__dirname, 'widget/index.ts'),
      name: 'LivechatWidget',
      fileName: () => 'livechat.js',
      formats: ['iife'],
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
