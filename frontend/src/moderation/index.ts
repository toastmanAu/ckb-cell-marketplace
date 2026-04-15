import { ccc } from '@ckb-ccc/connector-react';
import blocked from './blocked.json';

// Moderation enforcement is frontend-only. Cells remain on-chain forever; the
// site refuses to render or mint for blocked identities. Three independent
// keys: wallet (lockCodeHash + lockArgs) blocks future mints AND hides past
// content from that wallet; creatorLockHash hides listings whose LSDL args
// name a blocked creator (covers post-mint laundering); outpoint hides a
// single bad cell from an otherwise-fine wallet.

export interface BlockedWallet {
  lockCodeHash: string;
  lockArgs: string;
  reason: string;
  reportedAt: string;
  reports?: string[];
}

export interface BlockedOutpoint {
  txHash: string;
  index: number;
  reason: string;
  reportedAt: string;
}

export interface BlockedCreator {
  creatorLockHash: string;
  reason: string;
  reportedAt: string;
}

interface BlockedData {
  wallets: BlockedWallet[];
  outpoints: BlockedOutpoint[];
  creatorLockHashes: BlockedCreator[];
}

const data = blocked as BlockedData;

const normalizeHex = (h: string): string => (h.startsWith('0x') ? h : `0x${h}`).toLowerCase();

export function isWalletBlocked(lock: ccc.Script): boolean {
  const codeHash = normalizeHex(ccc.hexFrom(lock.codeHash));
  const args = normalizeHex(ccc.hexFrom(lock.args));
  return data.wallets.some(
    (w) => normalizeHex(w.lockCodeHash) === codeHash && normalizeHex(w.lockArgs) === args,
  );
}

export function isOutpointBlocked(outPoint: ccc.OutPointLike): boolean {
  const txHash = normalizeHex(ccc.hexFrom(outPoint.txHash));
  const index = Number(outPoint.index);
  return data.outpoints.some(
    (o) => normalizeHex(o.txHash) === txHash && o.index === index,
  );
}

export function isCreatorBlocked(creatorLockHash20Bytes: Uint8Array): boolean {
  const hex = normalizeHex(ccc.hexFrom(creatorLockHash20Bytes));
  return data.creatorLockHashes.some((c) => normalizeHex(c.creatorLockHash) === hex);
}

export function getBlockedWalletReason(lock: ccc.Script): string | null {
  const codeHash = normalizeHex(ccc.hexFrom(lock.codeHash));
  const args = normalizeHex(ccc.hexFrom(lock.args));
  const hit = data.wallets.find(
    (w) => normalizeHex(w.lockCodeHash) === codeHash && normalizeHex(w.lockArgs) === args,
  );
  return hit?.reason ?? null;
}
