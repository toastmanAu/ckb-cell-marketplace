import type { MarketItem, DecodedLsdlArgs } from '../types';
import { ccc } from '@ckb-ccc/connector-react';

// ── MarketItem molecule encoding ────────────────────

const HEADER_SIZE = 16; // 4 (total) + 3 × 4 (offsets)

export function encodeMarketItem(
  contentType: string,
  description: string,
  content: Uint8Array,
): Uint8Array {
  const ctBytes = new TextEncoder().encode(contentType);
  const descBytes = new TextEncoder().encode(description);

  const ctFieldSize = 4 + ctBytes.length;
  const descFieldSize = 4 + descBytes.length;
  const contFieldSize = 4 + content.length;
  const totalSize = HEADER_SIZE + ctFieldSize + descFieldSize + contFieldSize;

  const buf = new ArrayBuffer(totalSize);
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);
  let off = 0;

  // Header: total_size + 3 offsets
  view.setUint32(off, totalSize, true); off += 4;
  view.setUint32(off, HEADER_SIZE, true); off += 4;
  view.setUint32(off, HEADER_SIZE + ctFieldSize, true); off += 4;
  view.setUint32(off, HEADER_SIZE + ctFieldSize + descFieldSize, true); off += 4;

  // content_type field
  view.setUint32(off, ctBytes.length, true); off += 4;
  bytes.set(ctBytes, off); off += ctBytes.length;

  // description field
  view.setUint32(off, descBytes.length, true); off += 4;
  bytes.set(descBytes, off); off += descBytes.length;

  // content field
  view.setUint32(off, content.length, true); off += 4;
  bytes.set(content, off);

  return bytes;
}

export function decodeMarketItem(data: Uint8Array): MarketItem {
  // Ensure we have a clean copy — ccc.bytesFrom() may return a subarray
  // whose .buffer is larger than the actual data, causing offset errors
  const clean = data.byteOffset === 0 ? data : new Uint8Array(data);
  const view = new DataView(clean.buffer, 0, clean.byteLength);

  // Read offsets from molecule header
  const offset0 = view.getUint32(4, true);  // content_type start
  const offset1 = view.getUint32(8, true);  // description start
  const offset2 = view.getUint32(12, true); // content start

  const ctLen = view.getUint32(offset0, true);
  const ctBytes = clean.subarray(offset0 + 4, offset0 + 4 + ctLen);

  const descLen = view.getUint32(offset1, true);
  const descBytes = clean.subarray(offset1 + 4, offset1 + 4 + descLen);

  const contLen = view.getUint32(offset2, true);
  const contentBytes = clean.subarray(offset2 + 4, offset2 + 4 + contLen);

  const decoder = new TextDecoder();
  return {
    contentType: decoder.decode(ctBytes),
    description: decoder.decode(descBytes),
    content: new Uint8Array(contentBytes),
  };
}

// ── LSDL args encoding/decoding ─────────────────────

export function encodeLsdlArgs(args: {
  ownerLock: ccc.Script;
  totalValue: bigint;
  creatorLockHash: Uint8Array;
  royaltyBps: number;
  expiryEpoch: bigint;
}): Uint8Array {
  const lockBytes = args.ownerLock.toBytes();
  const lockLen = lockBytes.length;
  const totalLen = 4 + lockLen + 16 + 20 + 2 + 8;

  const buf = new ArrayBuffer(totalLen);
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);
  let off = 0;

  // owner_lock size prefix (4 bytes LE)
  view.setUint32(off, lockLen, true); off += 4;

  // owner_lock Script molecule bytes
  bytes.set(lockBytes, off); off += lockLen;

  // total_value (16 bytes BE u128)
  const hi = args.totalValue >> 64n;
  const lo = args.totalValue & ((1n << 64n) - 1n);
  view.setBigUint64(off, hi, false); off += 8;
  view.setBigUint64(off, lo, false); off += 8;

  // creator_lock_hash (20 bytes)
  bytes.set(args.creatorLockHash, off); off += 20;

  // royalty_bps (2 bytes BE u16)
  view.setUint16(off, args.royaltyBps, false); off += 2;

  // expiry_epoch (8 bytes BE u64)
  view.setBigUint64(off, args.expiryEpoch, false);

  return bytes;
}

export function decodeLsdlArgs(argsHex: string): DecodedLsdlArgs {
  const hex = argsHex.startsWith('0x') ? argsHex.slice(2) : argsHex;
  const data = new Uint8Array(hex.match(/.{2}/g)!.map(b => parseInt(b, 16)));
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let off = 0;

  // owner_lock size
  const lockLen = view.getUint32(off, true); off += 4;

  // owner_lock Script molecule
  const lockBytes = data.subarray(off, off + lockLen);
  const ownerLock = ccc.Script.fromBytes(lockBytes);
  off += lockLen;

  // total_value (16 bytes BE u128)
  const hi = view.getBigUint64(off, false); off += 8;
  const lo = view.getBigUint64(off, false); off += 8;
  const totalValue = (hi << 64n) | lo;

  // creator_lock_hash (20 bytes)
  const creatorLockHash = new Uint8Array(data.subarray(off, off + 20));
  off += 20;

  // royalty_bps (2 bytes BE u16)
  const royaltyBps = view.getUint16(off, false); off += 2;

  // expiry_epoch (8 bytes BE u64)
  const expiryEpoch = view.getBigUint64(off, false);

  return { ownerLock, totalValue, creatorLockHash, royaltyBps, expiryEpoch };
}

// ── Helpers ─────────────────────────────────────────

/** Convert shannons to CKB display string */
export function shannonsToCkb(shannons: bigint): string {
  const whole = shannons / 100000000n;
  const frac = shannons % 100000000n;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(8, '0').replace(/0+$/, '');
  return `${whole}.${fracStr}`;
}

/** Convert CKB string to shannons */
export function ckbToShannons(ckb: string): bigint {
  const parts = ckb.split('.');
  const whole = BigInt(parts[0]) * 100000000n;
  if (parts.length === 1) return whole;
  const fracStr = (parts[1] || '').padEnd(8, '0').slice(0, 8);
  return whole + BigInt(fracStr);
}
