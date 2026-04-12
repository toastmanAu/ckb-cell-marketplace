# CellSwap Frontend — Design Spec

**Date:** 2026-04-13
**Domain:** cellswap.xyz
**Purpose:** Forkable testnet reference implementation of a universal CKB cell marketplace. Full MVP loop: browse, buy, mint, list, cancel. Not the production marketplace — a working demo others can clone and adapt.

---

## Stack & Architecture

- **Framework:** React 18 + Vite + TypeScript
- **Wallet:** `@ckb-ccc/connector-react` (JoyID primary, MetaMask via CCC)
- **Polyfills:** `vite-plugin-node-polyfills` (Buffer, crypto, stream, util, process)
- **Routing:** React Router with hash routes (`#/browse`, `#/mint`, `#/my-items`, `#/item/:outpoint`)
- **State:** React context + hooks (no external state library)
- **Deploy:** Static SPA — Cloudflare Pages, Vercel, or any static host
- **Network:** CKB testnet only by default

## Project Structure

```
frontend/
├── index.html
├── vite.config.ts
├── package.json
├── tsconfig.json
├── public/
│   ├── cellswap-logo.svg
│   ├── cellSwap1.png          # Hero/banner image
│   └── cellswap2.png          # OG social share image
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── config.ts              # Contract addresses, RPC URLs, constants (forkers change this one file)
│   ├── types.ts               # MarketItem, ListingInfo, ContentType
│   ├── styles/
│   │   └── global.css         # Dark neon theme, CSS variables
│   ├── components/
│   │   ├── Layout.tsx         # Header, nav tabs, footer, sticky glass bar
│   │   ├── WalletButton.tsx   # Connect/disconnect via CCC
│   │   ├── Browse.tsx         # Grid of listed items (Gallery + List views)
│   │   ├── ItemCard.tsx       # Single listing card with hex motif
│   │   ├── ItemDetail.tsx     # Full item view + buy/cancel actions
│   │   ├── Mint.tsx           # Create new MarketItem cell
│   │   ├── ListItem.tsx       # Transfer owned item to LSDL lock (inline form)
│   │   ├── MyItems.tsx        # User's owned + listed items
│   │   └── ContentRenderer.tsx # Type-aware: SVG inline, text, JSON highlighted, HTML sandboxed iframe
│   ├── lib/
│   │   ├── indexer.ts         # Query testnet indexer for cells
│   │   ├── codec.ts           # Encode/decode MarketItem molecule bytes
│   │   ├── transactions.ts    # Build mint, list, buy, cancel TXs
│   │   └── content.ts         # MIME detection, content preview logic
│   └── hooks/
│       ├── useListings.ts     # Fetch + cache LSDL-locked cells
│       ├── useMyItems.ts      # Fetch user's owned MarketItem cells
│       └── useNetwork.ts      # Network state + persistence
```

## Contract Addresses (Testnet)

```
market-item-type:
  TX:        0xb23607df31ad02137f1836ad23e6ebe5dd864125d0e31ccd14d333937eb76388
  Type ID:   0xa80b8554454d2b8cd619bcbd63895bb00b14709809e37806f6dbde0302e48a4f
  Data Hash: 0x613bdff5b54154ae98338488cf0173fff0a0cbfc785534c38f24425a678e530f

LSDL:
  TX:        0xfc5fc948a406a6b7bc5636642d57d462a0789479dd1197dbb14a35079c936dd3
  Type ID:   0xd1e6732bccd4f047949519f90c90a4372de0732976313442f6a708849dd07af5
  Data Hash: 0xbf3b13493c34a991a8885c9670d05873960cb18b04628a72ce5ea186ddee5612
```

## Pages & User Flows

### #/browse (default landing)

- Grid of all LSDL-locked MarketItem cells queried from testnet indexer
- Two view modes: **Gallery** (visual cards for image content) and **List** (compact table for all types)
- Each card: content preview, description, price in CKB, content type badge (color-coded), expiry status
- Click card → `#/item/:outpoint` detail view
- Hero: cellSwap1.png dimmed behind the grid as atmospheric background

### #/item/:outpoint (detail)

- Full content rendering via ContentRenderer (SVG inline, text formatted, JSON syntax-highlighted, HTML in sandboxed iframe)
- Metadata as holographic-styled floating panels: seller address, price, royalty %, expiry countdown
- **Buy** button (wallet connected, not the seller) — magenta accent
- **Cancel** button (wallet connected, is the owner) — muted/danger style
- TX confirmation state: pulsing cyan glow + "CELL SWAP PROTOCOL IN PROGRESS" monospace text
- Inspection/examination aesthetic — glowing backlight on the content preview

### #/mint

- Form: content type (auto-detect from file upload or manual dropdown), description field, file upload or direct paste
- Live preview of content before minting
- Mints a MarketItem cell owned by the connected wallet (not listed)
- After success → option to immediately list via inline ListItem form

### #/my-items

- Two sections: **Owned** (MarketItem cells in user's lock) and **Listed** (user's items in LSDL lock)
- Owned items: **List for Sale** button → inline form with price (CKB), royalty % (as creator), expiry (optional, 0 = permanent)
- Listed items: **Cancel Listing** button

## Transaction Logic

### Mint (create MarketItem)

- **Inputs:** capacity cells from wallet (CCC auto-selects)
- **Outputs[0]:** cell with `lock = user's lock`, `type = market-item-type (Type ID hash_type)`, `data = molecule MarketItem(content_type, description, content)`
- **Cell Deps:** market-item-type deploy cell

### List (transfer to LSDL lock)

- **Inputs:** owned MarketItem cell + capacity cells for fee
- **Outputs[0]:** same cell, `lock = LSDL` with args `{owner_lock, total_value, creator_lock_hash, royalty_bps, expiry_epoch}`, data unchanged
- **Cell Deps:** market-item-type deploy cell + LSDL deploy cell
- Type script enforces content_type and content immutability on transfer

### Buy (satisfy LSDL)

- **Inputs:** LSDL-locked MarketItem cell (at some input index N) + buyer's capacity cells
- **Outputs[N]:** capacity cell to seller with `lock = owner_lock` from LSDL args (total_value - royalty_amount). MUST be at same index N as the consumed LSDL input.
- **Outputs[N+1]:** capacity cell to creator (royalty_amount = total_value * royalty_bps / 10000), lock must be secp256k1 with args starting with creator_lock_hash
- **Outputs[any]:** MarketItem cell with `lock = buyer's lock` (ownership transferred). Position is not enforced by LSDL — can go at any other output index.
- **Cell Deps:** market-item-type + LSDL deploy cells + secp256k1 lock
- Output ordering at positions N and N+1 is enforced by the LSDL contract and must be exact

### Cancel (owner reclaims)

- **Inputs:** LSDL-locked MarketItem cell (owner's lock signature satisfies LSDL)
- **Outputs[0]:** MarketItem cell with `lock = owner's lock`
- **Cell Deps:** market-item-type + LSDL deploy cells

### Indexer Queries

- **All listings:** search by lock `code_hash = LSDL data hash`, filter by `type code_hash = market-item-type Type ID`
- **User's owned items:** search by `lock = user's lock script`, `type code_hash = market-item-type Type ID`
- **User's listed items:** search by lock `code_hash = LSDL data hash`, decode args, filter where `owner_lock` matches user
- **Endpoint:** `https://testnet.ckb.dev/indexer`

## Visual Theme

### Design Direction

Sci-fi precision laboratory aesthetic — CellSwap is a protocol instrument for examining and trading on-chain cells. Not a casual NFT bazaar. Language uses "examine", "inspect", "protocol", "specimen" over "browse", "view", "store", "item".

Derived from: uiExample.png (dark dashboard with hex grid), cellSwap1.png (sci-fi lab with green/purple cells), cellswap2.png (first-person cell inspection).

### CSS Variables

```css
:root {
  --bg:         #080a0f;
  --surface:    #0f1218;
  --surface2:   #161b24;
  --border:     #1c2333;
  --accent:     #00d4ff;     /* cyan — primary actions, links */
  --green:      #00e5a0;     /* owned items, success, mint */
  --purple:     #8b5cf6;     /* listed items, for-sale badges */
  --magenta:    #f43f8e;     /* buy buttons, price highlights */
  --text:       #e2e8f0;     /* primary text */
  --muted:      #64748b;     /* secondary text, timestamps */
}
```

### Component Styling

- **Item cards:** Dark surface, 1px border, subtle gradient sheen (holographic nod). Content type badge top-left (color-coded). Price bottom-right in magenta.
- **Hexagonal accents:** Hex-shaped content type icons, hex clip-path on hover states, hex grid pattern as subtle background texture.
- **Glass header:** Sticky, `backdrop-filter: blur(12px)`, matching DOB minter pattern.
- **TX processing state:** Pulsing cyan glow + "CELL SWAP PROTOCOL IN PROGRESS" in monospace.
- **Content preview glow:** Subtle backlight effect on the item detail content area (microscope illumination from cellswap2).
- **Typography:** System UI for body, monospace (JetBrains Mono / Fira Code) for addresses, hashes, CKB amounts.

### Content Type Badges

```
image/*        → cyan
text/plain     → green
application/*  → purple
text/html      → magenta
```

### Semantic Colors

```
Owned cells    → green accent/border
Listed cells   → purple accent/border
Buying action  → magenta
Success state  → green
Error state    → red (#ff4560)
Processing     → cyan pulse
```

### Responsive Breakpoints

- **Desktop (>1024px):** 3-4 column grid
- **Tablet (768-1024px):** 2 column grid
- **Mobile (<768px):** single column, consider bottom nav bar

## Image Assets

- `cellSwap1.png` — Hero banner on browse page (dimmed background), X teaser already posted
- `cellswap2.png` — OG meta image for social sharing (`<meta property="og:image">`)
- `cellswap-logo.svg` — to be created, hex-themed logomark

## Forkability Requirements

- All contract addresses and RPC URLs in `config.ts` — single file to change
- `lib/` layer has zero React dependencies — reusable in CLI tools or other frameworks
- TypeScript throughout for discoverability
- Clean comments on transaction construction (the hardest part for forkers)
- README with setup, deploy, and fork instructions

## Out of Scope (v1)

- Mainnet support (testnet only)
- CKBFS-backed content storage (future — inline content only for now)
- Search/filter/sort on browse page (manual scan is fine for demo volume)
- Price history or analytics
- Notifications or activity feed
- Type ID enforcement hardening (Phase 2 contract work)
