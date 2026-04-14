import {
  CKBFSData,
  createChunkedCKBFSV3Witnesses,
  calculateChecksum,
  ProtocolVersion,
} from '@ckbfs/api';
import { ccc } from '@ckb-ccc/connector-react';

// CKBFS V3 testnet constants (from @ckbfs/api/dist/utils/constants)
const CKBFS_V3_CODE_HASH = '0xb5d13ffe0547c78021c01fe24dce2e959a1ed8edbca3cb93dd2e9f57fb56d695';
const CKBFS_V3_DEP_GROUP_TX = '0x47cfa8d554cccffe7796f93b58437269de1f98f029d0a52b6b146381f3e95e61';

/** Chunk content into ~500KB pieces for CKBFS V3 witness storage */
function chunkContent(data: Uint8Array, chunkSize = 500_000): Uint8Array[] {
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < data.length; i += chunkSize) {
    chunks.push(data.subarray(i, i + chunkSize));
  }
  return chunks;
}

export interface CkbfsPublishResult {
  txHash: string;
  typeId: string;
  uri: string;
}

/**
 * Publish content to CKBFS V3.
 *
 * Order matters: CKBFS witnesses are appended AFTER completeInputsByCapacity,
 * because CCC's addInput splices an empty witness at inputs.length whenever
 * witnesses.length > inputs.length — which would shift any pre-populated head
 * witness out of the slot pointed to by cell data's `index` field (causing the
 * script to parse signing-placeholder bytes as prev_tx_hash → error 112).
 */
export async function publishToCkbfs(
  signer: ccc.Signer,
  content: Uint8Array,
  contentType: string,
  filename: string,
): Promise<CkbfsPublishResult> {
  const addressObj = await signer.getRecommendedAddressObj();
  const lock = addressObj.script;
  const chunks = chunkContent(content);

  const combined = new Uint8Array(content.length);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }
  const checksum = await calculateChecksum(combined);

  // Phase 1: pre-pack cell data with placeholder index to get correct capacity.
  // The u32 encoding is always 4 bytes so the final re-pack won't change size.
  const provisionalData = CKBFSData.pack({
    index: 1,
    checksum,
    contentType,
    filename,
  }, ProtocolVersion.V3);

  const tx = ccc.Transaction.from({
    outputs: [{
      lock,
      type: {
        codeHash: CKBFS_V3_CODE_HASH,
        hashType: 'data1',
        args: '0x' + '00'.repeat(32), // placeholder TypeID — replaced once inputs are known
      },
    }],
    outputsData: [ccc.hexFrom(provisionalData)],
    cellDeps: [{
      outPoint: { txHash: CKBFS_V3_DEP_GROUP_TX, index: 0 },
      depType: 'depGroup',
    }],
  });

  // Phase 2: let CCC pick inputs. Without any witnesses pre-populated, addInput's
  // splice guard does not trigger, so no phantom padding witnesses get injected.
  await tx.completeInputsByCapacity(signer);

  // Phase 3: with inputs.length fixed, the CKBFS head sits at witnesses[inputs.length]
  // (first output-side witness slot). The script reads tx.witnesses[data.index]
  // directly — Source::Output for load_witness is the same index space as Source::Input
  // in ckb-vm; both return witnesses[index].
  const contentStartIndex = tx.inputs.length;

  const finalData = CKBFSData.pack({
    index: contentStartIndex,
    checksum,
    contentType,
    filename,
  }, ProtocolVersion.V3);
  tx.outputsData[0] = ccc.hexFrom(finalData);

  const ckbfsWitnesses = createChunkedCKBFSV3Witnesses(chunks, {
    previousTxHash: '0x' + '00'.repeat(32),
    previousWitnessIndex: 0,
    previousChecksum: 0,
    startIndex: contentStartIndex,
  });

  while (tx.witnesses.length < tx.inputs.length) {
    tx.witnesses.push('0x');
  }
  for (const w of ckbfsWitnesses) {
    tx.witnesses.push(ccc.hexFrom(w));
  }

  // Conservative placeholder: inject a 1000-byte lock into witness[0] directly
  // instead of relying on signer.prepareTransaction, which is a no-op on the
  // default ccc Signer base class and only overridden by some wallet subclasses
  // (JoyID → 1000 bytes, secp256k1 → 65 bytes). 1000 bytes covers JoyID's real
  // webauthn signature; cheaper wallets overpay a few shannons but never
  // under-report size → pool's min-fee check always passes.
  const placeholderWitness = ccc.WitnessArgs.from({
    lock: '0x' + '00'.repeat(1000),
  });
  tx.witnesses[0] = ccc.hexFrom(placeholderWitness.toBytes());

  const preparedTx = await signer.prepareTransaction(tx);

  const txSize = preparedTx.toBytes().length + 4;
  const requiredFee = BigInt(Math.ceil(txSize * 1200 / 1000));

  let totalInputCapacity = 0n;
  for (const input of preparedTx.inputs) {
    const cell = await signer.client.getCell(input.previousOutput);
    if (cell) totalInputCapacity += cell.cellOutput.capacity;
  }
  let totalOutputCapacity = 0n;
  for (const output of preparedTx.outputs) {
    totalOutputCapacity += output.capacity;
  }
  const currentFee = totalInputCapacity - totalOutputCapacity;

  if (currentFee > requiredFee + 6100000000n) {
    preparedTx.addOutput({ lock }, '0x');
    preparedTx.outputs[preparedTx.outputs.length - 1].capacity = currentFee - requiredFee;
  }

  const debug = [
    `w[0]pre=${tx.witnesses[0].length}`,
    `w[0]post=${preparedTx.witnesses[0].length}`,
    `size=${txSize}`,
    `feeReq=${requiredFee}`,
    `feeHave=${currentFee}`,
    `signer=${signer.constructor?.name}`,
  ].join(' ');
  (window as unknown as { __CKBFS_DEBUG__: string }).__CKBFS_DEBUG__ = debug;
  console.log('[ckbfs]', debug);

  const typeIdArgs = ccc.hashTypeId(preparedTx.inputs[0], 0);
  preparedTx.outputs[0].type = new ccc.Script(CKBFS_V3_CODE_HASH, 'data1', typeIdArgs);

  const typeId = ccc.hexFrom(typeIdArgs);
  let txHash: string;
  try {
    txHash = await signer.sendTransaction(preparedTx);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`${msg} [${debug}]`);
  }

  const uri = `ckbfs://${typeId}`;
  return { txHash, typeId, uri };
}

/** Estimate CKBFS storage cost */
export function estimateCkbfsCost(contentBytes: number): {
  indexCellCkb: number;
  feeCkb: number;
  totalCkb: number;
  note: string;
} {
  return {
    indexCellCkb: 225,
    feeCkb: 0.01,
    totalCkb: 225.01,
    note: `File (${(contentBytes / 1024).toFixed(1)} KB) stored in witnesses. Only index cell (~225 CKB) locked permanently.`,
  };
}
