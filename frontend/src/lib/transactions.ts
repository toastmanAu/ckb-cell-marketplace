import { ccc } from '@ckb-ccc/connector-react';
import { MARKET_ITEM_TYPE, LSDL } from '../config';
import { encodeMarketItem, encodeLsdlArgs, decodeLsdlArgs } from './codec';

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
  await tx.completeFeeBy(signer, 1000);
  return tx;
}

// ── List (transfer to LSDL lock) ────────────────────

export async function buildListTx(
  signer: ccc.Signer,
  itemOutPoint: ccc.OutPointLike,
  itemData: string,        // hex-encoded cell data (unchanged)
  itemCapacity: bigint,
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
      capacity: itemCapacity,
    }],
    outputsData: [itemData],
    cellDeps: [marketItemCellDep(), lsdlCellDep()],
  });

  await tx.completeInputsByCapacity(signer);
  await tx.completeFeeBy(signer, 1000);
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
  if (royaltyAmount > 0n) {
    tx.addOutput({
      lock: {
        codeHash: '0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8',
        hashType: 'type',
        args: ccc.hexFrom(creatorLockHash),
      },
    }, '0x');
  }

  // Output[2+]: MarketItem cell transferred to buyer
  tx.addOutput({
    lock: buyerLock,
    type: listingCell.cellOutput.type ?? undefined,
  }, listingCell.outputData);

  await tx.completeInputsByCapacity(signer);
  await tx.completeFeeBy(signer, 1000);
  return tx;
}

// ── Cancel (owner reclaims) ─────────────────────────

export async function buildCancelTx(
  signer: ccc.Signer,
  listingCell: ccc.Cell,
): Promise<ccc.Transaction> {
  const ownerLock = decodeLsdlArgs(ccc.hexFrom(listingCell.cellOutput.lock.args)).ownerLock;

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
  await tx.completeFeeBy(signer, 1000);
  return tx;
}
