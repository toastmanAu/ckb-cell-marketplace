import { ccc } from '@ckb-ccc/connector-react';
import { LSDL } from '../config';

// Pre-sign transaction summary. Computed from the constructed tx plus the
// connected wallet's lock so we can classify where capacity is going. Used
// by the in-app confirmation modal — the dapp owns the truth about its own
// transaction, rather than trusting the wallet's preview (which has been
// observed to stale-cache and error-blank between back-to-back signs).
//
// Classification is by (lock, hasType) to match CKB's capacity semantics:
// capacity on your own lock with a type script is yours in principle but
// locked in a typed cell (recoverable by destroying the cell); capacity
// on LSDL is in programmable escrow (recoverable via cancel, or paid out
// via buy); dead lock is permanent; any other lock is paid out.

const DEAD_LOCK_CODE_HASH = '0x0000000000000000000000000000000000000000000000000000000000000000';

export interface TxSummary {
  inputCount: number;
  outputCount: number;
  inputsTotal: bigint;
  outputsTotal: bigint;
  fee: bigint;
  // Output capacity, classified by destination:
  //   toUserChange:         user-locked, no type — spendable change
  //   toUserLockedInCells:  user-locked, has type — locked in typed cells
  //                         on your own lock (e.g. a new MarketItem you own).
  //                         Recoverable only by destroying the cell.
  //   toLsdlEscrow:         locked in the marketplace's LSDL escrow.
  //                         Recoverable via cancel, paid out on buy.
  //   toDeadLock:           permanently locked (immutable mints).
  //   toOthers:             paid to third-party locks (seller, royalty).
  toUserChange: bigint;
  toUserLockedInCells: bigint;
  toLsdlEscrow: bigint;
  toDeadLock: bigint;
  toOthers: bigint;
  // Derived aggregates for easy modal display:
  //   toUser   = toUserChange + toUserLockedInCells (all capacity on your lock)
  //   netOut   = inputsTotal - toUser (capacity leaving your lock — fee + others + escrow + dead)
  toUser: bigint;
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
  const lsdlCodeHash = LSDL.DATA_HASH.toLowerCase();

  let toUserChange = 0n;
  let toUserLockedInCells = 0n;
  let toLsdlEscrow = 0n;
  let toDeadLock = 0n;
  let toOthers = 0n;

  for (const out of tx.outputs) {
    const codeHash = ccc.hexFrom(out.lock.codeHash).toLowerCase();
    const hasType = out.type !== undefined && out.type !== null;

    if (codeHash === DEAD_LOCK_CODE_HASH) {
      toDeadLock += out.capacity;
    } else if (codeHash === lsdlCodeHash) {
      toLsdlEscrow += out.capacity;
    } else if (out.lock.hash() === userLockHash) {
      if (hasType) toUserLockedInCells += out.capacity;
      else toUserChange += out.capacity;
    } else {
      toOthers += out.capacity;
    }
  }

  const toUser = toUserChange + toUserLockedInCells;

  return {
    inputCount: tx.inputs.length,
    outputCount: tx.outputs.length,
    inputsTotal,
    outputsTotal,
    fee,
    toUserChange,
    toUserLockedInCells,
    toLsdlEscrow,
    toDeadLock,
    toOthers,
    toUser,
    netOut: inputsTotal - toUser,
  };
}
