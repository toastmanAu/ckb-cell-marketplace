# CKB Cell Marketplace

A universal, fully on-chain marketplace for any CKB cell content — art, scripts, ePubs, data files, deeds.

## market-item-type

Type script that validates the MarketItem envelope format:

- **Create:** cell data must be valid MarketItem (content_type + description + content, all non-empty, valid MIME)
- **Transfer:** content_type and content are immutable; description may change
- **Burn:** always allowed

### Binary

- Size: 11 KB
- Cycles: 15K (create), 18K (transfer), 8K (burn)

### Build

```bash
make build    # Produces build/market-item-type
make test     # Run 9 tests
make fmt      # Format code
make clippy   # Lint
```

### MarketItem Schema (Molecule)

```mol
table MarketItem {
    content_type: Bytes,   // MIME string ("image/png", "application/epub+zip")
    description:  Bytes,   // seller listing text (UTF-8)
    content:      Bytes,   // raw payload
}
```

### Deploy to Testnet

```bash
./scripts/deploy-testnet.sh
```

### Project Structure

```
ckb-cell-marketplace/
├── contracts/market-item-type/   # Type script (Rust, RISC-V)
│   └── src/
│       ├── main.rs               # Entry point
│       ├── entry.rs              # Validation logic
│       ├── error.rs              # Error codes
│       └── generated/            # Molecule bindings
├── schemas/market_item.mol       # Molecule schema
├── tests/                        # ckb-testtool integration tests
├── scripts/                      # Deployment scripts
├── build/                        # Compiled binary
└── docs/benchmarks/              # Cycle cost reports
```

## Design

See [design doc](docs/design/ckb-cell-marketplace-design.md) for full architecture including SDL lock integration, content detection, and frontend views.

## License

MIT
