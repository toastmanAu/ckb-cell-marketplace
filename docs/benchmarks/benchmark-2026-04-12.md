---
type: note
project: CKB Cell Marketplace
date: 2026-04-12
tags: [ckb, benchmark, type-script, marketplace]
---

# market-item-type Benchmark Report

**Date:** 2026-04-12
**Binary:** `build/market-item-type`
**Binary size:** 11,312 bytes (11.0 KB)
**Machine:** Intel Core i7-14700KF, Linux 6.8.0-106-generic x86_64
**CKB Debugger:** ckb-debugger 1.1.1

---

## Cycle Counts

| Operation | Scenario | Cycles | Notes |
|-----------|----------|--------|-------|
| Create | Valid MarketItem (image/png, 27-byte desc, 4-byte content) | **14,961** | Happy path |
| Transfer | Description change only (content immutable) | **18,399** | Input/output comparison |
| Burn | Cell consumed, no matching output | **7,894** | Minimal — just operation detection |

### Error Paths (exit before full validation)

| Operation | Scenario | Error Code | Notes |
|-----------|----------|------------|-------|
| Create | Empty content_type | 21 (EmptyContentType) | Fails at first field check |
| Create | Empty description | 22 (EmptyDescription) | Fails at second field check |
| Create | Empty content | 23 (EmptyContent) | Fails at third field check |
| Create | Invalid MIME (no slash) | 26 (InvalidMimeFormat) | Fails at MIME validation |
| Transfer | Content bytes changed | 25 (ContentChanged) | Fails at immutability check |
| Transfer | Content-type changed | 24 (ContentTypeChanged) | Fails at immutability check |

Error paths exit early and consume fewer cycles than success paths.

---

## Comparison

| Contract | Binary Size | Create Cycles | Transfer Cycles |
|----------|-------------|---------------|-----------------|
| **market-item-type** | **11 KB** | **14,961** | **18,399** |
| Spore type script | ~100+ KB | ~500,000+ | ~400,000+ |
| mldsa-lock-v2-rust | 49 KB | — | — |
| falcon-lock-v2 | 49 KB | — | — |

The market-item-type script is ~30x cheaper in cycles than Spore because it does pure data validation with no cryptographic operations, no cluster logic, and no mutant support.

---

## Analysis

- **11 KB binary** — well within the CKB cell size sweet spot. Deployment cost is minimal (~11,400 CKB for the code cell).
- **15K–18K cycles** — negligible compared to the max cycle limit per transaction (70M on testnet). Even a transaction with 100 MarketItem cells would use < 2M cycles.
- **Burn is cheapest** (8K) because it short-circuits after operation detection — no data parsing needed.
- **Transfer is most expensive** (18K) because it parses both input and output MarketItem data and compares fields byte-by-byte.
- No allocations in the hot path — molecule parsing is zero-copy from cell data.

## Recommendations

- No optimisation needed at current cycle counts
- For Phase 2 (Type ID validation), expect ~2-3K additional cycles for the hash check
- For Phase 3 (royalty logic), cycle cost will depend on the additional output verification
