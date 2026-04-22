# CKBFS V3 Multi-Transaction Publish — Implementation TODO

Tracks the proper fix for GitHub issue #1 ("Decode Error") — currently `frontend/src/lib/ckbfs.ts` only supports single-tx publish, capped at `MAX_SINGLE_TX_CKBFS_BYTES` (500 KB). Files larger than that fail with a JoyID "Decode Error / Invalid sign ckb raw tx request" because the tx exceeds both JoyID's postMessage payload size and CKB's per-tx block limit (~597 KB).

The `@ckbfs/api` package already exports the primitives we need; the work is driver logic + UX.

---

## Goal

Publish arbitrary-size files to CKBFS V3 by chaining one `publish` tx with N `append` txs. User signs N+1 transactions; result is a single on-chain CKBFS cell with the final checksum covering the full file.

## Non-goals

- **Changing the single-tx happy path.** Files ≤ `MAX_SINGLE_TX_CKBFS_BYTES` keep taking the existing one-sign fast path.
- **Resumable uploads across sessions.** Failure in the middle of a chain leaves a partial cell; recovery is a stretch goal (see Risks).
- **Concurrent chunk submission.** CKBFS V3 appends are strictly linear (each tx references the previous tx's hash/index/checksum), so parallelism is impossible.
- **Multi-tx support for non-JoyID wallets.** Scope to the wallets used in production first; other connectors may need prepareTransaction-specific fee math.

---

## Protocol recap

CKBFS V3 head witness carries 40 bytes of back-pointers (`ckb-transactions.md §8`):

```
bytes 0-4:   "CKBFS" magic
byte 5:      version 0x03
bytes 6-37:  previous TX hash     (32 bytes, zeros on initial publish)
bytes 38-41: previous witness idx (u32 LE, 0 on initial publish)
bytes 42-45: previous checksum    (u32 LE, 0 on initial publish)
bytes 46-49: next index           (u32 LE, 0 if this witness is the tail of its tx)
bytes 50+:   content bytes
```

Each `append` tx consumes the existing CKBFS cell as input, produces a new CKBFS cell with the **same TypeID** but updated data (new rolling checksum, new `index` = first output-side witness slot in the append tx), and chains back to the previous tx via the head witness's `previous*` fields.

The Adler32 checksum is rolling — each append continues the checksum from where the previous tx left off. `@ckbfs/api` exposes the helper.

---

## Per-tx content budget

| Component                                    | Bytes (approx) |
|----------------------------------------------|---------------:|
| CKB block size ceiling                       |        597 000 |
| Tx molecule overhead (header, cell_deps)     |         ~1 000 |
| 1 × input (type+data CKBFS cell)             |           ~150 |
| 1 × fee input                                |           ~150 |
| CKBFS output cell (lock + type + data)       |           ~350 |
| Change output                                |            ~80 |
| witness[0] JoyID placeholder (§1 padding)    |         ~1 020 |
| Head witness CKBFS metadata (50 bytes)       |             50 |
| Variance / safety margin                     |         ~5 000 |
| **Effective content budget per tx**          |     **~590 KB** |

Use `CHUNK_BYTES_PER_TX = 480_000` to stay well under the ceiling with room for lock/type variance across wallets. Content is sliced to this size; multiple chunks per tx are NOT needed because a single witness can hold the whole chunk within the budget.

---

## Design

### State machine

```
idle
  → chunking           (slice content into N chunks of ≤ CHUNK_BYTES_PER_TX)
  → publish            (tx 1: publishCKBFSV3 with chunk 0)
  → awaiting_confirm_0 (poll chain for tx 1 confirmation)
  → append_i           (tx i+1: appendCKBFSV3 with chunk i, for i in 1..N-1)
  → awaiting_confirm_i
  → done
  → failed             (surface partial state + recovery options)
```

### New API shape

Replace `publishToCkbfs` with a driver that returns progress events:

```ts
export interface CkbfsPublishProgress {
  phase: 'chunking' | 'publishing' | 'confirming' | 'appending' | 'done';
  chunkIndex: number;          // 0-indexed current chunk
  totalChunks: number;
  currentTxHash?: string;      // last tx hash (for UI linking to explorer)
  typeId?: string;             // stable across the whole chain; set after publish
}

export interface CkbfsPublishOptions {
  signer: ccc.Signer;
  content: Uint8Array;
  contentType: string;
  filename: string;
  onProgress?: (p: CkbfsPublishProgress) => void;
  signal?: AbortSignal;
}

export async function publishToCkbfs(opts: CkbfsPublishOptions): Promise<CkbfsPublishResult>;
```

Single-chunk case (content ≤ `CHUNK_BYTES_PER_TX`) fast-paths through the existing single-tx code, emitting one `publishing` → `done` progress pair.

### Confirmation strategy

Between each tx the driver must wait until the CKBFS cell's new outPoint is queryable by the indexer (otherwise `appendCKBFSV3` can't load it). Options:

1. **Poll `getCell(outPoint)`** every ~2s with a 120s timeout (matches `safeSendTransaction` pattern in `lib/tx-send.ts`).
2. **Poll `getTransaction(txHash).txStatus`** and wait for `committed` — stricter, slower.

Preferred: cell-presence polling. Matches existing conventions and unblocks as soon as the indexer has the cell.

### UX considerations (CRITICAL)

- **Up-front disclosure.** Before the first sign, show "This file will take N signatures over ~M minutes. Keep this tab open." Users mentally pre-commit to the batch.
- **Per-chunk progress.** Persistent banner: "Signing chunk 4 of 107 — approve in wallet." Chunk count + ETA (assume ~15s per tx at typical confirmation).
- **Wallet popup re-focus.** JoyID popup is separate window; between chunks, the parent tab must programmatically trigger the popup without requiring a user click (may hit browser popup blockers — verify behavior; may need a "Continue" button between chunks as fallback).
- **Cancel button.** `AbortSignal` wired through the driver — stops new txs from being built, lets in-flight tx complete.
- **Partial success surface.** On failure at chunk K, show "Published first K chunks — your cell exists but is incomplete. [Resume] / [Accept as-is] / [Abandon]."
- **No blind retries.** A failed append must be diagnosed — retrying with stale `previousTxHash` produces error 112 (InvalidPreviousPosition).
- **Cost preview.** "This will cost approximately X CKB in fees across N transactions" before starting, in addition to the 225 CKB index cell.

### Content size guard

Keep `MAX_SINGLE_TX_CKBFS_BYTES` as the single-tx cap. Add a separate `MAX_TOTAL_CKBFS_BYTES` (suggest 100 MB initially) as an absolute ceiling to prevent accidental 2GB uploads that would mean ~4200 sign prompts. Show a warning over 10 MB ("This will require N signatures — proceed?").

---

## Task list

### Phase 1 — driver core

- [ ] Read `@ckbfs/api` source for `appendCKBFSV3` signature and `ckbfsCell` option shape; confirm checksum chaining semantics (does it recompute or accept prior checksum?). Files: `frontend/node_modules/@ckbfs/api/dist/utils/transactions/v3.js`.
- [ ] Write Adler32 rolling-checksum helper or verify `@ckbfs/api` exposes one that accepts a prior state.
- [ ] Add `CHUNK_BYTES_PER_TX = 480_000`, `MAX_TOTAL_CKBFS_BYTES = 100 * 1024 * 1024` to `lib/ckbfs.ts`.
- [ ] Extract existing single-tx body into `publishInitialChunk(signer, chunk, contentType, filename)` returning `{ txHash, typeId, ckbfsCellOutPoint, checksum }`.
- [ ] Write `appendChunk(signer, chunk, priorCell, priorTxHash, priorWitnessIndex, priorChecksum)` using `appendCKBFSV3` or hand-rolled (if bundled CCC in `@ckbfs/api` causes issues per `ckb-transactions.md §9`, hand-roll against our fresh CCC).
- [ ] Write `waitForCellConfirmed(client, outPoint, timeoutMs = 120_000)` — polls `getCell`, throws on timeout. Reuse pattern from `lib/tx-send.ts`.
- [ ] Write `publishToCkbfs` driver that slices content, routes to fast path if 1 chunk, otherwise iterates publish → confirm → append → confirm → ... Emits `onProgress` at each transition.

### Phase 2 — UI integration

- [ ] Replace call site in `Mint.tsx:163-168` with new API, passing `onProgress`.
- [ ] Render per-chunk status in existing `TxStatus` component or add a `ChunkedPublishStatus` variant showing "Chunk K of N" + tx hash links.
- [ ] Remove / relax the `ckbfsTooLarge` guard in `Mint.tsx` once driver is proven; keep the absolute cap at `MAX_TOTAL_CKBFS_BYTES`.
- [ ] Add up-front confirmation modal for multi-chunk publishes: "This will require N signatures."
- [ ] Wire `AbortSignal` to a cancel button in the status UI.
- [ ] Update `estimateCkbfsCost` to factor in N × per-tx fee for multi-chunk uploads.

### Phase 3 — error recovery

- [ ] Persist in-progress state (typeId + last confirmed chunk index + last txHash) to `sessionStorage` under a `ckbfs:in-progress:${typeId}` key so a tab refresh preserves enough to resume.
- [ ] Add resume path: detect in-progress state on mount, offer "Resume publishing <filename>" action.
- [ ] Handle the "tx submitted but not confirmed after 120s" case — tx may still confirm later; don't blindly re-submit (would produce double-spend error on the CKBFS input).
- [ ] Add detection + error-path handling for error 112 (`InvalidPreviousPosition`) — indicates back-pointer mismatch; user must restart from last confirmed chunk.

### Phase 4 — testing

- [ ] Unit: chunking logic (sizes at boundary: exactly `CHUNK_BYTES_PER_TX`, one byte over, one byte under, multiples).
- [ ] Unit: progress-event ordering (fast path: 1 publishing + 1 done; multi-chunk: N+1 events in correct order).
- [ ] Integration (testnet): small file ≤ `MAX_SINGLE_TX_CKBFS_BYTES` → single-tx fast path unchanged, no regression.
- [ ] Integration (testnet): 2 MB file → 5 txs, verify each tx's `previousTxHash/Index/Checksum` matches prior tx on-chain.
- [ ] Integration (testnet): 10 MB file → ~22 txs, verify final cell reads back correctly via existing `ckbfs-resolver.ts`.
- [ ] Integration (testnet): the 52.9 MB file from issue #1 → full chain publishes and reads back correctly.
- [ ] Integration: simulate failure at chunk 3 of 5 — verify partial state is recoverable and resume works.
- [ ] Integration: cancel via AbortSignal mid-chain — verify no orphan txs submitted after cancel.

### Phase 5 — docs / rule updates

- [ ] Update `ckb-transactions.md` with a new section on multi-tx CKBFS append (back-pointer chain, checksum rolling, confirmation polling between txs).
- [ ] Add a section to README covering multi-tx publish UX for users.
- [ ] Log to `ckb-transactions.feedback.md` when shipped.

---

## Risks

1. **JoyID popup blocker between chunks.** If the second popup requires a fresh user gesture, the flow stalls. Mitigation: explicit "Sign next chunk" button between each tx. Verify on Firefox + Chrome + iOS Safari before assuming auto-popup works.
2. **Indexer lag >120s.** If testnet indexer is slow, confirmation timeout fires before the cell is queryable. Mitigation: configurable timeout, fall back to raw node RPC `get_transaction`.
3. **Partial-chain garbage.** A failed chain leaves a valid CKBFS cell with incomplete content. The cell takes real CKB (~225 per cell) and is unspendable if it's a Permanent mint. Mitigation: default to Normal ownership for multi-chunk publishes until recovery is solid; warn loudly for Permanent.
4. **Fee estimation drift across the chain.** Each append tx has different size; fee math in `ckb-transactions.md §1` must apply per-tx, not once up-front. Mitigation: re-pad witness[0] + recompute fee for every tx in the chain.
5. **Checksum state drift.** If a rolling Adler32 implementation diverges from the contract's, each append reports the wrong previous checksum and fails validation. Mitigation: reference-test against a known-good file published via CKBFS CLI; compare per-chunk checksums.
6. **`@ckbfs/api`'s bundled stale CCC** (`ckb-transactions.md §9`) may break if we use its helpers directly with our fresh CCC Transaction objects — `appendCKBFSV3` signs internally and may not surface the prepared tx for our existing confirm-modal flow. Likely need to hand-roll using only `createChunkedCKBFSV3Witnesses` + `CKBFSData.pack` primitives, same as current `publishToCkbfs`.

---

## Open questions

- Should multi-chunk publishes be gated behind a feature flag until Phase 3 (recovery) is done?
- Do we charge the user a single consolidated price-quote, or show per-chunk cost?
- What does the chunk count cap look like in practice — is 100 MB / 480 KB = ~215 signatures actually acceptable UX, or should the real cap be 10 MB?
- Is there appetite for a "submit to CellSwap backend, we publish on your behalf" custody path for large uploads? (Off-table scope increase, but worth noting.)

---

## Reference

- Single-tx implementation: `frontend/src/lib/ckbfs.ts`
- Call site: `frontend/src/components/Mint.tsx` (`handleMint`, storage mode selector)
- CKBFS V3 package: `node_modules/@ckbfs/api/dist/utils/transactions/v3.js`
- Constraints: `~/.claude/rules/ckb-transactions.md` §§1-8
- Upstream protocol: `github.com/code-monad/ckbfs`
