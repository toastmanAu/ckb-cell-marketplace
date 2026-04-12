# CKB Cell Marketplace

A universal, fully on-chain marketplace for any CKB cell content — art, scripts, ePubs, data files, deeds. Not just NFTs. Everything.

The cell IS the listing. The lock IS the market. No database, no backend, no intermediary.

## Live on Testnet

| Contract | Type ID | Binary | Purpose |
|----------|---------|--------|---------|
| **market-item-type** | `0xa80b8554...4e48a4f` | 11 KB | Type script — validates MarketItem envelope |
| **LSDL** | `0xd1e6732b...d07af5` | 15.5 KB | Lock script — handles sales with royalties + expiry |

### market-item-type (Type Script)

Validates the MarketItem molecule envelope — ensures content_type, description, and content are present and immutable across transfers.

```
TX:       0xb23607df31ad02137f1836ad23e6ebe5dd864125d0e31ccd14d333937eb76388
Type ID:  0xa80b8554454d2b8cd619bcbd63895bb00b14709809e37806f6dbde0302e48a4f
Data Hash: 0x613bdff5b54154ae98338488cf0173fff0a0cbfc785534c38f24425a678e530f
Cycles:   15K create / 18K transfer / 8K burn
Tests:    9/9 passing
```

### LSDL — Less Simple DEX Lock (Lock Script)

Handles trustless cell sales with on-chain creator royalties and optional listing expiration. Fork of Nervina's SDL, stripped of FT/UDT baggage.

```
TX:       0xfc5fc948a406a6b7bc5636642d57d462a0789479dd1197dbb14a35079c936dd3
Type ID:  0xd1e6732bccd4f047949519f90c90a4372de0732976313442f6a708849dd07af5
Data Hash: 0xbf3b13493c34a991a8885c9670d05873960cb18b04628a72ce5ea186ddee5612
Cycles:   28K cancel / 43K purchase / 50K purchase+royalty
Tests:    14/14 passing
```

Full LSDL docs: [ckb-lsdl repo](https://github.com/toastmanAu/ckb-lsdl)

## How It Works

### Two Types of Content

**MarketItem (new envelope)** — for content that doesn't already have on-chain metadata:

```mol
table MarketItem {
    content_type: Bytes,   // MIME string ("image/png", "application/epub+zip")
    description:  Bytes,   // seller listing text (UTF-8)
    content:      Bytes,   // raw payload
}
```

**Existing formats** — Spore DOBs and CKBFS files work natively. The marketplace detects content format by checking the cell's type script hash and routes to the right view.

### Listing Flow

1. Seller transfers their cell to the LSDL lock with price, creator address, and royalty in the lock args
2. The cell appears on the marketplace — content type determines Gallery (images) or Files (data) view
3. Anyone can buy by constructing a transaction that pays the seller + creator royalty
4. Seller can cancel anytime. Listings auto-expire after the set epoch (optional).

### LSDL Lock Args

```
owner_lock:        Script     who can cancel + receives payment
total_value:       u128       price in shannons
creator_lock_hash: [u8; 20]   blake160 of creator (royalty recipient)
royalty_bps:       u16        basis points (500 = 5%)
expiry_epoch:      u64        0 = permanent, else auto-delist epoch
```

## Frontend Views

| View | Content Types | Rendering |
|------|--------------|-----------|
| **Gallery** | image/*, video/*, text/html | Visual grid with previews |
| **Files** | application/*, text/plain, everything else | Table with type, description, price |

Content detection:
- Type script = Spore → parse SporeData for content_type
- Type script = CKBFS → parse CKBFSData for content_type
- Type script = MarketItem → parse MarketItem for content_type
- No type script → "application/octet-stream"

## Test Data on Testnet

**5 MarketItem cells** (various content types):
- 2x SVG images, 1x plaintext, 1x JSON, 1x HTML

**4 Spore DOBs** (Digital Land collection):
- Cluster: "Digital Land" (`0xaa681dda...`)
- 4 JPEG images (512x512, cyberpunk/biodome themes)
- 13 more pending CKBFS storage rewrite

## Build

```bash
# Type script
make build    # → build/market-item-type (11 KB)
make test     # 9 tests

# LSDL is in separate repo: ~/ckb-lsdl
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
├── deploy/                       # Testnet deployment info
├── docs/
│   └── benchmarks/               # Cycle cost reports
└── build/                        # Compiled binary
```

## Related Repos

- **[ckb-lsdl](https://github.com/toastmanAu/ckb-lsdl)** — Less Simple DEX Lock (sale lock with royalties)
- **[ckb-knowledge-graphs](https://github.com/toastmanAu/ckb-knowledge-graphs)** — Interactive architecture graphs for CKB ecosystem
- **[ckb-dob-minter](https://github.com/toastmanAu/ckb-dob-minter)** — Spore DOB minting app (frontend reference)

## Roadmap

### Phase 1 — MVP (current)
- [x] MarketItem molecule schema + type script
- [x] LSDL lock script (royalties + expiration)
- [x] Both deployed to testnet
- [x] Test data minted
- [ ] Frontend marketplace (React/Vite + CCC)
- [ ] NFT minting interface (based on DOB minter)

### Phase 2 — Multi-Format
- [ ] Spore DOB detection + rendering
- [ ] CKBFS file detection + lazy resolution
- [ ] Type ID enforcement in type script
- [ ] CKBFS-backed image minting

### Phase 3 — Enhanced Trading
- [ ] LSDL v2: xUDT pricing
- [ ] Auction mode (OTX-based)
- [ ] Bundle sales

## License

MIT

## Built By

[Wyltek Industries](https://github.com/toastmanAu) — building on CKB.
