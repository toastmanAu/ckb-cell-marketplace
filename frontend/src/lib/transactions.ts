import { ccc } from '@ckb-ccc/connector-react';
import { MARKET_ITEM_TYPE, LSDL, MIN_CELL_CAPACITY } from '../config';
import { encodeMarketItem, encodeLsdlArgs, decodeLsdlArgs } from './codec';

// Conservative WitnessArgs placeholder. Pre-populating witness[0] before
// completeFeeBy guards against signer subclasses whose prepareTransaction is
// the base-class no-op (e.g. default CCC Signer). The placeholder's lock byte
// length must be >= the signer's real signature length, otherwise estimateFee
// measures a smaller tx than what's actually submitted and the pool rejects.
//
// 2000 bytes covers current JoyID WebAuthn signatures (observed ~1500-1600
// bytes after platform-authenticator attestation growth) with headroom. Real
// signatures replace the placeholder at sign time — we just slightly overpay.
// Observed in cellSwapError1.png (2026-04-14): 1000-byte placeholder under-
// counted by 560 bytes → PoolRejectedTransactionByMinFeeRate.
function padWitnessForFeeEstimate(tx: ccc.Transaction): void {
  const placeholder = ccc.WitnessArgs.from({
    lock: '0x' + '00'.repeat(2000),
  });
  if (tx.witnesses.length === 0) {
    tx.witnesses.push(ccc.hexFrom(placeholder.toBytes()));
  } else {
    tx.witnesses[0] = ccc.hexFrom(placeholder.toBytes());
  }
}

/** Cell deps needed for market-item-type */
function marketItemCellDep(): ccc.CellDepLike {
  return {
    outPoint: { txHash: MARKET_ITEM_TYPE.TX_HASH, index: MARKET_ITEM_TYPE.INDEX },
    depType: 'code',
  };
}

/** Cell deps needed for LSDL */
function lsdlCellDep(): ccc.CellDepLike {
  return {
    outPoint: { txHash: LSDL.TX_HASH, index: LSDL.INDEX },
    depType: 'code',
  };
}

// ── Mint ────────────────────────────────────────────

export async function buildMintTx(
  signer: ccc.Signer,
  contentType: string,
  description: string,
  content: Uint8Array,
): Promise<ccc.Transaction> {
  const userLock = (await signer.getRecommendedAddressObj()).script;
  const data = encodeMarketItem(contentType, description, content);
  const dataHex = ccc.hexFrom(data);

  const tx = ccc.Transaction.from({
    outputs: [{
      lock: userLock,
      type: {
        codeHash: MARKET_ITEM_TYPE.TYPE_ID,
        hashType: 'type',
        args: '0x',
      },
    }],
    outputsData: [dataHex],
    cellDeps: [marketItemCellDep()],
  });

  await tx.completeInputsByCapacity(signer);
  padWitnessForFeeEstimate(tx);
  await tx.completeFeeBy(signer, 1500);
  return tx;
}

// ── Immutable Mint ─────────────────────────────────
// Uses an always-fail lock (all-zero code_hash, data1 hash type).
// The cell can NEVER be unlocked, transferred, sold, or destroyed.
// The CKB capacity is permanently locked.

const DEAD_LOCK: ccc.ScriptLike = {
  codeHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
  hashType: 'data1',
  args: '0x',
};

export async function buildImmutableMintTx(
  signer: ccc.Signer,
  contentType: string,
  description: string,
  content: Uint8Array,
): Promise<ccc.Transaction> {
  const data = encodeMarketItem(contentType, description, content);
  const dataHex = ccc.hexFrom(data);

  const tx = ccc.Transaction.from({
    outputs: [{
      lock: DEAD_LOCK,
      type: {
        codeHash: MARKET_ITEM_TYPE.TYPE_ID,
        hashType: 'type',
        args: '0x',
      },
    }],
    outputsData: [dataHex],
    cellDeps: [marketItemCellDep()],
  });

  await tx.completeInputsByCapacity(signer);
  padWitnessForFeeEstimate(tx);
  await tx.completeFeeBy(signer, 1500);
  return tx;
}

// ── List (transfer to LSDL lock) ────────────────────

export async function buildListTx(
  signer: ccc.Signer,
  itemOutPoint: ccc.OutPointLike,
  itemData: string,        // hex-encoded cell data (unchanged)
  _itemCapacity: bigint,   // unused — CCC calculates minimum occupied capacity
  price: bigint,           // total_value in shannons
  royaltyBps: number,      // 0-10000
  expiryEpoch: bigint,     // 0 = permanent
): Promise<ccc.Transaction> {
  const userLock = (await signer.getRecommendedAddressObj()).script;

  // Creator lock hash = first 20 bytes of the user's lock args (blake160)
  const lockArgsBytes = ccc.bytesFrom(userLock.args);
  const creatorLockHash = lockArgsBytes.slice(0, 20);

  const lsdlArgs = encodeLsdlArgs({
    ownerLock: userLock,
    totalValue: price,
    creatorLockHash: new Uint8Array(creatorLockHash),
    royaltyBps,
    expiryEpoch,
  });

  // Don't fix capacity — LSDL args are larger than the original lock args,
  // so the occupied capacity increases. Let CCC calculate the minimum.
  const tx = ccc.Transaction.from({
    inputs: [{ previousOutput: itemOutPoint }],
    outputs: [{
      lock: {
        codeHash: LSDL.DATA_HASH,
        hashType: 'data1',
        args: ccc.hexFrom(lsdlArgs),
      },
      type: {
        codeHash: MARKET_ITEM_TYPE.TYPE_ID,
        hashType: 'type',
        args: '0x',
      },
    }],
    outputsData: [itemData],
    cellDeps: [marketItemCellDep(), lsdlCellDep()],
  });

  await tx.completeInputsByCapacity(signer);
  padWitnessForFeeEstimate(tx);
  await tx.completeFeeBy(signer, 1500);
  return tx;
}

// ── Buy (satisfy LSDL) ─────────────────────────────
// CRITICAL: Output ordering is enforced by the LSDL contract.
// If the LSDL cell is at input index N:
//   outputs[N] = seller payment (lock = owner_lock from LSDL args)
//   outputs[N+1] = creator royalty (secp256k1 lock with creator_lock_hash)
//   outputs[any] = MarketItem cell transferred to buyer
// We place the LSDL cell as input[0], so seller=output[0], creator=output[1].

export async function buildBuyTx(
  signer: ccc.Signer,
  listingCell: ccc.Cell,
): Promise<ccc.Transaction> {
  const buyerLock = (await signer.getRecommendedAddressObj()).script;
  const lsdlArgs = decodeLsdlArgs(ccc.hexFrom(listingCell.cellOutput.lock.args));
  if (lsdlArgs.isLegacy) {
    throw new Error('This listing uses an outdated encoding and is permanently locked by the contract. It cannot be bought.');
  }
  const { ownerLock, totalValue, creatorLockHash, royaltyBps } = lsdlArgs;

  // Calculate royalty split
  const royaltyAmount = totalValue * BigInt(royaltyBps) / 10000n;
  const sellerAmount = totalValue - royaltyAmount;

  const tx = ccc.Transaction.from({
    inputs: [{ previousOutput: listingCell.outPoint }],
    outputs: [],
    outputsData: [],
    cellDeps: [marketItemCellDep(), lsdlCellDep()],
  });

  // Output[0]: seller payment (at same index as LSDL input)
  tx.addOutput({
    lock: ownerLock,
    capacity: listingCell.cellOutput.capacity + sellerAmount,
  }, '0x');

  // Output[1]: creator royalty (at LSDL input index + 1)
  // Cell capacity must cover the royalty amount AND the minimum cell size.
  // Before fix: no capacity was set, so auto-sized to MIN_CELL_CAPACITY and the
  // royaltyAmount delta above the minimum was silently dropped — the buyer paid
  // the listing price minus that delta, and the creator received only the min
  // cell (observed for Electric Digital Forrest: expected 75 CKB royalty, got
  // 61 CKB cell — 14 CKB of royalty was unallocated).
  if (royaltyAmount > 0n) {
    const royaltyCapacity = royaltyAmount > MIN_CELL_CAPACITY ? royaltyAmount : MIN_CELL_CAPACITY;
    tx.addOutput({
      lock: {
        codeHash: '0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8',
        hashType: 'type',
        args: ccc.hexFrom(creatorLockHash),
      },
      capacity: royaltyCapacity,
    }, '0x');
  }

  // Output[2+]: MarketItem cell transferred to buyer
  tx.addOutput({
    lock: buyerLock,
    type: listingCell.cellOutput.type ?? undefined,
  }, listingCell.outputData);

  await tx.completeInputsByCapacity(signer);
  padWitnessForFeeEstimate(tx);
  await tx.completeFeeBy(signer, 1500);
  return tx;
}

// ── Cancel (owner reclaims) ─────────────────────────

export async function buildCancelTx(
  signer: ccc.Signer,
  listingCell: ccc.Cell,
): Promise<ccc.Transaction> {
  const decoded = decodeLsdlArgs(ccc.hexFrom(listingCell.cellOutput.lock.args));
  if (decoded.isLegacy) {
    throw new Error('This listing uses an outdated encoding and is permanently locked by the contract. It cannot be cancelled.');
  }
  const ownerLock = decoded.ownerLock;

  const tx = ccc.Transaction.from({
    inputs: [{ previousOutput: listingCell.outPoint }],
    outputs: [{
      lock: ownerLock,
      type: listingCell.cellOutput.type ?? undefined,
      capacity: listingCell.cellOutput.capacity,
    }],
    outputsData: [listingCell.outputData],
    cellDeps: [marketItemCellDep(), lsdlCellDep()],
  });

  await tx.completeInputsByCapacity(signer);
  padWitnessForFeeEstimate(tx);
  await tx.completeFeeBy(signer, 1500);
  return tx;
}
