import { publishCKBFSV3, ProtocolVersion, NetworkType } from '@ckbfs/api';
import type { ccc } from '@ckb-ccc/connector-react';

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
 * Returns tx hash and a ckbfs:// URI to store as the MarketItem content.
 *
 * Note: publishCKBFSV3 returns a signed Transaction; we send it with signer.sendTransaction.
 *
 * @ckbfs/api uses @ckb-ccc/core@^0.1.0-alpha.7 while this frontend uses @ckb-ccc/connector-react@1.0.34.
 * The Signer classes are structurally compatible at runtime but distinct at the TypeScript level,
 * so we use an eslint-disable + any cast at the publishCKBFSV3 call boundary.
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const signedTx = await publishCKBFSV3(signer as any, {
    contentChunks: chunks,
    contentType,
    filename,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    lock: lock as any,
    network: NetworkType.Testnet,
    version: ProtocolVersion.V3,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const txHash = await signer.sendTransaction(signedTx as any);

  // Construct a ckbfs:// URI from the tx hash and first output index
  const uri = `ckbfs://${txHash}:0`;

  return { txHash, typeId: '', uri };
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
