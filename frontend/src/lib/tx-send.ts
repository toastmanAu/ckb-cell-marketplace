import { ccc } from '@ckb-ccc/connector-react';
import { createClient } from './indexer';

// JoyID's transaction preview in testnet.joyid.dev fetches every input's
// previous-output cell via getLiveCell() and does not null-check the result
// before reading `.output.lock`. When any input is on chain but not yet
// indexed on JoyID's RPC node (a real window for fresh change outputs from
// recent txs), the preview throws and the signing popup blanks the transfer
// info. See docs/joyid-parse-ckb-raw-tx-null-deref.md for the full analysis.
//
// This wrapper gates send behind a liveness check against our own RPC: we
// poll each input until all are live-resolvable, then hand to the signer.
// Our RPC and JoyID's RPC are separate endpoints, so this is a heuristic,
// not a guarantee — but in practice public testnet nodes converge within
// 1-2s of each other, so waiting until ours sees the cells raises the
// probability that JoyID's will too by the time the user taps confirm.

const MAX_ATTEMPTS = 18;
const BACKOFF_MS = [
  0, 1500, 2500, 3500, 4500, 5500, 6500, 7500, 8500, 9500,
  10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000,
];
// Total worst-case wait: ~120s across 18 attempts. CKB testnet block time is
// ~10s and a chunked CKBFS publish may cross multiple blocks before its change
// output is indexer-visible. Ramp up fast then poll at 10s once we're past the
// early-index window. Small-tx cases still succeed on attempt 1 with zero delay.

export async function safeSendTransaction(
  signer: ccc.Signer,
  tx: ccc.Transaction,
  onStatus: (message: string) => void = () => {},
): Promise<string> {
  const client = createClient();

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (BACKOFF_MS[attempt] > 0) {
      await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt]));
    }

    const resolutions = await Promise.all(
      tx.inputs.map((inp) =>
        client.getCellLive(inp.previousOutput, false).catch(() => null),
      ),
    );
    const unresolved = resolutions.filter((c) => !c).length;

    if (unresolved === 0) break;

    if (attempt === MAX_ATTEMPTS - 1) {
      throw new Error(
        `${unresolved} of ${resolutions.length} input cells are not yet visible to the indexer. ` +
          `This usually means a recent transaction's change output hasn't propagated. ` +
          `Wait 30-60 seconds and try again.`,
      );
    }

    const elapsed = BACKOFF_MS.slice(0, attempt + 1).reduce((s, n) => s + n, 0) / 1000;
    onStatus(
      `Waiting for previous transaction to finalize on-chain ` +
        `(${unresolved} input cell${unresolved === 1 ? '' : 's'} still propagating, ${elapsed.toFixed(0)}s elapsed)…`,
    );
  }

  return signer.sendTransaction(tx);
}
