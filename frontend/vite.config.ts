import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

const BUILD_ID = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: ['buffer', 'crypto', 'stream', 'util', 'process'],
      globals: { Buffer: true, global: true, process: true },
    }),
  ],
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  build: { target: 'es2020' },
  resolve: {
    dedupe: ['@ckb-ccc/core'],
  },
});
