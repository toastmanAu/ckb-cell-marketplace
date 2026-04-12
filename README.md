# CellSwap — On-Chain Cell Marketplace

**Live demo: [cellswap.xyz](https://cellswap.xyz)** | [cellswap.pages.dev](https://cellswap.pages.dev)

A universal, fully on-chain marketplace for any CKB cell content — art, scripts, ePubs, data files, deeds. Not just NFTs. Everything.

The cell IS the listing. The lock IS the market. No database, no backend, no intermediary.

This is a **forkable testnet reference implementation** — a working demo that anyone can clone, point at their own contracts, and deploy.

## What It Does

- **Browse** — view all listed cells on the marketplace with gallery and list views
- **Buy** — purchase listed cells with automatic seller payment + creator royalty
- **Mint** — create new MarketItem cells with any content type (text, images, HTML, JSON, SVG)
- **List** — set a price, royalty percentage, and optional expiry for your cells
- **Cancel** — reclaim your listed cells at any time
- **Image optimization** — client-side resize, format conversion, and quality controls
- **CKBFS storage** — large files stored in witnesses via CKBFS V3, resolved and rendered from chain

All transactions are signed client-side via JoyID (or MetaMask). No backend, no admin keys, fully trustless.

## Live on Testnet

| Contract | Type ID | Binary | Purpose |
|----------|---------|--------|---------|
| **market-item-type** | `0xa80b8554...4e48a4f` | 11 KB | Type script — validates MarketItem envelope |
| **LSDL** | `0xd1e6732b...d07af5` | 15.5 KB | Lock script — handles sales with royalties + expiry |

### market-item-type (Type Script)

Validates the MarketItem molecule envelope — ensures content_type, description, and content are present and immutable across transfers.

```
TX:        0xb23607df31ad02137f1836ad23e6ebe5dd864125d0e31ccd14d333937eb76388
Type ID:   0xa80b8554454d2b8cd619bcbd63895bb00b14709809e37806f6dbde0302e48a4f
Data Hash: 0x613bdff5b54154ae98338488cf0173fff0a0cbfc785534c38f24425a678e530f
Cycles:    15K create / 18K transfer / 8K burn
Tests:     9/9 passing
```

### LSDL — Less Simple DEX Lock (Lock Script)

Handles trustless cell sales with on-chain creator royalties and optional listing expiration. Fork of Nervina's SDL, stripped of FT/UDT baggage.

```
TX:        0xfc5fc948a406a6b7bc5636642d57d462a0789479dd1197dbb14a35079c936dd3
Type ID:   0xd1e6732bccd4f047949519f90c90a4372de0732976313442f6a708849dd07af5
Data Hash: 0xbf3b13493c34a991a8885c9670d05873960cb18b04628a72ce5ea186ddee5612
Cycles:    28K cancel / 43K purchase / 50K purchase+royalty
Tests:     14/14 passing
```

Full LSDL docs: [ckb-lsdl repo](https://github.com/toastmanAu/ckb-lsdl)

## How It Works

### MarketItem Envelope

```mol
table MarketItem {
    content_type: Bytes,   // MIME string ("image/png", "application/epub+zip")
    description:  Bytes,   // seller listing text (UTF-8)
    content:      Bytes,   // raw payload or ckbfs:// URI for large files
}
```

### LSDL Lock Args

```
owner_lock:        Script     who can cancel + receives payment
total_value:       u128       price in shannons
creator_lock_hash: [u8; 20]   blake160 of creator (royalty recipient)
royalty_bps:       u16        basis points (500 = 5%)
expiry_epoch:      u64        0 = permanent, else auto-delist epoch
```

### Listing Flow

1. **Mint** — create a MarketItem cell with your content (inline or via CKBFS)
2. **List** — transfer the cell to the LSDL lock with price, royalty, and expiry in the lock args
3. **Browse** — anyone can see listed cells, with content rendered by type (images, text, HTML, JSON)
4. **Buy** — construct a TX that pays the seller + creator royalty at the correct output positions
5. **Cancel** — seller reclaims their cell at any time by signing with the owner lock

### Storage Modes

| Mode | Best For | Cost | How |
|------|----------|------|-----|
| **Inline** | Small content (<50 KB) — text, SVG, JSON, HTML | ~1 CKB per byte | Raw bytes in cell data |
| **CKBFS** | Large files — images, documents | ~225 CKB (index cell) | File in witnesses, `ckbfs://` URI in cell |

The frontend auto-selects CKBFS for files over 50 KB and includes client-side image optimization (resize, format conversion, quality control) to minimize storage costs.

## CellSwap Frontend

### Quick Start

```bash
cd frontend
npm install
npm run dev      # → http://localhost:5173
npm run build    # → frontend/dist/ (deploy anywhere as static files)
```

### Stack

- **React 18** + **Vite 5** + **TypeScript**
- **@ckb-ccc/connector-react** — wallet connection (JoyID + MetaMask)
- **@ckbfs/api** — CKBFS V3 publishing
- **Hash router** SPA — no server required

### Architecture

```
frontend/src/
├── config.ts              # Contract addresses + RPC URLs (forkers: change this one file)
├── types.ts               # MarketItem, ListingInfo, DecodedLsdlArgs, TxState
├── lib/
│   ├── codec.ts           # MarketItem + LSDL molecule encode/decode
│   ├── indexer.ts          # Query testnet indexer via CCC
│   ├── transactions.ts    # Build mint, list, buy, cancel TXs
│   ├── content.ts         # MIME categorisation, display helpers
│   ├── image.ts           # Browser Canvas API resize/format/quality
│   ├── ckbfs.ts           # CKBFS V3 publishing via @ckbfs/api
│   └── ckbfs-resolver.ts  # Resolve ckbfs:// URIs to file bytes from chain
├── hooks/
│   ├── useListings.ts     # Fetch all marketplace listings
│   └── useMyItems.ts      # Fetch user's owned + listed cells
└── components/
    ├── Layout.tsx          # Header, nav, footer (glass blur, hex background)
    ├── WalletButton.tsx    # Connect/disconnect via CCC
    ├── Browse.tsx          # Gallery + list views with content badges
    ├── ItemCard.tsx        # Single listing card
    ├── ItemDetail.tsx      # Full item view with buy/cancel
    ├── Mint.tsx            # Create content with image optimization + CKBFS
    ├── MyItems.tsx         # Owned + listed sections
    ├── ListItem.tsx        # List-for-sale form with confirmation
    ├── ContentRenderer.tsx # Type-aware rendering + CKBFS resolution
    └── TxStatus.tsx        # TX confirmation overlay
```

### Fork It

All contract addresses and network config live in **`frontend/src/config.ts`**. Change that one file to point at your own deployed contracts:

```typescript
export const MARKET_ITEM_TYPE = {
  TX_HASH: '0x...',    // your deploy TX
  TYPE_ID: '0x...',    // your type ID
  DATA_HASH: '0x...',  // your binary hash
};

export const LSDL = {
  TX_HASH: '0x...',
  TYPE_ID: '0x...',
  DATA_HASH: '0x...',
};
```

The `lib/` layer has zero React dependencies — reusable in CLI tools, bots, or other frameworks.

### Deploy

Static SPA — deploy the `frontend/dist/` folder to any host:

```bash
# Cloudflare Pages
wrangler pages deploy frontend/dist --project-name cellswap

# Vercel
cd frontend && vercel --prod

# Netlify
netlify deploy --prod --dir frontend/dist

# Or just upload dist/ to any static hosting
```

## Build (Contracts)

```bash
# Type script (requires ckb-std toolchain)
make build    # → build/market-item-type (11 KB)
make test     # 9 tests

# LSDL is in separate repo
# https://github.com/toastmanAu/ckb-lsdl
```

## Project Structure

```
ckb-cell-marketplace/
├── contracts/market-item-type/   # Type script (Rust, RISC-V)
│   └── src/
│       ├── main.rs               # Entry point
│       ├── entry.rs              # Create/Transfer/Burn validation
│       ├── error.rs              # Error codes
│       └── generated/            # Molecule bindings
├── schemas/market_item.mol       # MarketItem molecule schema
├── tests/                        # 9 ckb-testtool integration tests
├── scripts/
│   ├── mint-test-items.js        # CCC-based MarketItem minting
│   ├── mint-digital-land.js      # Spore DOB batch minting
│   ├── deploy-testnet.sh         # Deployment script
│   └── deployment.toml           # Deploy config
├── frontend/                     # CellSwap SPA (React/Vite/TS)
│   ├── src/lib/                  # Blockchain logic (codec, indexer, TX builders)
│   ├── src/components/           # UI components
│   └── src/hooks/                # React hooks
├── docs/
│   ├── benchmarks/               # Cycle cost reports
│   └── superpowers/              # Design spec + implementation plan
├── deploy/                       # Testnet deployment info
└── build/                        # Compiled binary
```

## Related Repos

- **[ckb-lsdl](https://github.com/toastmanAu/ckb-lsdl)** — Less Simple DEX Lock (sale lock with royalties)
- **[ckb-knowledge-graphs](https://github.com/toastmanAu/ckb-knowledge-graphs)** — Interactive architecture graphs for CKB ecosystem
- **[ckb-dob-minter](https://github.com/toastmanAu/ckb-dob-minter)** — Spore DOB minting app (frontend reference)

## Roadmap

### Phase 1 — MVP (complete)
- [x] MarketItem molecule schema + type script
- [x] LSDL lock script (royalties + expiration)
- [x] Both deployed to testnet
- [x] Test data minted (SVG, text, JSON, HTML, images)
- [x] CellSwap frontend — cellswap.xyz
- [x] Full loop: mint, list, buy, cancel
- [x] CKBFS storage + on-chain image resolution
- [x] Client-side image optimization
- [x] Deployed to Cloudflare Pages

### Phase 2 — Multi-Format
- [ ] Spore DOB detection + rendering
- [ ] CKBFS file lazy resolution with caching
- [ ] Type ID enforcement in type script
- [ ] Search and filter listings

### Phase 3 — Enhanced Trading
- [ ] LSDL v2: xUDT pricing
- [ ] Auction mode (OTX-based)
- [ ] Bundle sales
- [ ] Custom node selection (point at your own CKB node)

## License

MIT

## Built By

[Wyltek Industries](https://github.com/toastmanAu) — building on Nervos CKB.
