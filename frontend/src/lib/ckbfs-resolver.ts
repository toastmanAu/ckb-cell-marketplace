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

interface CkbfsId {
  hash: string;        // 32-byte hex (0x-prefixed)
  outputIndex: number; // only meaningful for txHash format
  isTxHash: boolean;   // true if ckbfs://txhash:index format (legacy)
}

function parseIdentifier(input: string): CkbfsId {
  let raw = input.trim();
  if (raw.startsWith('ckbfs://')) raw = raw.slice('ckbfs://'.length);

  let outputIndex = 0;
  let isTxHash = false;
  if (raw.includes(':')) {
    const parts = raw.split(':');
    raw = parts[0];
    outputIndex = parseInt(parts[1] || '0', 10);
    isTxHash = true; // colon format = legacy txHash:index
  }

  if (!raw.startsWith('0x')) raw = '0x' + raw;
  if (raw.length !== 66) throw new Error('Invalid identifier — expected 32-byte hex');

  return { hash: raw, outputIndex, isTxHash };
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
  const id = parseIdentifier(uri);

  let txHash: string;
  let outputData: string;

  if (id.isTxHash) {
    // Legacy format: ckbfs://txhash:outputIndex — fetch TX directly and find the CKBFS output
    const txResult = await ckbRpc(network, 'get_transaction', [id.hash]) as {
      transaction?: { outputs?: { type?: { code_hash: string; args: string } }[]; witnesses?: string[] };
      tx_status?: { status: string };
    };
    if (!txResult?.transaction) throw new Error(`Transaction ${id.hash.slice(0, 18)}… not found`);

    // Find the CKBFS output by checking type script code_hash against known CKBFS hashes
    const outputs = txResult.transaction.outputs || [];
    let ckbfsOutputIdx = -1;
    for (let i = 0; i < outputs.length; i++) {
      const typeScript = outputs[i].type;
      if (typeScript && CKBFS_CODE_HASHES.includes(typeScript.code_hash)) {
        ckbfsOutputIdx = i;
        break;
      }
    }
    if (ckbfsOutputIdx === -1) throw new Error('No CKBFS output found in transaction');

    // Now fetch the live cell to get output_data (TX response doesn't include it)
    const cellResult = await ckbRpc(network, 'get_live_cell', [
      { tx_hash: id.hash, index: `0x${ckbfsOutputIdx.toString(16)}` },
      true,
    ]) as { cell?: { data?: { content: string } } };

    outputData = cellResult?.cell?.data?.content || '0x';
    txHash = id.hash;
  } else {
    // Standard format: ckbfs://typeId — search by type script args
    let cells: { out_point: { tx_hash: string }; output_data: string }[] = [];
    for (const codeHash of CKBFS_CODE_HASHES) {
      const result = await ckbRpc(network, 'get_cells', [{
        script: { code_hash: codeHash, hash_type: 'data1', args: id.hash },
        script_type: 'type',
        filter: null,
      }, 'asc', '0x1']) as { objects?: { out_point: { tx_hash: string }; output_data: string }[] };
      cells = result?.objects || [];
      if (cells.length) break;
    }
    if (!cells.length) throw new Error(`No CKBFS cell found for ${id.hash.slice(0, 18)}…`);

    outputData = cells[0].output_data || '0x';
    txHash = cells[0].out_point.tx_hash;
  }

  const meta = decodeCKBFSData(outputData);

  // Fetch the transaction to get witnesses (may already have it for txHash path)
  const witnessTxResult = await ckbRpc(network, 'get_transaction', [txHash]) as {
    transaction?: { witnesses?: string[] };
  };
  const witnesses = witnessTxResult?.transaction?.witnesses || [];

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
