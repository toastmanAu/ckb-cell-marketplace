# CellSwap Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a forkable testnet marketplace SPA at `frontend/` where users can browse, buy, mint, list, and cancel CKB cell content — the full CellSwap MVP loop.

**Architecture:** React 18 + Vite + TypeScript SPA with hash routing. `@ckb-ccc/connector-react` for wallet (JoyID/MetaMask). `lib/` layer handles all blockchain logic (encoding, indexer queries, TX construction) with zero React deps. Components are thin UI shells that call into `lib/`.

**Tech Stack:** React 18, Vite 5, TypeScript, `@ckb-ccc/connector-react`, `@ckb-ccc/core`, `vite-plugin-node-polyfills`, `react-router-dom` (hash router)

**Spec:** `docs/superpowers/specs/2026-04-13-cellswap-frontend-design.md`

---

## File Map

| File | Responsibility |
|------|---------------|
| `frontend/package.json` | Dependencies and scripts |
| `frontend/vite.config.ts` | Vite + React + node polyfills |
| `frontend/tsconfig.json` | TypeScript config |
| `frontend/index.html` | HTML shell with OG meta tags |
| `frontend/src/main.tsx` | React mount + ErrorBoundary |
| `frontend/src/App.tsx` | CCC Provider + HashRouter + routes |
| `frontend/src/config.ts` | Contract addresses, RPC, constants |
| `frontend/src/types.ts` | MarketItem, ListingInfo, DecodedLsdlArgs |
| `frontend/src/styles/global.css` | Dark neon theme, all CSS |
| `frontend/src/lib/codec.ts` | Encode/decode MarketItem molecule bytes |
| `frontend/src/lib/indexer.ts` | Query testnet indexer via CCC client |
| `frontend/src/lib/transactions.ts` | Build mint, list, buy, cancel TXs |
| `frontend/src/lib/content.ts` | MIME helpers, preview logic |
| `frontend/src/hooks/useListings.ts` | Fetch LSDL-locked cells |
| `frontend/src/hooks/useMyItems.ts` | Fetch user's owned + listed cells |
| `frontend/src/components/Layout.tsx` | Header, nav, footer |
| `frontend/src/components/WalletButton.tsx` | Connect/disconnect |
| `frontend/src/components/Browse.tsx` | Listings grid with Gallery/List toggle |
| `frontend/src/components/ItemCard.tsx` | Single listing card |
| `frontend/src/components/ItemDetail.tsx` | Full item view + buy/cancel |
| `frontend/src/components/Mint.tsx` | Create MarketItem form |
| `frontend/src/components/ListItem.tsx` | List-for-sale form |
| `frontend/src/components/MyItems.tsx` | Owned + listed items |
| `frontend/src/components/ContentRenderer.tsx` | Type-aware content display |
| `frontend/src/components/TxStatus.tsx` | TX confirmation overlay |

---

### Task 1: Scaffold Vite + React + TypeScript project

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/config.ts`
- Create: `frontend/src/types.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "cellswap",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@ckb-ccc/connector-react": "^1.0.34",
    "@ckb-ccc/core": "^1.12.5",
    "@ckb-ccc/joy-id": "^1.0.32",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.23.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.1",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.1",
    "typescript": "^5.5.0",
    "vite": "^5.4.0",
    "vite-plugin-node-polyfills": "^0.22.0"
  }
}
```

- [ ] **Step 2: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: ['buffer', 'crypto', 'stream', 'util', 'process'],
      globals: { Buffer: true, global: true, process: true },
    }),
  ],
  build: { target: 'es2020' },
});
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>CellSwap — On-Chain Cell Marketplace</title>
    <meta name="description" content="A universal, fully on-chain marketplace for CKB cell content. Browse, buy, mint, and trade digital assets on Nervos CKB." />
    <meta property="og:title" content="CellSwap — On-Chain Cell Marketplace" />
    <meta property="og:description" content="Browse, buy, mint, and trade on-chain cells on Nervos CKB." />
    <meta property="og:image" content="/cellswap2.png" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://cellswap.xyz" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create config.ts**

```typescript
// config.ts — All contract addresses and network config in one file.
// Forkers: change these values to point at your own deployed contracts.

export const NETWORK = 'testnet' as const;

export const RPC_URL = 'https://testnet.ckb.dev/rpc';
export const INDEXER_URL = 'https://testnet.ckb.dev/indexer';

// market-item-type (type script validating MarketItem envelope)
export const MARKET_ITEM_TYPE = {
  TX_HASH: '0xb23607df31ad02137f1836ad23e6ebe5dd864125d0e31ccd14d333937eb76388',
  INDEX: 0,
  TYPE_ID: '0xa80b8554454d2b8cd619bcbd63895bb00b14709809e37806f6dbde0302e48a4f',
  DATA_HASH: '0x613bdff5b54154ae98338488cf0173fff0a0cbfc785534c38f24425a678e530f',
};

// LSDL (lock script handling sales with royalties and expiration)
export const LSDL = {
  TX_HASH: '0xfc5fc948a406a6b7bc5636642d57d462a0789479dd1197dbb14a35079c936dd3',
  INDEX: 0,
  TYPE_ID: '0xd1e6732bccd4f047949519f90c90a4372de0732976313442f6a708849dd07af5',
  DATA_HASH: '0xbf3b13493c34a991a8885c9670d05873960cb18b04628a72ce5ea186ddee5612',
};

// CKB explorer base URLs
export const EXPLORER_URL = 'https://testnet.explorer.nervos.org';

// Minimum CKB capacity for a cell (61 CKB for basic cell)
export const MIN_CELL_CAPACITY = 6100000000n; // 61 CKB in shannons
```

- [ ] **Step 6: Create types.ts**

```typescript
import { ccc } from '@ckb-ccc/connector-react';

/** Decoded MarketItem cell data (from molecule bytes) */
export interface MarketItem {
  contentType: string;
  description: string;
  content: Uint8Array;
}

/** Decoded LSDL lock args */
export interface DecodedLsdlArgs {
  ownerLock: ccc.Script;
  totalValue: bigint;         // price in shannons
  creatorLockHash: Uint8Array; // 20 bytes (blake160)
  royaltyBps: number;         // basis points 0-10000
  expiryEpoch: bigint;        // 0 = permanent
}

/** A listed item = MarketItem content + LSDL sale terms + cell reference */
export interface ListingInfo {
  outPoint: ccc.OutPoint;
  capacity: bigint;
  marketItem: MarketItem;
  lsdlArgs: DecodedLsdlArgs;
}

/** An owned (unlisted) MarketItem cell */
export interface OwnedItem {
  outPoint: ccc.OutPoint;
  capacity: bigint;
  marketItem: MarketItem;
}

/** Content type categories for UI badges and rendering */
export type ContentCategory = 'image' | 'text' | 'data' | 'html';

/** TX processing states */
export type TxState =
  | { status: 'idle' }
  | { status: 'building'; message: string }
  | { status: 'signing' }
  | { status: 'broadcasting' }
  | { status: 'confirming'; txHash: string }
  | { status: 'success'; txHash: string }
  | { status: 'error'; message: string };
```

- [ ] **Step 7: Create main.tsx**

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(e: Error) { return { error: e }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: '2rem', fontFamily: 'JetBrains Mono, monospace',
          background: '#080a0f', color: '#ff4560', minHeight: '100vh',
          whiteSpace: 'pre-wrap', wordBreak: 'break-all',
        }}>
          <h2>Runtime Error</h2>
          <p>{this.state.error.message}</p>
          <p style={{ color: '#64748b', fontSize: '.85rem' }}>{this.state.error.stack}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
```

- [ ] **Step 8: Create App.tsx (shell with routing)**

```tsx
import { ccc } from '@ckb-ccc/connector-react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Browse } from './components/Browse';
import { ItemDetail } from './components/ItemDetail';
import { Mint } from './components/Mint';
import { MyItems } from './components/MyItems';

export default function App() {
  return (
    <ccc.Provider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/browse" element={<Browse />} />
            <Route path="/item/:outpoint" element={<ItemDetail />} />
            <Route path="/mint" element={<Mint />} />
            <Route path="/my-items" element={<MyItems />} />
            <Route path="*" element={<Navigate to="/browse" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </ccc.Provider>
  );
}
```

- [ ] **Step 9: Install dependencies and verify build**

Run: `cd frontend && npm install`
Expected: clean install, no peer dep errors

Run: `cd frontend && npx tsc --noEmit`
Expected: type check passes (components don't exist yet, so App.tsx will have import errors — that's expected, we'll fix in subsequent tasks)

- [ ] **Step 10: Commit scaffold**

```bash
git add frontend/package.json frontend/vite.config.ts frontend/tsconfig.json frontend/index.html frontend/src/main.tsx frontend/src/App.tsx frontend/src/config.ts frontend/src/types.ts
git commit -m "feat: scaffold CellSwap frontend — Vite + React + CCC + TypeScript"
```

---

### Task 2: CSS theme and Layout component

**Files:**
- Create: `frontend/src/styles/global.css`
- Create: `frontend/src/components/Layout.tsx`
- Create: `frontend/src/components/WalletButton.tsx`

- [ ] **Step 1: Create global.css**

```css
/* ── Variables ─────────────────────────────────────── */
:root {
  --bg:       #080a0f;
  --surface:  #0f1218;
  --surface2: #161b24;
  --border:   #1c2333;
  --accent:   #00d4ff;
  --green:    #00e5a0;
  --purple:   #8b5cf6;
  --magenta:  #f43f8e;
  --text:     #e2e8f0;
  --muted:    #64748b;
  --red:      #ff4560;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  background: var(--bg);
  color: var(--text);
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
  font-size: 15px;
  line-height: 1.6;
  min-height: 100vh;
}

a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }

code, .mono {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.88em;
}

/* ── Header ────────────────────────────────────────── */
.header {
  position: sticky;
  top: 0;
  z-index: 100;
  border-bottom: 1px solid var(--border);
  background: rgba(8, 10, 15, 0.92);
  backdrop-filter: blur(12px);
}

.header-inner {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 60px;
  padding: 0 1.5rem;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
  font-size: 1.15rem;
  color: var(--text);
  text-decoration: none;
}

.logo:hover { text-decoration: none; }

.nav-tabs {
  display: flex;
  gap: 0.25rem;
}

.nav-tab {
  padding: 0.5rem 1rem;
  border-radius: 8px;
  color: var(--muted);
  font-size: 0.9rem;
  font-weight: 500;
  text-decoration: none;
  transition: color 0.2s, background 0.2s;
}

.nav-tab:hover {
  color: var(--text);
  background: var(--surface);
  text-decoration: none;
}

.nav-tab.active {
  color: var(--accent);
  background: var(--surface);
}

/* ── Main content ──────────────────────────────────── */
.main {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1.5rem;
}

/* ── Cards ─────────────────────────────────────────── */
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1.25rem;
  transition: border-color 0.2s;
}

.card:hover {
  border-color: color-mix(in srgb, var(--accent) 30%, var(--border));
}

/* ── Buttons ───────────────────────────────────────── */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.6rem 1.2rem;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--accent);
  color: #000;
  border-color: var(--accent);
}

.btn-primary:hover:not(:disabled) {
  background: color-mix(in srgb, var(--accent) 85%, white);
}

.btn-buy {
  background: var(--magenta);
  color: #fff;
  border-color: var(--magenta);
}

.btn-buy:hover:not(:disabled) {
  background: color-mix(in srgb, var(--magenta) 85%, white);
}

.btn-ghost {
  background: transparent;
  color: var(--muted);
  border-color: var(--border);
}

.btn-ghost:hover:not(:disabled) {
  color: var(--text);
  border-color: var(--muted);
}

.btn-danger {
  background: transparent;
  color: var(--red);
  border-color: var(--red);
}

.btn-danger:hover:not(:disabled) {
  background: rgba(255, 69, 96, 0.1);
}

/* ── Badges ────────────────────────────────────────── */
.badge {
  display: inline-block;
  padding: 0.15rem 0.5rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  font-family: 'JetBrains Mono', monospace;
}

.badge-image { background: rgba(0, 212, 255, 0.15); color: var(--accent); }
.badge-text  { background: rgba(0, 229, 160, 0.15); color: var(--green); }
.badge-data  { background: rgba(139, 92, 246, 0.15); color: var(--purple); }
.badge-html  { background: rgba(244, 63, 142, 0.15); color: var(--magenta); }

/* ── Grid ──────────────────────────────────────────── */
.items-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

/* ── Wallet button ─────────────────────────────────── */
.wallet-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.8rem;
  border-radius: 8px;
  font-size: 0.85rem;
  cursor: pointer;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  transition: border-color 0.2s;
}

.wallet-btn:hover { border-color: var(--accent); }

.wallet-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--green);
}

/* ── Forms ─────────────────────────────────────────── */
.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-bottom: 1rem;
}

.form-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--muted);
}

.form-input, .form-textarea, .form-select {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.6rem 0.8rem;
  color: var(--text);
  font-size: 0.9rem;
  font-family: inherit;
  transition: border-color 0.2s;
}

.form-input:focus, .form-textarea:focus, .form-select:focus {
  outline: none;
  border-color: var(--accent);
}

.form-textarea {
  min-height: 80px;
  resize: vertical;
}

/* ── File drop zone ────────────────────────────────── */
.drop-zone {
  border: 2px dashed var(--border);
  border-radius: 12px;
  padding: 2rem;
  text-align: center;
  color: var(--muted);
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}

.drop-zone:hover, .drop-zone.dragover {
  border-color: var(--accent);
  background: rgba(0, 212, 255, 0.04);
}

/* ── TX status overlay ─────────────────────────────── */
.tx-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(8, 10, 15, 0.85);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.tx-card {
  background: var(--surface);
  border: 1px solid var(--accent);
  border-radius: 16px;
  padding: 2rem;
  text-align: center;
  max-width: 420px;
  width: 90%;
  box-shadow: 0 0 40px rgba(0, 212, 255, 0.15);
}

.tx-pulse {
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { box-shadow: 0 0 20px rgba(0, 212, 255, 0.1); }
  50% { box-shadow: 0 0 40px rgba(0, 212, 255, 0.3); }
}

.tx-protocol-text {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.8rem;
  color: var(--accent);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-top: 1rem;
}

/* ── Price display ─────────────────────────────────── */
.price {
  font-family: 'JetBrains Mono', monospace;
  font-weight: 600;
  color: var(--magenta);
}

/* ── Footer ────────────────────────────────────────── */
.footer {
  max-width: 1200px;
  margin: 3rem auto 0;
  padding: 1.5rem;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.82rem;
  color: var(--muted);
}

.footer-links {
  display: flex;
  gap: 1.25rem;
}

/* ── Hex background pattern ────────────────────────── */
.hex-bg {
  position: fixed;
  inset: 0;
  z-index: -1;
  opacity: 0.03;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='49' viewBox='0 0 28 49'%3E%3Cg fill-rule='evenodd'%3E%3Cg fill='%2300d4ff'%3E%3Cpath d='M13.99 9.25l13 7.5v15l-13 7.5L1 31.75v-15l12.99-7.5zM3 17.9v12.7l10.99 6.34 11-6.35V17.9l-11-6.34L3 17.9z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
}

/* ── Item detail glow ──────────────────────────────── */
.content-glow {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1.5rem;
  position: relative;
  overflow: hidden;
}

.content-glow::after {
  content: '';
  position: absolute;
  bottom: -50%;
  left: 50%;
  transform: translateX(-50%);
  width: 80%;
  height: 100%;
  background: radial-gradient(ellipse, rgba(0, 212, 255, 0.08) 0%, transparent 70%);
  pointer-events: none;
}

/* ── Empty state ───────────────────────────────────── */
.empty-state {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--muted);
}

.empty-state h3 {
  color: var(--text);
  margin-bottom: 0.5rem;
}

/* ── View toggle ───────────────────────────────────── */
.view-toggle {
  display: flex;
  gap: 4px;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 3px;
}

.view-toggle button {
  padding: 0.3rem 0.6rem;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--muted);
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}

.view-toggle button.active {
  background: var(--accent);
  color: #000;
}

/* ── List view table ───────────────────────────────── */
.items-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.list-row {
  display: grid;
  grid-template-columns: 1fr auto auto auto;
  gap: 1rem;
  align-items: center;
  padding: 0.75rem 1rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.2s;
}

.list-row:hover {
  border-color: color-mix(in srgb, var(--accent) 30%, var(--border));
}

/* ── Responsive ────────────────────────────────────── */
@media (max-width: 768px) {
  .header-inner { padding: 0 1rem; }
  .nav-tabs { gap: 0; }
  .nav-tab { padding: 0.4rem 0.6rem; font-size: 0.8rem; }
  .main { padding: 1rem; }
  .items-grid { grid-template-columns: 1fr; }
  .list-row { grid-template-columns: 1fr auto; }
  .footer { flex-direction: column; gap: 0.75rem; text-align: center; }
}
```

- [ ] **Step 2: Create Layout.tsx**

```tsx
import { NavLink, Outlet } from 'react-router-dom';
import { WalletButton } from './WalletButton';

export function Layout() {
  return (
    <>
      <div className="hex-bg" />
      <header className="header">
        <div className="header-inner">
          <NavLink to="/browse" className="logo">
            CellSwap
          </NavLink>
          <nav className="nav-tabs">
            <NavLink to="/browse" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
              Examine
            </NavLink>
            <NavLink to="/mint" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
              Mint
            </NavLink>
            <NavLink to="/my-items" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
              My Cells
            </NavLink>
          </nav>
          <WalletButton />
        </div>
      </header>
      <main className="main">
        <Outlet />
      </main>
      <footer className="footer">
        <span>CellSwap — built on Nervos CKB</span>
        <div className="footer-links">
          <a href="https://github.com/toastmanAu/ckb-cell-marketplace" target="_blank" rel="noreferrer">GitHub</a>
          <a href="https://docs.nervos.org" target="_blank" rel="noreferrer">CKB Docs</a>
          <a href={`https://testnet.explorer.nervos.org`} target="_blank" rel="noreferrer">Explorer</a>
        </div>
      </footer>
    </>
  );
}
```

- [ ] **Step 3: Create WalletButton.tsx**

```tsx
import { useCcc, ccc } from '@ckb-ccc/connector-react';
import { useState, useEffect } from 'react';

export function WalletButton() {
  const { signerInfo, open, setClient, disconnect } = useCcc();
  const signer = signerInfo?.signer;
  const [address, setAddress] = useState('');

  useEffect(() => {
    setClient(new ccc.ClientPublicTestnet());
  }, [setClient]);

  useEffect(() => {
    if (!signer) { setAddress(''); return; }
    signer.getRecommendedAddress().then(setAddress).catch(() => setAddress(''));
  }, [signer]);

  if (signer && address) {
    const short = `${address.slice(0, 10)}...${address.slice(-6)}`;
    return (
      <button className="wallet-btn" onClick={disconnect} title={address}>
        <span className="wallet-dot" />
        <code>{short}</code>
      </button>
    );
  }

  return (
    <button className="btn btn-primary" onClick={open}>
      Connect Wallet
    </button>
  );
}
```

- [ ] **Step 4: Verify dev server starts**

Run: `cd frontend && npm run dev`
Expected: Vite dev server starts, page loads at localhost with CellSwap header, hex background, nav tabs (Examine / Mint / My Cells), and Connect Wallet button. Route links work (show empty content area).

- [ ] **Step 5: Commit theme + layout**

```bash
git add frontend/src/styles/global.css frontend/src/components/Layout.tsx frontend/src/components/WalletButton.tsx
git commit -m "feat: dark neon theme + Layout with nav and wallet button"
```

---

### Task 3: Codec and content utilities (lib layer)

**Files:**
- Create: `frontend/src/lib/codec.ts`
- Create: `frontend/src/lib/content.ts`

- [ ] **Step 1: Create codec.ts**

This encodes/decodes MarketItem molecule bytes. The molecule table format is:
`total_size(4 LE) + 3 offsets(12 LE) + content_type(4 LE len + data) + description(4 LE len + data) + content(4 LE len + data)`

```typescript
import type { MarketItem, DecodedLsdlArgs } from '../types';
import { ccc } from '@ckb-ccc/connector-react';

// ── MarketItem molecule encoding ────────────────────

const HEADER_SIZE = 16; // 4 (total) + 3 × 4 (offsets)

export function encodeMarketItem(
  contentType: string,
  description: string,
  content: Uint8Array,
): Uint8Array {
  const ctBytes = new TextEncoder().encode(contentType);
  const descBytes = new TextEncoder().encode(description);

  const ctFieldSize = 4 + ctBytes.length;
  const descFieldSize = 4 + descBytes.length;
  const contFieldSize = 4 + content.length;
  const totalSize = HEADER_SIZE + ctFieldSize + descFieldSize + contFieldSize;

  const buf = new ArrayBuffer(totalSize);
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);
  let off = 0;

  // Header: total_size + 3 offsets
  view.setUint32(off, totalSize, true); off += 4;
  view.setUint32(off, HEADER_SIZE, true); off += 4;
  view.setUint32(off, HEADER_SIZE + ctFieldSize, true); off += 4;
  view.setUint32(off, HEADER_SIZE + ctFieldSize + descFieldSize, true); off += 4;

  // content_type field
  view.setUint32(off, ctBytes.length, true); off += 4;
  bytes.set(ctBytes, off); off += ctBytes.length;

  // description field
  view.setUint32(off, descBytes.length, true); off += 4;
  bytes.set(descBytes, off); off += descBytes.length;

  // content field
  view.setUint32(off, content.length, true); off += 4;
  bytes.set(content, off);

  return bytes;
}

export function decodeMarketItem(data: Uint8Array): MarketItem {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  // Read offsets
  const offset0 = view.getUint32(4, true);  // content_type start
  const offset1 = view.getUint32(8, true);  // description start
  const offset2 = view.getUint32(12, true); // content start

  const ctLen = view.getUint32(offset0, true);
  const ctBytes = data.subarray(offset0 + 4, offset0 + 4 + ctLen);

  const descLen = view.getUint32(offset1, true);
  const descBytes = data.subarray(offset1 + 4, offset1 + 4 + descLen);

  const contLen = view.getUint32(offset2, true);
  const contentBytes = data.subarray(offset2 + 4, offset2 + 4 + contLen);

  const decoder = new TextDecoder();
  return {
    contentType: decoder.decode(ctBytes),
    description: decoder.decode(descBytes),
    content: new Uint8Array(contentBytes),
  };
}

// ── LSDL args encoding/decoding ─────────────────────
// Layout: [4-byte LE owner_lock_size][owner_lock Script molecule][16 BE u128 total_value]
//         [20 bytes creator_lock_hash][2 BE u16 royalty_bps][8 BE u64 expiry_epoch]

export function encodeLsdlArgs(args: {
  ownerLock: ccc.Script;
  totalValue: bigint;
  creatorLockHash: Uint8Array;
  royaltyBps: number;
  expiryEpoch: bigint;
}): Uint8Array {
  const lockBytes = args.ownerLock.toBytes();
  const lockLen = lockBytes.length;
  const totalLen = 4 + lockLen + 16 + 20 + 2 + 8;

  const buf = new ArrayBuffer(totalLen);
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);
  let off = 0;

  // owner_lock size prefix (4 bytes LE)
  view.setUint32(off, lockLen, true); off += 4;

  // owner_lock Script molecule bytes
  bytes.set(lockBytes, off); off += lockLen;

  // total_value (16 bytes BE u128)
  const hi = args.totalValue >> 64n;
  const lo = args.totalValue & ((1n << 64n) - 1n);
  view.setBigUint64(off, hi, false); off += 8;
  view.setBigUint64(off, lo, false); off += 8;

  // creator_lock_hash (20 bytes)
  bytes.set(args.creatorLockHash, off); off += 20;

  // royalty_bps (2 bytes BE u16)
  view.setUint16(off, args.royaltyBps, false); off += 2;

  // expiry_epoch (8 bytes BE u64)
  view.setBigUint64(off, args.expiryEpoch, false);

  return bytes;
}

export function decodeLsdlArgs(argsHex: string): DecodedLsdlArgs {
  const hex = argsHex.startsWith('0x') ? argsHex.slice(2) : argsHex;
  const data = new Uint8Array(hex.match(/.{2}/g)!.map(b => parseInt(b, 16)));
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let off = 0;

  // owner_lock size
  const lockLen = view.getUint32(off, true); off += 4;

  // owner_lock Script molecule
  const lockBytes = data.subarray(off, off + lockLen);
  const ownerLock = ccc.Script.fromBytes(lockBytes);
  off += lockLen;

  // total_value (16 bytes BE u128)
  const hi = view.getBigUint64(off, false); off += 8;
  const lo = view.getBigUint64(off, false); off += 8;
  const totalValue = (hi << 64n) | lo;

  // creator_lock_hash (20 bytes)
  const creatorLockHash = new Uint8Array(data.subarray(off, off + 20));
  off += 20;

  // royalty_bps (2 bytes BE u16)
  const royaltyBps = view.getUint16(off, false); off += 2;

  // expiry_epoch (8 bytes BE u64)
  const expiryEpoch = view.getBigUint64(off, false);

  return { ownerLock, totalValue, creatorLockHash, royaltyBps, expiryEpoch };
}

// ── Helpers ─────────────────────────────────────────

/** Convert shannons to CKB display string */
export function shannonsToCkb(shannons: bigint): string {
  const whole = shannons / 100000000n;
  const frac = shannons % 100000000n;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(8, '0').replace(/0+$/, '');
  return `${whole}.${fracStr}`;
}

/** Convert CKB string to shannons */
export function ckbToShannons(ckb: string): bigint {
  const parts = ckb.split('.');
  const whole = BigInt(parts[0]) * 100000000n;
  if (parts.length === 1) return whole;
  const fracStr = (parts[1] || '').padEnd(8, '0').slice(0, 8);
  return whole + BigInt(fracStr);
}
```

- [ ] **Step 2: Create content.ts**

```typescript
import type { ContentCategory } from '../types';

/** Categorise a MIME type for UI badge and rendering */
export function categoriseContent(contentType: string): ContentCategory {
  if (contentType.startsWith('image/')) return 'image';
  if (contentType === 'text/html') return 'html';
  if (contentType.startsWith('text/')) return 'text';
  return 'data';
}

/** Get badge CSS class for a content category */
export function badgeClass(category: ContentCategory): string {
  return `badge badge-${category}`;
}

/** Get human-readable label for a content category */
export function categoryLabel(contentType: string): string {
  const cat = categoriseContent(contentType);
  switch (cat) {
    case 'image': return contentType.replace('image/', '').toUpperCase();
    case 'text': return 'TEXT';
    case 'html': return 'HTML';
    case 'data': return contentType.split('/').pop()?.toUpperCase() || 'DATA';
  }
}

/** Convert content bytes to a data URL for preview */
export function contentToDataUrl(content: Uint8Array, contentType: string): string {
  const blob = new Blob([content], { type: contentType });
  return URL.createObjectURL(blob);
}

/** Convert content bytes to string (for text/json/html) */
export function contentToString(content: Uint8Array): string {
  return new TextDecoder().decode(content);
}

/** Truncate a hex string for display */
export function shortHash(hash: string, head = 10, tail = 6): string {
  if (hash.length <= head + tail + 3) return hash;
  return `${hash.slice(0, head)}...${hash.slice(-tail)}`;
}

/** Truncate an address for display */
export function shortAddress(addr: string): string {
  return shortHash(addr, 12, 8);
}
```

- [ ] **Step 3: Commit lib layer**

```bash
git add frontend/src/lib/codec.ts frontend/src/lib/content.ts
git commit -m "feat: MarketItem + LSDL codec and content utilities"
```

---

### Task 4: Indexer queries

**Files:**
- Create: `frontend/src/lib/indexer.ts`

- [ ] **Step 1: Create indexer.ts**

Uses the CCC client's `findCells` to query the testnet indexer.

```typescript
import { ccc } from '@ckb-ccc/connector-react';
import { MARKET_ITEM_TYPE, LSDL } from '../config';
import { decodeMarketItem, decodeLsdlArgs } from './codec';
import type { ListingInfo, OwnedItem } from '../types';

/** Create a CCC testnet client for indexer queries */
export function createClient(): ccc.ClientPublicTestnet {
  return new ccc.ClientPublicTestnet();
}

/** Fetch all currently listed MarketItems (cells locked by LSDL with market-item-type) */
export async function fetchListings(client: ccc.Client): Promise<ListingInfo[]> {
  const listings: ListingInfo[] = [];

  const iter = client.findCellsByLock(
    {
      codeHash: LSDL.DATA_HASH,
      hashType: 'data1',
      args: '0x',
    },
    {
      codeHash: MARKET_ITEM_TYPE.TYPE_ID,
      hashType: 'type',
      args: '0x',
    },
    true, // withData
    'desc',
    100,
  );

  for await (const cell of iter) {
    try {
      const data = cell.outputData;
      if (!data || data.length === 0) continue;

      const dataBytes = ccc.bytesFrom(data);
      const marketItem = decodeMarketItem(dataBytes);
      const lsdlArgs = decodeLsdlArgs(ccc.hexFrom(cell.cellOutput.lock.args));

      listings.push({
        outPoint: cell.outPoint,
        capacity: cell.cellOutput.capacity,
        marketItem,
        lsdlArgs,
      });
    } catch {
      // Skip malformed cells
    }
  }

  return listings;
}

/** Fetch MarketItem cells owned by the connected wallet (not listed) */
export async function fetchOwnedItems(
  client: ccc.Client,
  userLock: ccc.Script,
): Promise<OwnedItem[]> {
  const items: OwnedItem[] = [];

  const iter = client.findCellsByLock(
    userLock,
    {
      codeHash: MARKET_ITEM_TYPE.TYPE_ID,
      hashType: 'type',
      args: '0x',
    },
    true,
    'desc',
    100,
  );

  for await (const cell of iter) {
    try {
      const data = cell.outputData;
      if (!data || data.length === 0) continue;

      const dataBytes = ccc.bytesFrom(data);
      const marketItem = decodeMarketItem(dataBytes);

      items.push({
        outPoint: cell.outPoint,
        capacity: cell.cellOutput.capacity,
        marketItem,
      });
    } catch {
      // Skip malformed
    }
  }

  return items;
}

/** Fetch items listed by a specific user (LSDL-locked, owner matches) */
export async function fetchMyListings(
  client: ccc.Client,
  userLock: ccc.Script,
): Promise<ListingInfo[]> {
  const all = await fetchListings(client);
  return all.filter(listing => {
    return listing.lsdlArgs.ownerLock.eq(userLock);
  });
}

/** Fetch a single cell by outpoint */
export async function fetchCell(
  client: ccc.Client,
  outPoint: ccc.OutPointLike,
): Promise<ccc.Cell | undefined> {
  return client.getCellLive(outPoint, true);
}
```

- [ ] **Step 2: Commit indexer**

```bash
git add frontend/src/lib/indexer.ts
git commit -m "feat: indexer queries for listings, owned items, and single cells"
```

---

### Task 5: Transaction builders

**Files:**
- Create: `frontend/src/lib/transactions.ts`

- [ ] **Step 1: Create transactions.ts**

```typescript
import { ccc } from '@ckb-ccc/connector-react';
import { MARKET_ITEM_TYPE, LSDL } from '../config';
import { encodeMarketItem, encodeLsdlArgs, decodeLsdlArgs } from './codec';

/** Cell deps needed for market-item-type */
function marketItemCellDep(): ccc.CellDepLike {
  return {
    outPoint: { txHash: MARKET_ITEM_TYPE.TX_HASH, index: MARKET_ITEM_TYPE.INDEX },
    depType: 'code',
  };
}

/** Cell deps needed for LSDL */
function lsdlCellDep(): ccc.CellDepLike {
  return {
    outPoint: { txHash: LSDL.TX_HASH, index: LSDL.INDEX },
    depType: 'code',
  };
}

// ── Mint ────────────────────────────────────────────

export async function buildMintTx(
  signer: ccc.Signer,
  contentType: string,
  description: string,
  content: Uint8Array,
): Promise<ccc.Transaction> {
  const userLock = (await signer.getRecommendedAddressObj()).script;
  const data = encodeMarketItem(contentType, description, content);
  const dataHex = ccc.hexFrom(data);

  const tx = ccc.Transaction.from({
    outputs: [{
      lock: userLock,
      type: {
        codeHash: MARKET_ITEM_TYPE.TYPE_ID,
        hashType: 'type',
        args: '0x',
      },
    }],
    outputsData: [dataHex],
    cellDeps: [marketItemCellDep()],
  });

  await tx.completeInputsByCapacity(signer);
  await tx.completeFeeBy(signer, 1000);
  return tx;
}

// ── List (transfer to LSDL lock) ────────────────────

export async function buildListTx(
  signer: ccc.Signer,
  itemOutPoint: ccc.OutPointLike,
  itemData: string,        // hex-encoded cell data (unchanged)
  itemCapacity: bigint,
  price: bigint,           // total_value in shannons
  royaltyBps: number,      // 0-10000
  expiryEpoch: bigint,     // 0 = permanent
): Promise<ccc.Transaction> {
  const userLock = (await signer.getRecommendedAddressObj()).script;

  // Creator lock hash = first 20 bytes of the user's lock args (blake160)
  const lockArgsBytes = ccc.bytesFrom(userLock.args);
  const creatorLockHash = lockArgsBytes.slice(0, 20);

  const lsdlArgs = encodeLsdlArgs({
    ownerLock: userLock,
    totalValue: price,
    creatorLockHash: new Uint8Array(creatorLockHash),
    royaltyBps,
    expiryEpoch,
  });

  const tx = ccc.Transaction.from({
    inputs: [{ previousOutput: itemOutPoint }],
    outputs: [{
      lock: {
        codeHash: LSDL.DATA_HASH,
        hashType: 'data1',
        args: ccc.hexFrom(lsdlArgs),
      },
      type: {
        codeHash: MARKET_ITEM_TYPE.TYPE_ID,
        hashType: 'type',
        args: '0x',
      },
      capacity: itemCapacity,
    }],
    outputsData: [itemData],
    cellDeps: [marketItemCellDep(), lsdlCellDep()],
  });

  await tx.completeInputsByCapacity(signer);
  await tx.completeFeeBy(signer, 1000);
  return tx;
}

// ── Buy (satisfy LSDL) ─────────────────────────────

export async function buildBuyTx(
  signer: ccc.Signer,
  listingCell: ccc.Cell,
): Promise<ccc.Transaction> {
  const buyerLock = (await signer.getRecommendedAddressObj()).script;
  const lsdlArgs = decodeLsdlArgs(ccc.hexFrom(listingCell.cellOutput.lock.args));
  const { ownerLock, totalValue, creatorLockHash, royaltyBps } = lsdlArgs;

  // Calculate royalty split
  const royaltyAmount = totalValue * BigInt(royaltyBps) / 10000n;
  const sellerAmount = totalValue - royaltyAmount;

  // The LSDL input index in the final TX determines where seller/creator outputs must be.
  // We put the LSDL cell as input[0], so seller must be output[0] and creator output[1].
  const tx = ccc.Transaction.from({
    inputs: [{ previousOutput: listingCell.outPoint }],
    outputs: [],
    outputsData: [],
    cellDeps: [marketItemCellDep(), lsdlCellDep()],
  });

  // Output[0]: seller payment (at same index as LSDL input)
  tx.addOutput({
    lock: ownerLock,
    capacity: listingCell.cellOutput.capacity + sellerAmount,
  }, '0x');

  // Output[1]: creator royalty (at LSDL input index + 1)
  if (royaltyAmount > 0n) {
    // Creator lock: secp256k1 with creator_lock_hash as args
    tx.addOutput({
      lock: {
        codeHash: '0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8',
        hashType: 'type',
        args: ccc.hexFrom(creatorLockHash),
      },
    }, '0x');
  }

  // Output[2+]: MarketItem cell transferred to buyer
  tx.addOutput({
    lock: buyerLock,
    type: listingCell.cellOutput.type,
  }, listingCell.outputData);

  await tx.completeInputsByCapacity(signer);
  await tx.completeFeeBy(signer, 1000);
  return tx;
}

// ── Cancel (owner reclaims) ─────────────────────────

export async function buildCancelTx(
  signer: ccc.Signer,
  listingCell: ccc.Cell,
): Promise<ccc.Transaction> {
  const ownerLock = decodeLsdlArgs(ccc.hexFrom(listingCell.cellOutput.lock.args)).ownerLock;

  const tx = ccc.Transaction.from({
    inputs: [{ previousOutput: listingCell.outPoint }],
    outputs: [{
      lock: ownerLock,
      type: listingCell.cellOutput.type,
      capacity: listingCell.cellOutput.capacity,
    }],
    outputsData: [listingCell.outputData],
    cellDeps: [marketItemCellDep(), lsdlCellDep()],
  });

  await tx.completeInputsByCapacity(signer);
  await tx.completeFeeBy(signer, 1000);
  return tx;
}
```

- [ ] **Step 2: Commit transactions**

```bash
git add frontend/src/lib/transactions.ts
git commit -m "feat: TX builders for mint, list, buy, and cancel"
```

---

### Task 6: React hooks

**Files:**
- Create: `frontend/src/hooks/useListings.ts`
- Create: `frontend/src/hooks/useMyItems.ts`

- [ ] **Step 1: Create useListings.ts**

```typescript
import { useState, useEffect, useCallback } from 'react';
import { ccc } from '@ckb-ccc/connector-react';
import { createClient, fetchListings } from '../lib/indexer';
import type { ListingInfo } from '../types';

export function useListings() {
  const [listings, setListings] = useState<ListingInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const client = createClient();
      const results = await fetchListings(client);
      setListings(results);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { listings, loading, error, refresh };
}
```

- [ ] **Step 2: Create useMyItems.ts**

```typescript
import { useState, useEffect, useCallback } from 'react';
import { useCcc } from '@ckb-ccc/connector-react';
import { createClient, fetchOwnedItems, fetchMyListings } from '../lib/indexer';
import type { OwnedItem, ListingInfo } from '../types';

export function useMyItems() {
  const { signerInfo } = useCcc();
  const signer = signerInfo?.signer;

  const [owned, setOwned] = useState<OwnedItem[]>([]);
  const [listed, setListed] = useState<ListingInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!signer) {
      setOwned([]);
      setListed([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const client = createClient();
      const userLock = (await signer.getRecommendedAddressObj()).script;
      const [ownedResults, listedResults] = await Promise.all([
        fetchOwnedItems(client, userLock),
        fetchMyListings(client, userLock),
      ]);
      setOwned(ownedResults);
      setListed(listedResults);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [signer]);

  useEffect(() => { refresh(); }, [refresh]);

  return { owned, listed, loading, error, refresh };
}
```

- [ ] **Step 3: Commit hooks**

```bash
git add frontend/src/hooks/useListings.ts frontend/src/hooks/useMyItems.ts
git commit -m "feat: useListings and useMyItems hooks"
```

---

### Task 7: ContentRenderer and TxStatus components

**Files:**
- Create: `frontend/src/components/ContentRenderer.tsx`
- Create: `frontend/src/components/TxStatus.tsx`

- [ ] **Step 1: Create ContentRenderer.tsx**

```tsx
import { categoriseContent, contentToDataUrl, contentToString } from '../lib/content';
import type { MarketItem } from '../types';

interface ContentRendererProps {
  item: MarketItem;
  /** 'preview' = small thumbnail, 'full' = large detail view */
  mode: 'preview' | 'full';
}

export function ContentRenderer({ item, mode }: ContentRendererProps) {
  const category = categoriseContent(item.contentType);
  const isPreview = mode === 'preview';

  if (category === 'image') {
    const url = contentToDataUrl(item.content, item.contentType);
    return (
      <img
        src={url}
        alt={item.description}
        style={{
          width: '100%',
          height: isPreview ? '180px' : 'auto',
          maxHeight: isPreview ? '180px' : '500px',
          objectFit: isPreview ? 'cover' : 'contain',
          borderRadius: '8px',
          background: 'var(--surface2)',
        }}
      />
    );
  }

  if (category === 'text') {
    const text = contentToString(item.content);
    return (
      <pre style={{
        background: 'var(--surface2)',
        borderRadius: '8px',
        padding: isPreview ? '0.75rem' : '1.25rem',
        fontSize: isPreview ? '0.78rem' : '0.88rem',
        color: 'var(--green)',
        fontFamily: "'JetBrains Mono', monospace",
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        maxHeight: isPreview ? '180px' : '500px',
        overflow: 'hidden',
        lineHeight: 1.5,
      }}>
        {isPreview ? text.slice(0, 300) : text}
      </pre>
    );
  }

  if (category === 'html') {
    if (isPreview) {
      return (
        <div style={{
          background: 'var(--surface2)',
          borderRadius: '8px',
          padding: '1rem',
          height: '180px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--magenta)',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.85rem',
        }}>
          &lt;HTML&gt; Document
        </div>
      );
    }
    const blob = new Blob([item.content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    return (
      <iframe
        src={url}
        title={item.description}
        sandbox="allow-scripts"
        style={{
          width: '100%',
          height: '400px',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          background: '#fff',
        }}
      />
    );
  }

  // data (JSON, etc)
  const text = contentToString(item.content);
  let formatted = text;
  try {
    formatted = JSON.stringify(JSON.parse(text), null, 2);
  } catch { /* not JSON, show raw */ }

  return (
    <pre style={{
      background: 'var(--surface2)',
      borderRadius: '8px',
      padding: isPreview ? '0.75rem' : '1.25rem',
      fontSize: isPreview ? '0.75rem' : '0.85rem',
      color: 'var(--purple)',
      fontFamily: "'JetBrains Mono', monospace",
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
      maxHeight: isPreview ? '180px' : '500px',
      overflow: 'auto',
      lineHeight: 1.5,
    }}>
      {isPreview ? formatted.slice(0, 400) : formatted}
    </pre>
  );
}
```

- [ ] **Step 2: Create TxStatus.tsx**

```tsx
import type { TxState } from '../types';
import { EXPLORER_URL } from '../config';

interface TxStatusProps {
  state: TxState;
  onClose: () => void;
}

export function TxStatus({ state, onClose }: TxStatusProps) {
  if (state.status === 'idle') return null;

  const isActive = state.status === 'building' || state.status === 'signing' || state.status === 'broadcasting' || state.status === 'confirming';

  return (
    <div className="tx-overlay" onClick={isActive ? undefined : onClose}>
      <div className={`tx-card ${isActive ? 'tx-pulse' : ''}`} onClick={e => e.stopPropagation()}>
        {state.status === 'building' && (
          <>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>&#x2699;</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{state.message}</div>
            <div className="tx-protocol-text">Cell Swap Protocol In Progress</div>
          </>
        )}

        {state.status === 'signing' && (
          <>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>&#x1F511;</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>Waiting for signature...</div>
            <div className="tx-protocol-text">Approve in your wallet</div>
          </>
        )}

        {state.status === 'broadcasting' && (
          <>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>&#x1F4E1;</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>Broadcasting transaction...</div>
            <div className="tx-protocol-text">Cell Swap Protocol In Progress</div>
          </>
        )}

        {state.status === 'confirming' && (
          <>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>&#x23F3;</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>Confirming on-chain</div>
            <a
              href={`${EXPLORER_URL}/transaction/${state.txHash}`}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: '0.85rem', marginTop: '0.5rem', display: 'block' }}
            >
              View on Explorer
            </a>
            <div className="tx-protocol-text">Cell Swap Protocol In Progress</div>
          </>
        )}

        {state.status === 'success' && (
          <>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem', color: 'var(--green)' }}>&#x2713;</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--green)' }}>Transaction confirmed</div>
            <a
              href={`${EXPLORER_URL}/transaction/${state.txHash}`}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: '0.85rem', marginTop: '0.5rem', display: 'block' }}
            >
              View on Explorer
            </a>
            <button className="btn btn-primary" onClick={onClose} style={{ marginTop: '1rem' }}>
              Continue
            </button>
          </>
        )}

        {state.status === 'error' && (
          <>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem', color: 'var(--red)' }}>&#x2717;</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--red)' }}>Transaction failed</div>
            <div style={{
              fontSize: '0.82rem', color: 'var(--muted)', marginTop: '0.5rem',
              wordBreak: 'break-all', maxHeight: '120px', overflow: 'auto',
            }}>
              {state.message}
            </div>
            <button className="btn btn-ghost" onClick={onClose} style={{ marginTop: '1rem' }}>
              Dismiss
            </button>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit components**

```bash
git add frontend/src/components/ContentRenderer.tsx frontend/src/components/TxStatus.tsx
git commit -m "feat: ContentRenderer and TxStatus overlay components"
```

---

### Task 8: Browse page and ItemCard

**Files:**
- Create: `frontend/src/components/Browse.tsx`
- Create: `frontend/src/components/ItemCard.tsx`

- [ ] **Step 1: Create ItemCard.tsx**

```tsx
import { Link } from 'react-router-dom';
import { ccc } from '@ckb-ccc/connector-react';
import { ContentRenderer } from './ContentRenderer';
import { categoriseContent, categoryLabel, badgeClass } from '../lib/content';
import { shannonsToCkb } from '../lib/codec';
import type { ListingInfo } from '../types';

interface ItemCardProps {
  listing: ListingInfo;
}

export function ItemCard({ listing }: ItemCardProps) {
  const { marketItem, lsdlArgs, outPoint } = listing;
  const category = categoriseContent(marketItem.contentType);
  const outPointId = `${ccc.hexFrom(outPoint.txHash)}:${outPoint.index}`;

  return (
    <Link to={`/item/${encodeURIComponent(outPointId)}`} style={{ textDecoration: 'none' }}>
      <div className="card" style={{ cursor: 'pointer' }}>
        <div style={{ marginBottom: '0.75rem' }}>
          <ContentRenderer item={marketItem} mode="preview" />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <span className={badgeClass(category)}>{categoryLabel(marketItem.contentType)}</span>
          <span className="price">{shannonsToCkb(lsdlArgs.totalValue)} CKB</span>
        </div>
        <div style={{ fontSize: '0.88rem', color: 'var(--text)', lineHeight: 1.4 }}>
          {marketItem.description.length > 80
            ? marketItem.description.slice(0, 80) + '...'
            : marketItem.description}
        </div>
        {lsdlArgs.royaltyBps > 0 && (
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.4rem' }}>
            {(lsdlArgs.royaltyBps / 100).toFixed(1)}% royalty
          </div>
        )}
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Create Browse.tsx**

```tsx
import { useState } from 'react';
import { useListings } from '../hooks/useListings';
import { ItemCard } from './ItemCard';
import { shannonsToCkb } from '../lib/codec';
import { categoriseContent, categoryLabel, badgeClass } from '../lib/content';
import { shortAddress } from '../lib/content';
import { ccc } from '@ckb-ccc/connector-react';
import { Link } from 'react-router-dom';

export function Browse() {
  const { listings, loading, error, refresh } = useListings();
  const [view, setView] = useState<'gallery' | 'list'>('gallery');

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 700 }}>
          Examine Cells
          {!loading && <span style={{ fontSize: '0.85rem', color: 'var(--muted)', fontWeight: 400, marginLeft: '0.75rem' }}>
            {listings.length} listed
          </span>}
        </h2>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <div className="view-toggle">
            <button className={view === 'gallery' ? 'active' : ''} onClick={() => setView('gallery')}>Grid</button>
            <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>List</button>
          </div>
          <button className="btn btn-ghost" onClick={refresh} style={{ padding: '0.3rem 0.6rem', fontSize: '0.85rem' }}>
            Refresh
          </button>
        </div>
      </div>

      {loading && (
        <div className="empty-state">
          <div className="tx-protocol-text" style={{ fontSize: '0.9rem' }}>Scanning indexer...</div>
        </div>
      )}

      {error && (
        <div style={{ color: 'var(--red)', padding: '1rem', background: 'var(--surface)', borderRadius: '8px', fontSize: '0.88rem' }}>
          Error: {error}
        </div>
      )}

      {!loading && !error && listings.length === 0 && (
        <div className="empty-state">
          <h3>No cells listed yet</h3>
          <p>Mint some content and list it for sale to see it here.</p>
        </div>
      )}

      {!loading && listings.length > 0 && view === 'gallery' && (
        <div className="items-grid">
          {listings.map(listing => (
            <ItemCard key={`${ccc.hexFrom(listing.outPoint.txHash)}:${listing.outPoint.index}`} listing={listing} />
          ))}
        </div>
      )}

      {!loading && listings.length > 0 && view === 'list' && (
        <div className="items-list">
          {listings.map(listing => {
            const outPointId = `${ccc.hexFrom(listing.outPoint.txHash)}:${listing.outPoint.index}`;
            return (
              <Link key={outPointId} to={`/item/${encodeURIComponent(outPointId)}`} style={{ textDecoration: 'none' }}>
                <div className="list-row">
                  <div>
                    <span className={badgeClass(categoriseContent(listing.marketItem.contentType))} style={{ marginRight: '0.5rem' }}>
                      {categoryLabel(listing.marketItem.contentType)}
                    </span>
                    <span style={{ color: 'var(--text)' }}>
                      {listing.marketItem.description.length > 60
                        ? listing.marketItem.description.slice(0, 60) + '...'
                        : listing.marketItem.description}
                    </span>
                  </div>
                  <span className="price">{shannonsToCkb(listing.lsdlArgs.totalValue)} CKB</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit browse page**

```bash
git add frontend/src/components/Browse.tsx frontend/src/components/ItemCard.tsx
git commit -m "feat: Browse page with gallery/list views and ItemCard"
```

---

### Task 9: ItemDetail page (view + buy + cancel)

**Files:**
- Create: `frontend/src/components/ItemDetail.tsx`

- [ ] **Step 1: Create ItemDetail.tsx**

```tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCcc, ccc } from '@ckb-ccc/connector-react';
import { ContentRenderer } from './ContentRenderer';
import { TxStatus } from './TxStatus';
import { createClient, fetchCell } from '../lib/indexer';
import { decodeMarketItem, decodeLsdlArgs, shannonsToCkb } from '../lib/codec';
import { categoriseContent, categoryLabel, badgeClass, shortAddress } from '../lib/content';
import { buildBuyTx, buildCancelTx } from '../lib/transactions';
import { LSDL, EXPLORER_URL } from '../config';
import type { TxState, MarketItem, DecodedLsdlArgs } from '../types';

export function ItemDetail() {
  const { outpoint } = useParams<{ outpoint: string }>();
  const navigate = useNavigate();
  const { signerInfo } = useCcc();
  const signer = signerInfo?.signer;

  const [cell, setCell] = useState<ccc.Cell | null>(null);
  const [marketItem, setMarketItem] = useState<MarketItem | null>(null);
  const [lsdlArgs, setLsdlArgs] = useState<DecodedLsdlArgs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [txState, setTxState] = useState<TxState>({ status: 'idle' });
  const [userLock, setUserLock] = useState<ccc.Script | null>(null);

  // Resolve user lock
  useEffect(() => {
    if (!signer) { setUserLock(null); return; }
    signer.getRecommendedAddressObj().then(a => setUserLock(a.script)).catch(() => setUserLock(null));
  }, [signer]);

  // Fetch cell data
  useEffect(() => {
    if (!outpoint) return;
    const decoded = decodeURIComponent(outpoint);
    const [txHash, indexStr] = decoded.split(':');
    const index = parseInt(indexStr, 10);

    setLoading(true);
    const client = createClient();
    fetchCell(client, { txHash, index }).then(c => {
      if (!c) { setError('Cell not found — it may have been purchased or cancelled.'); return; }
      setCell(c);

      const dataBytes = ccc.bytesFrom(c.outputData);
      setMarketItem(decodeMarketItem(dataBytes));

      // Check if this is an LSDL-locked cell
      const lockCodeHash = ccc.hexFrom(c.cellOutput.lock.codeHash);
      if (lockCodeHash === LSDL.DATA_HASH) {
        setLsdlArgs(decodeLsdlArgs(ccc.hexFrom(c.cellOutput.lock.args)));
      }
    }).catch(e => {
      setError(e instanceof Error ? e.message : String(e));
    }).finally(() => setLoading(false));
  }, [outpoint]);

  const isOwner = userLock && lsdlArgs && lsdlArgs.ownerLock.eq(userLock);
  const isListed = lsdlArgs !== null;

  async function handleBuy() {
    if (!signer || !cell) return;
    try {
      setTxState({ status: 'building', message: 'Constructing purchase transaction...' });
      const tx = await buildBuyTx(signer, cell);
      setTxState({ status: 'signing' });
      const txHash = await signer.sendTransaction(tx);
      setTxState({ status: 'success', txHash });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setTxState({ status: 'error', message: msg });
    }
  }

  async function handleCancel() {
    if (!signer || !cell) return;
    try {
      setTxState({ status: 'building', message: 'Constructing cancel transaction...' });
      const tx = await buildCancelTx(signer, cell);
      setTxState({ status: 'signing' });
      const txHash = await signer.sendTransaction(tx);
      setTxState({ status: 'success', txHash });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setTxState({ status: 'error', message: msg });
    }
  }

  if (loading) {
    return <div className="empty-state"><div className="tx-protocol-text">Inspecting cell...</div></div>;
  }

  if (error || !marketItem) {
    return (
      <div className="empty-state">
        <h3>Cell not found</h3>
        <p>{error || 'This cell may have been purchased or cancelled.'}</p>
        <button className="btn btn-ghost" onClick={() => navigate('/browse')} style={{ marginTop: '1rem' }}>
          Back to Browse
        </button>
      </div>
    );
  }

  const category = categoriseContent(marketItem.contentType);

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto' }}>
      <button className="btn btn-ghost" onClick={() => navigate(-1)} style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
        &larr; Back
      </button>

      {/* Content display with glow */}
      <div className="content-glow" style={{ marginBottom: '1.25rem' }}>
        <ContentRenderer item={marketItem} mode="full" />
      </div>

      {/* Metadata */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
          <div>
            <span className={badgeClass(category)} style={{ marginRight: '0.5rem' }}>
              {categoryLabel(marketItem.contentType)}
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{marketItem.contentType}</span>
          </div>
          {isListed && lsdlArgs && (
            <span className="price" style={{ fontSize: '1.2rem' }}>{shannonsToCkb(lsdlArgs.totalValue)} CKB</span>
          )}
        </div>

        <p style={{ fontSize: '0.95rem', lineHeight: 1.5, marginBottom: '1rem' }}>{marketItem.description}</p>

        {isListed && lsdlArgs && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.82rem' }}>
            <div style={{ color: 'var(--muted)' }}>Seller</div>
            <div><code className="mono">{shortAddress(ccc.hexFrom(lsdlArgs.ownerLock.args))}</code></div>
            <div style={{ color: 'var(--muted)' }}>Royalty</div>
            <div>{(lsdlArgs.royaltyBps / 100).toFixed(1)}%</div>
            <div style={{ color: 'var(--muted)' }}>Expiry</div>
            <div>{lsdlArgs.expiryEpoch === 0n ? 'Permanent' : `Epoch ${lsdlArgs.expiryEpoch.toString()}`}</div>
            <div style={{ color: 'var(--muted)' }}>Data size</div>
            <div>{marketItem.content.length} bytes</div>
          </div>
        )}
      </div>

      {/* Actions */}
      {isListed && signer && !isOwner && (
        <button className="btn btn-buy" onClick={handleBuy} style={{ width: '100%', padding: '0.8rem', fontSize: '1rem' }}>
          Buy for {shannonsToCkb(lsdlArgs!.totalValue)} CKB
        </button>
      )}
      {isListed && signer && isOwner && (
        <button className="btn btn-danger" onClick={handleCancel} style={{ width: '100%', padding: '0.8rem' }}>
          Cancel Listing
        </button>
      )}
      {isListed && !signer && (
        <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '1rem', fontSize: '0.9rem' }}>
          Connect your wallet to buy this cell
        </div>
      )}

      <TxStatus state={txState} onClose={() => setTxState({ status: 'idle' })} />
    </div>
  );
}
```

- [ ] **Step 2: Commit ItemDetail**

```bash
git add frontend/src/components/ItemDetail.tsx
git commit -m "feat: ItemDetail page with buy and cancel actions"
```

---

### Task 10: Mint page

**Files:**
- Create: `frontend/src/components/Mint.tsx`

- [ ] **Step 1: Create Mint.tsx**

```tsx
import { useState, useRef } from 'react';
import { useCcc } from '@ckb-ccc/connector-react';
import { ContentRenderer } from './ContentRenderer';
import { TxStatus } from './TxStatus';
import { buildMintTx } from '../lib/transactions';
import type { TxState, MarketItem } from '../types';

const MIME_OPTIONS = [
  'image/svg+xml',
  'image/png',
  'image/jpeg',
  'text/plain',
  'text/html',
  'application/json',
];

export function Mint() {
  const { signerInfo } = useCcc();
  const signer = signerInfo?.signer;
  const fileRef = useRef<HTMLInputElement>(null);

  const [contentType, setContentType] = useState('text/plain');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState<Uint8Array>(new Uint8Array());
  const [fileName, setFileName] = useState('');
  const [textInput, setTextInput] = useState('');
  const [txState, setTxState] = useState<TxState>({ status: 'idle' });

  const useFileMode = contentType.startsWith('image/') || contentType === 'application/json';

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    // Auto-detect content type from file
    if (file.type && MIME_OPTIONS.includes(file.type)) {
      setContentType(file.type);
    }

    file.arrayBuffer().then(buf => {
      setContent(new Uint8Array(buf));
    });
  }

  function handleTextChange(text: string) {
    setTextInput(text);
    setContent(new TextEncoder().encode(text));
  }

  const preview: MarketItem | null = content.length > 0
    ? { contentType, description: description || '(no description)', content }
    : null;

  const canMint = signer && content.length > 0 && description.trim().length > 0 && contentType.length > 0;

  async function handleMint() {
    if (!signer || !canMint) return;
    try {
      setTxState({ status: 'building', message: 'Constructing mint transaction...' });
      const tx = await buildMintTx(signer, contentType, description.trim(), content);
      setTxState({ status: 'signing' });
      const txHash = await signer.sendTransaction(tx);
      setTxState({ status: 'success', txHash });
      // Reset form on success
      setContent(new Uint8Array());
      setDescription('');
      setTextInput('');
      setFileName('');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setTxState({ status: 'error', message: msg });
    }
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '1.25rem' }}>Mint a Cell</h2>

      {!signer && (
        <div className="card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>
          Connect your wallet to mint
        </div>
      )}

      {signer && (
        <>
          <div className="card" style={{ marginBottom: '1rem' }}>
            {/* Content type */}
            <div className="form-group">
              <label className="form-label">Content Type</label>
              <select className="form-select" value={contentType} onChange={e => setContentType(e.target.value)}>
                {MIME_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            {/* Description */}
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                className="form-textarea"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe this cell's content..."
                maxLength={500}
              />
            </div>

            {/* Content input */}
            {useFileMode ? (
              <div className="form-group">
                <label className="form-label">Content File</label>
                <div
                  className="drop-zone"
                  onClick={() => fileRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('dragover'); }}
                  onDragLeave={e => e.currentTarget.classList.remove('dragover')}
                  onDrop={e => {
                    e.preventDefault();
                    e.currentTarget.classList.remove('dragover');
                    const file = e.dataTransfer.files[0];
                    if (file) {
                      setFileName(file.name);
                      if (file.type && MIME_OPTIONS.includes(file.type)) setContentType(file.type);
                      file.arrayBuffer().then(buf => setContent(new Uint8Array(buf)));
                    }
                  }}
                >
                  {fileName ? (
                    <span style={{ color: 'var(--accent)' }}>{fileName} ({content.length} bytes)</span>
                  ) : (
                    <span>Drop a file here or click to select</span>
                  )}
                </div>
                <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={handleFileSelect} />
              </div>
            ) : (
              <div className="form-group">
                <label className="form-label">Content</label>
                <textarea
                  className="form-textarea"
                  value={textInput}
                  onChange={e => handleTextChange(e.target.value)}
                  placeholder={contentType === 'text/html' ? '<html>...</html>' : 'Enter content...'}
                  style={{ minHeight: '120px', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.85rem' }}
                />
              </div>
            )}

            {content.length > 0 && (
              <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginTop: '0.5rem' }}>
                Data size: {content.length} bytes &middot; Estimated capacity: ~{Math.ceil(content.length * 2.2 / 100) + 300} CKB
              </div>
            )}
          </div>

          {/* Preview */}
          {preview && (
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '0.75rem' }}>Preview</div>
              <ContentRenderer item={preview} mode="full" />
            </div>
          )}

          {/* Mint button */}
          <button
            className="btn btn-primary"
            disabled={!canMint}
            onClick={handleMint}
            style={{ width: '100%', padding: '0.8rem', fontSize: '1rem' }}
          >
            Mint Cell
          </button>

          {!canMint && (
            <div style={{ textAlign: 'center', fontSize: '0.82rem', color: 'var(--muted)', marginTop: '0.5rem' }}>
              {!description.trim() && 'Add a description'}{!description.trim() && content.length === 0 && ' and '}{content.length === 0 && 'add content'}
            </div>
          )}
        </>
      )}

      <TxStatus state={txState} onClose={() => setTxState({ status: 'idle' })} />
    </div>
  );
}
```

- [ ] **Step 2: Commit Mint page**

```bash
git add frontend/src/components/Mint.tsx
git commit -m "feat: Mint page with file upload, text input, and content preview"
```

---

### Task 11: MyItems page with ListItem form

**Files:**
- Create: `frontend/src/components/MyItems.tsx`
- Create: `frontend/src/components/ListItem.tsx`

- [ ] **Step 1: Create ListItem.tsx**

```tsx
import { useState } from 'react';
import { useCcc, ccc } from '@ckb-ccc/connector-react';
import { TxStatus } from './TxStatus';
import { buildListTx } from '../lib/transactions';
import { ckbToShannons } from '../lib/codec';
import type { OwnedItem, TxState } from '../types';

interface ListItemProps {
  item: OwnedItem;
  onListed: () => void;
  onCancel: () => void;
}

export function ListItem({ item, onListed, onCancel }: ListItemProps) {
  const { signerInfo } = useCcc();
  const signer = signerInfo?.signer;

  const [price, setPrice] = useState('');
  const [royalty, setRoyalty] = useState('5');
  const [expiry, setExpiry] = useState('0');
  const [txState, setTxState] = useState<TxState>({ status: 'idle' });

  const priceValid = price.trim().length > 0 && !isNaN(Number(price)) && Number(price) > 0;
  const royaltyBps = Math.round(Number(royalty) * 100);
  const canList = signer && priceValid && royaltyBps >= 0 && royaltyBps <= 10000;

  async function handleList() {
    if (!signer || !canList) return;
    try {
      setTxState({ status: 'building', message: 'Constructing listing transaction...' });
      const tx = await buildListTx(
        signer,
        item.outPoint,
        ccc.hexFrom(new Uint8Array()), // will be replaced with actual outputData
        item.capacity,
        ckbToShannons(price),
        royaltyBps,
        BigInt(expiry),
      );
      setTxState({ status: 'signing' });
      const txHash = await signer.sendTransaction(tx);
      setTxState({ status: 'success', txHash });
      onListed();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setTxState({ status: 'error', message: msg });
    }
  }

  return (
    <div className="card" style={{ marginTop: '0.75rem', border: '1px solid var(--purple)' }}>
      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--purple)', marginBottom: '0.75rem' }}>
        List for Sale
      </div>

      <div className="form-group">
        <label className="form-label">Price (CKB)</label>
        <input
          className="form-input"
          type="text"
          value={price}
          onChange={e => setPrice(e.target.value)}
          placeholder="e.g. 500"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div className="form-group">
          <label className="form-label">Royalty %</label>
          <input
            className="form-input"
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={royalty}
            onChange={e => setRoyalty(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Expiry Epoch (0 = permanent)</label>
          <input
            className="form-input"
            type="number"
            min="0"
            value={expiry}
            onChange={e => setExpiry(e.target.value)}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button className="btn btn-primary" disabled={!canList} onClick={handleList} style={{ flex: 1 }}>
          List for {priceValid ? price : '...'} CKB
        </button>
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
      </div>

      <TxStatus state={txState} onClose={() => setTxState({ status: 'idle' })} />
    </div>
  );
}
```

- [ ] **Step 2: Create MyItems.tsx**

```tsx
import { useState } from 'react';
import { useCcc, ccc } from '@ckb-ccc/connector-react';
import { useMyItems } from '../hooks/useMyItems';
import { ContentRenderer } from './ContentRenderer';
import { ListItem } from './ListItem';
import { TxStatus } from './TxStatus';
import { categoriseContent, categoryLabel, badgeClass, shortHash } from '../lib/content';
import { shannonsToCkb } from '../lib/codec';
import { buildCancelTx } from '../lib/transactions';
import { createClient, fetchCell } from '../lib/indexer';
import type { TxState } from '../types';

export function MyItems() {
  const { signerInfo } = useCcc();
  const signer = signerInfo?.signer;
  const { owned, listed, loading, error, refresh } = useMyItems();
  const [listingFor, setListingFor] = useState<string | null>(null); // outpoint key
  const [txState, setTxState] = useState<TxState>({ status: 'idle' });

  async function handleCancelListing(txHash: string, index: number) {
    if (!signer) return;
    try {
      setTxState({ status: 'building', message: 'Constructing cancel transaction...' });
      const client = createClient();
      const cell = await fetchCell(client, { txHash, index });
      if (!cell) { setTxState({ status: 'error', message: 'Cell not found' }); return; }
      const tx = await buildCancelTx(signer, cell);
      setTxState({ status: 'signing' });
      const hash = await signer.sendTransaction(tx);
      setTxState({ status: 'success', txHash: hash });
      refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setTxState({ status: 'error', message: msg });
    }
  }

  if (!signer) {
    return (
      <div className="empty-state">
        <h3>Connect your wallet</h3>
        <p>View your owned and listed cells after connecting.</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 700 }}>My Cells</h2>
        <button className="btn btn-ghost" onClick={refresh} style={{ padding: '0.3rem 0.6rem', fontSize: '0.85rem' }}>
          Refresh
        </button>
      </div>

      {loading && <div className="empty-state"><div className="tx-protocol-text">Scanning your cells...</div></div>}

      {error && <div style={{ color: 'var(--red)', padding: '1rem', background: 'var(--surface)', borderRadius: '8px', fontSize: '0.88rem' }}>Error: {error}</div>}

      {/* Owned items */}
      {!loading && (
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1rem', color: 'var(--green)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
            Owned ({owned.length})
          </h3>
          {owned.length === 0 && <div style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>No owned MarketItem cells. Mint one to get started.</div>}
          {owned.map(item => {
            const key = `${ccc.hexFrom(item.outPoint.txHash)}:${item.outPoint.index}`;
            return (
              <div key={key} style={{ marginBottom: '0.75rem' }}>
                <div className="card">
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                    <div style={{ width: '100px', flexShrink: 0 }}>
                      <ContentRenderer item={item.marketItem} mode="preview" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                        <span className={badgeClass(categoriseContent(item.marketItem.contentType))}>
                          {categoryLabel(item.marketItem.contentType)}
                        </span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{item.marketItem.content.length} bytes</span>
                      </div>
                      <div style={{ fontSize: '0.88rem', marginBottom: '0.5rem' }}>{item.marketItem.description}</div>
                      <button
                        className="btn btn-primary"
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.82rem' }}
                        onClick={() => setListingFor(listingFor === key ? null : key)}
                      >
                        {listingFor === key ? 'Close' : 'List for Sale'}
                      </button>
                    </div>
                  </div>
                </div>
                {listingFor === key && (
                  <ListItem
                    item={item}
                    onListed={() => { setListingFor(null); refresh(); }}
                    onCancel={() => setListingFor(null)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Listed items */}
      {!loading && (
        <div>
          <h3 style={{ fontSize: '1rem', color: 'var(--purple)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--purple)', display: 'inline-block' }} />
            Listed ({listed.length})
          </h3>
          {listed.length === 0 && <div style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>No items listed for sale.</div>}
          {listed.map(listing => {
            const key = `${ccc.hexFrom(listing.outPoint.txHash)}:${listing.outPoint.index}`;
            return (
              <div key={key} className="card" style={{ marginBottom: '0.75rem', borderColor: 'color-mix(in srgb, var(--purple) 30%, var(--border))' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                  <div style={{ width: '100px', flexShrink: 0 }}>
                    <ContentRenderer item={listing.marketItem} mode="preview" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <span className={badgeClass(categoriseContent(listing.marketItem.contentType))}>
                        {categoryLabel(listing.marketItem.contentType)}
                      </span>
                      <span className="price">{shannonsToCkb(listing.lsdlArgs.totalValue)} CKB</span>
                    </div>
                    <div style={{ fontSize: '0.88rem', marginBottom: '0.5rem' }}>{listing.marketItem.description}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.5rem' }}>
                      {(listing.lsdlArgs.royaltyBps / 100).toFixed(1)}% royalty &middot;
                      {listing.lsdlArgs.expiryEpoch === 0n ? ' Permanent' : ` Epoch ${listing.lsdlArgs.expiryEpoch}`}
                    </div>
                    <button
                      className="btn btn-danger"
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.82rem' }}
                      onClick={() => handleCancelListing(ccc.hexFrom(listing.outPoint.txHash), listing.outPoint.index)}
                    >
                      Cancel Listing
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <TxStatus state={txState} onClose={() => setTxState({ status: 'idle' })} />
    </div>
  );
}
```

- [ ] **Step 3: Commit MyItems + ListItem**

```bash
git add frontend/src/components/MyItems.tsx frontend/src/components/ListItem.tsx
git commit -m "feat: MyItems page with owned/listed sections and ListItem form"
```

---

### Task 12: Copy assets, fix ListItem outputData, and verify full build

**Files:**
- Copy: `cellSwap1.png` and `cellswap2.png` to `frontend/public/`
- Modify: `frontend/src/components/ListItem.tsx` (fix outputData)

- [ ] **Step 1: Copy image assets to public/**

```bash
cp ~/Documents/nft_images/cellSwap1.png frontend/public/
cp ~/Documents/nft_images/cellswap2.png frontend/public/
```

- [ ] **Step 2: Fix ListItem outputData**

In `ListItem.tsx`, the `buildListTx` call passes an empty hex string for `itemData`. It needs the actual cell's outputData. Update the component to fetch the live cell data first:

Replace the `handleList` function:

```tsx
  async function handleList() {
    if (!signer || !canList) return;
    try {
      setTxState({ status: 'building', message: 'Fetching cell data...' });
      // Fetch live cell to get the actual outputData (hex)
      const client = (await import('../lib/indexer')).createClient();
      const cell = await (await import('../lib/indexer')).fetchCell(client, item.outPoint);
      if (!cell) { setTxState({ status: 'error', message: 'Cell not found on-chain' }); return; }

      setTxState({ status: 'building', message: 'Constructing listing transaction...' });
      const tx = await buildListTx(
        signer,
        item.outPoint,
        cell.outputData,
        item.capacity,
        ckbToShannons(price),
        royaltyBps,
        BigInt(expiry),
      );
      setTxState({ status: 'signing' });
      const txHash = await signer.sendTransaction(tx);
      setTxState({ status: 'success', txHash });
      onListed();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setTxState({ status: 'error', message: msg });
    }
  }
```

- [ ] **Step 3: Run full build**

Run: `cd frontend && npm run build`
Expected: Build completes with no errors, output in `frontend/dist/`

- [ ] **Step 4: Commit assets and fix**

```bash
git add frontend/public/cellSwap1.png frontend/public/cellswap2.png frontend/src/components/ListItem.tsx
git commit -m "feat: add image assets, fix ListItem to fetch live cell data"
```

---

### Task 13: Verify dev server and smoke test

- [ ] **Step 1: Start dev server**

Run: `cd frontend && npm run dev`
Expected: Vite serves at `http://localhost:5173`

- [ ] **Step 2: Verify all routes load**

Navigate to each route in browser:
- `http://localhost:5173/#/browse` — should show "Examine Cells" header, Gallery/List toggle, and either listings or empty state
- `http://localhost:5173/#/mint` — should show "Mint a Cell" form (or "Connect wallet" prompt)
- `http://localhost:5173/#/my-items` — should show "Connect your wallet" prompt
- Click "Connect Wallet" — CCC modal should appear with JoyID option

- [ ] **Step 3: Verify browse loads real testnet data**

After connecting wallet or just loading browse page:
- The indexer query should run against `testnet.ckb.dev/indexer`
- If the 5 test items from the session are still listed, they should appear
- If no items appear, verify in browser console that the indexer query doesn't error

- [ ] **Step 4: Final commit with .gitignore**

Create `frontend/.gitignore`:
```
node_modules
dist
```

```bash
git add frontend/.gitignore
git commit -m "chore: add frontend .gitignore"
```

---

### Task 14: Update root README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add frontend section to README**

Add a "Frontend" section to the root README documenting:
- How to install and run: `cd frontend && npm install && npm run dev`
- How to build: `npm run build`
- Stack: React + Vite + CCC + JoyID
- What it does: browse, buy, mint, list, cancel MarketItem cells
- Link to cellswap.xyz
- Note: testnet only, forkable reference implementation

- [ ] **Step 2: Commit README**

```bash
git add README.md
git commit -m "docs: add frontend setup and usage to README"
```
