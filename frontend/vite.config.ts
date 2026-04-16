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
  server: {
    host: true,
  },
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        // Single vendor chunk: all node_modules in one file, app code in
        // another. Finer splits (react / ccc / crypto) cause circular-init
        // TDZ errors because @ckb-ccc/connector-react creates React
        // contexts at module top level, and CCC internally cross-references
        // ethers/noble at init time. Keeping all deps together avoids
        // chunk-ordering issues while still giving us the key win:
        // app-only changes re-download ~25KB instead of the full bundle.
        manualChunks(id) {
          if (id.includes('node_modules')) return 'vendor';
        },
      },
    },
  },
  resolve: {
    dedupe: ['@ckb-ccc/core'],
  },
});
