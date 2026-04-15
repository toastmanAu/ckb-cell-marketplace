# JoyID: `parse-ckb-raw-tx` queryFn throws null-deref on recent-chain-state inputs

**Severity:** more than cosmetic — when this fires, the signing popup renders empty transfer info. Users cannot verify what they are signing.

**Component:** JoyID hosted wallet (`testnet.joyid.dev`, bundle `index-BPEnQt_Y.js`)

**Discovered by:** CellSwap (https://cellswap.xyz) — CKB cell marketplace. Hits this on every rapid mint/buy cycle.

---

## Symptom

Signing popup shows error toast: `Cannot read properties of null (reading 'output')`.

Intermittent — same dapp, same wallet, same cell type sometimes signs fine (transfer amount visible) and sometimes errors out (transfer info blanked). Blank transfer info is the real concern: users are asked to confirm a transaction whose contents the wallet has failed to render.

## Stack

```
TypeError: Cannot read properties of null (reading 'output')
  at Object.queryFn (https://testnet.joyid.dev/assets/index-BPEnQt_Y.js:2:6400)
```

## Root cause

The `parse-ckb-raw-tx` TanStack Query fetches live-cell data for every input in the tx and iterates without null-checking. Decompiled from your bundle at offset ~6400:

```js
queryFn: async () => {
  const i = ne.getCkb();
  const L = await Promise.all(l.inputs.map(p => ne.getLiveCell(p.previousOutput)));
  const j = [];
  let w = BigInt(0), H = 0;
  // ...
  for (const [p, c] of L.entries()) {
    const x = re(c.output.lock);        // <-- throws when c is null
    w += BigInt(c.output.capacity);     // <-- never reached
    ...
  }
}
```

`getLiveCell` returns `null` when the CKB indexer hasn't yet indexed the referenced cell. This happens predictably in one case: a previous tx's **change output** used as an input to the next tx. The cell is on chain but not yet in the indexer JoyID's RPC is querying.

## Why the non-determinism

- First mint in a session: all inputs are mature cells. `getLiveCell` resolves. No error.
- Second mint immediately after: one input is the change cell from the first mint. JoyID's RPC hasn't indexed it yet. `getLiveCell` → `null` → throw.
- Third mint after a pause: indexer has caught up. Works again.

The dapp's CCC client and JoyID's wallet client may also hit different CKB RPC nodes with different indexer latencies, which amplifies the window.

## Proposed fix

One-line null check inside the loop:

```js
for (const [p, c] of L.entries()) {
  if (!c || !c.output) continue;   // or: show "loading..." / "unresolved" placeholder
  const x = re(c.output.lock);
  w += BigInt(c.output.capacity);
  ...
}
```

Or more robustly, retry-with-backoff around `getLiveCell` before giving up — since the cell *is* on chain, just not yet indexed.

Ideal: show the user a clear "transfer preview unavailable — tx contents cannot be parsed, do you still want to sign?" state, instead of a silent blank with an error toast. A silent blank on a wallet's tx-confirm screen is the worst failure mode — users may sign transactions they can't verify.

## Reproduction

1. Open https://cellswap.xyz on testnet with a JoyID wallet that has only a few change cells.
2. Mint two items back-to-back (image or markdown, any content type with a custom `type_id`).
3. On the second mint, the popup will (intermittently) show the error and blank the transfer info. Confirmed txs with the error toast visible:
   - `0x8df51f993ae7e0e66c562ba01e0d9f5cec24c0fcd78a27bfcb93990893526ea3`
   - `0x24bcbe848006db699d805227e7d1f8c5bd03f1e9c3c24bcf53091b57c11f2065`

Same effect reproducible on any dapp whose mint/send flow consumes recent change outputs — not specific to CellSwap or custom type_ids.

## Impact

Any dapp on CKB whose transactions use inputs that include recent change cells. This includes essentially every dapp with rapid signing flows: marketplaces, games, payment splits, batch ops. The bug surface grows with wallet adoption.

One-line fix from JoyID's side resolves it for everyone. Happy to test a patched build on CellSwap if useful.
