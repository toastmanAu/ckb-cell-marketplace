/**
 * CKBFS content resolver — fetches file bytes from on-chain CKBFS cells.
 * Ported from the DOB minter's ckbfs-resolver.js (proven, handles V2 + V3).
 */

const CKBFS_CODE_HASHES = [
  '0x31e6376287d223b8c0410d562fb422f04d1d617b2947596a14c3d2efb7218d3a', // V2
  '0xb5d13ffe0547c78021c01fe24dce2e959a1ed8edbca3cb93dd2e9f57fb56d695', // V3
  '0xe8905ad29a02cf8befa9c258f4f941773839a618d75a64afc22059de9413f712', // V1 testnet
];

const RPC_ENDPOINTS: Record<string, string> = {
  testnet: 'https://testnet.ckbapp.dev',
  mainnet: 'https://mainnet.ckbapp.dev',
};

export interface CkbfsResolvedContent {
  fileBytes: Uint8Array;
  contentType: string;
  filename: string;
}

// ── RPC helper ──────────────────────────────────────

async function ckbRpc(network: string, method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(RPC_ENDPOINTS[network] || RPC_ENDPOINTS.testnet, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 1, jsonrpc: '2.0', method, params }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`RPC error: ${data.error.message}`);
  return data.result;
}

// ── Hex/bytes ───────────────────────────────────────

function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex;
  const buf = new ArrayBuffer(h.length / 2);
  const b = new Uint8Array(buf);
  for (let i = 0; i < b.length; i++) b[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return b;
}

// ── Parse ckbfs:// identifier ───────────────────────

function parseIdentifier(input: string): string {
  let typeId = input.trim();
  if (typeId.startsWith('ckbfs://')) typeId = typeId.slice('ckbfs://'.length);
  // Handle ckbfs://txhash:index format — extract just the txhash part
  if (typeId.includes(':')) typeId = typeId.split(':')[0];
  if (!typeId.startsWith('0x')) typeId = '0x' + typeId;
  if (typeId.length !== 66) throw new Error('Invalid TypeID — expected 32-byte hex (0x + 64 chars)');
  return typeId;
}

// ── Molecule decoder (handles V2 4-field and V3 4-field schemas) ─────────

interface CkbfsMeta {
  index?: number;
  indexes: number[] | null;
  checksum: number;
  contentType: string;
  filename: string;
}

function decodeCKBFSData(hex: string): CkbfsMeta {
  const raw = hexToBytes(hex);
  const buf = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
  const data = new Uint8Array(buf);
  const dv = new DataView(buf);

  const totalSize = dv.getUint32(0, true);
  const firstOffset = dv.getUint32(4, true);
  const fieldCount = (firstOffset / 4) - 1;

  const offsets: number[] = [];
  for (let i = 0; i < fieldCount; i++) offsets.push(dv.getUint32(4 + i * 4, true));
  offsets.push(totalSize);

  const readStr = (off: number): string => {
    const len = dv.getUint32(off, true);
    return new TextDecoder().decode(data.slice(off + 4, off + 4 + len));
  };

  if (fieldCount === 4) {
    return {
      index:       dv.getUint32(offsets[0], true),
      indexes:     null,
      checksum:    dv.getUint32(offsets[1], true),
      contentType: readStr(offsets[2]),
      filename:    readStr(offsets[3]),
    };
  } else {
    const idxBuf = buf.slice(offsets[0], offsets[1]);
    const idxDv = new DataView(idxBuf);
    const indexCount = idxDv.getUint32(0, true);
    const indexes: number[] = [];
    for (let i = 0; i < indexCount; i++) indexes.push(idxDv.getUint32(4 + i * 4, true));
    return {
      indexes,
      checksum:    dv.getUint32(offsets[1], true),
      contentType: readStr(offsets[2]),
      filename:    readStr(offsets[3]),
    };
  }
}

// ── Witness chunk extractor ─────────────────────────

function extractChunkFromWitness(witnessHex: string, isContinuation = false): Uint8Array {
  const bytes = hexToBytes(witnessHex);
  if (isContinuation) return bytes.slice(4);
  const magic = new TextDecoder().decode(bytes.slice(0, 5));
  if (magic !== 'CKBFS') throw new Error('Witness missing CKBFS magic header');
  const version = bytes[5];
  return bytes.slice(version === 0x03 ? 50 : 6);
}

function getNextIndex(witnessHex: string, isContinuation = false): number {
  const bytes = hexToBytes(witnessHex);
  if (isContinuation) {
    return new DataView(bytes.buffer, bytes.byteOffset, 4).getUint32(0, true);
  }
  if (bytes[5] === 0x03) {
    return new DataView(bytes.buffer, bytes.byteOffset + 46, 4).getUint32(0, true);
  }
  return 0;
}

// ── Main resolve ────────────────────────────────────

/**
 * Resolve a ckbfs:// URI to its file content.
 * Handles V2 (indexes array) and V3 (nextIndex chaining).
 */
export async function resolveCkbfsContent(
  uri: string,
  network = 'testnet',
): Promise<CkbfsResolvedContent> {
  const typeId = parseIdentifier(uri);

  // Search all known CKBFS code hashes
  let cells: { out_point: { tx_hash: string }; output_data: string }[] = [];
  for (const codeHash of CKBFS_CODE_HASHES) {
    const result = await ckbRpc(network, 'get_cells', [{
      script: { code_hash: codeHash, hash_type: 'data1', args: typeId },
      script_type: 'type',
      filter: null,
    }, 'asc', '0x1']) as { objects?: { out_point: { tx_hash: string }; output_data: string }[] };
    cells = result?.objects || [];
    if (cells.length) break;
  }
  if (!cells.length) throw new Error(`No CKBFS cell found for ${typeId.slice(0, 18)}…`);

  const cell = cells[0];
  const meta = decodeCKBFSData(cell.output_data || '0x');

  // Fetch the transaction to get witnesses
  const txResult = await ckbRpc(network, 'get_transaction', [cell.out_point.tx_hash]) as {
    transaction?: { witnesses?: string[] };
  };
  const witnesses = txResult?.transaction?.witnesses || [];

  // Reassemble chunks
  const chunks: Uint8Array[] = [];
  if (meta.indexes && meta.indexes.length > 0) {
    for (const idx of meta.indexes) {
      if (idx >= witnesses.length) throw new Error(`Witness index ${idx} out of range`);
      chunks.push(extractChunkFromWitness(witnesses[idx]));
    }
  } else {
    let idx = meta.index ?? 1;
    let isFirst = true;
    const visited = new Set<number>();
    while (idx !== 0 && !visited.has(idx)) {
      visited.add(idx);
      if (idx >= witnesses.length) throw new Error(`Witness index ${idx} out of range`);
      chunks.push(extractChunkFromWitness(witnesses[idx], !isFirst));
      const next = getNextIndex(witnesses[idx], !isFirst);
      isFirst = false;
      idx = next;
    }
    if (chunks.length === 0) {
      chunks.push(extractChunkFromWitness(witnesses[meta.index ?? 1], false));
    }
  }

  // Concatenate into clean ArrayBuffer
  const totalLen = chunks.reduce((s, c) => s + c.length, 0);
  const fileBuf = new ArrayBuffer(totalLen);
  const fileBytes = new Uint8Array(fileBuf);
  let offset = 0;
  for (const chunk of chunks) { fileBytes.set(chunk, offset); offset += chunk.length; }

  return {
    fileBytes,
    contentType: meta.contentType,
    filename: meta.filename,
  };
}
