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
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (/react|react-dom|react-router|@remix-run/.test(id)) return 'vendor-react';
          if (/@ckbfs/.test(id)) return 'vendor-ckbfs';
          if (/@ckb-ccc/.test(id)) return 'vendor-ccc';
          if (/ethers|@noble|hash-wasm|bn\.js|elliptic|brorand|asn1/.test(id)) return 'vendor-crypto';
          if (/marked|dompurify|axios|pako/.test(id)) return 'vendor-util';
        },
      },
    },
  },
  resolve: {
    dedupe: ['@ckb-ccc/core'],
  },
});
