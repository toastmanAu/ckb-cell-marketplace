import { ccc } from '@ckb-ccc/connector-react';

// Pre-sign transaction summary. Computed from the constructed tx plus the
// connected wallet's lock so we can classify where capacity is going. Used
// by the in-app confirmation modal — the dapp owns the truth about its own
// transaction, rather than trusting the wallet's preview (which has been
// observed to stale-cache and error-blank between back-to-back signs).

const DEAD_LOCK_CODE_HASH = '0x0000000000000000000000000000000000000000000000000000000000000000';

export interface TxSummary {
  inputCount: number;
  outputCount: number;
  inputsTotal: bigint;
  outputsTotal: bigint;
  fee: bigint;
  // Output capacity classified by destination:
  //   toUser: returns to the signer's lock (change)
  //   toDeadLock: permanently locked (immutable mints)
  //   toOthers: payments to third parties (seller, creator royalty, etc.)
  toUser: bigint;
  toDeadLock: bigint;
  toOthers: bigint;
  // Net CKB leaving the user = inputsTotal - toUser. Includes fee.
  netOut: bigint;
}

export async function summarizeTx(
  tx: ccc.Transaction,
  client: ccc.Client,
  userLock: ccc.Script,
): Promise<TxSummary> {
  const inputsTotal = await tx.getInputsCapacity(client);
  const outputsTotal = tx.outputs.reduce((sum, o) => sum + o.capacity, 0n);
  const fee = inputsTotal - outputsTotal;

  const userLockHash = userLock.hash();
  let toUser = 0n;
  let toDeadLock = 0n;
  let toOthers = 0n;

  for (const out of tx.outputs) {
    const codeHash = ccc.hexFrom(out.lock.codeHash);
    if (codeHash.toLowerCase() === DEAD_LOCK_CODE_HASH) {
      toDeadLock += out.capacity;
    } else if (out.lock.hash() === userLockHash) {
      toUser += out.capacity;
    } else {
      toOthers += out.capacity;
    }
  }

  return {
    inputCount: tx.inputs.length,
    outputCount: tx.outputs.length,
    inputsTotal,
    outputsTotal,
    fee,
    toUser,
    toDeadLock,
    toOthers,
    netOut: inputsTotal - toUser,
  };
}
