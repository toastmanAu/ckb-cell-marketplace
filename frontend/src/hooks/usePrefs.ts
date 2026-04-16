import { useCallback, useEffect, useRef, useState } from 'react';
import { ccc } from '@ckb-ccc/connector-react';
import { readCellswapPrefs, writeCellswapPrefs } from '../lib/jidsdr';

// User preferences scoped to wallet identity. Three layers:
//
//   1. In-memory (React state) — instant, used for rendering.
//   2. localStorage — persists across page reloads on the same device.
//   3. On-chain via JIDSDR — persists across devices and browsers.
//
// Read priority on connect: chain → localStorage → defaults.
// Write path: every setPref writes to (1) + (2) immediately. Chain
// sync is explicit via syncToChain() — avoids a JoyID popup on every
// sort-order toggle.

export type SortOrder =
  | 'newest'
  | 'oldest'
  | 'az'
  | 'za'
  | 'price-low'
  | 'price-high'
  | 'most-viewed';
export type ViewMode = 'gallery' | 'list';

export interface UserPrefs {
  sortOrder: SortOrder;
  viewMode: ViewMode;
}

export const DEFAULT_PREFS: UserPrefs = {
  sortOrder: 'newest',
  viewMode: 'gallery',
};

function storageKey(address: string | null): string {
  return address ? `cellswap.prefs.${address}` : 'cellswap.prefs.anonymous';
}

function readLocalPrefs(address: string | null): UserPrefs {
  try {
    const raw = window.localStorage.getItem(storageKey(address));
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<UserPrefs>;
    return { ...DEFAULT_PREFS, ...parsed };
  } catch {
    return DEFAULT_PREFS;
  }
}

function writeLocalPrefs(address: string | null, prefs: UserPrefs): void {
  try {
    window.localStorage.setItem(storageKey(address), JSON.stringify(prefs));
  } catch {
    // Storage quota exceeded or privacy-mode — in-memory only
  }
}

export type ChainSyncState = 'idle' | 'reading' | 'writing' | 'done' | 'error';

export function usePrefs(
  address: string | null,
  signer?: ccc.Signer | null,
  userLock?: ccc.Script | null,
) {
  const [prefs, setPrefsState] = useState<UserPrefs>(() => readLocalPrefs(address));
  const [chainSyncState, setChainSyncState] = useState<ChainSyncState>('idle');
  const [chainSyncMessage, setChainSyncMessage] = useState('');
  const hasReadChain = useRef(false);

  // Swap prefs when the connected wallet changes.
  useEffect(() => {
    setPrefsState(readLocalPrefs(address));
    hasReadChain.current = false;
  }, [address]);

  // On connect with a wallet: try to read prefs from chain (one-time).
  // Chain prefs override localStorage — they're the cross-device source
  // of truth. If chain read fails, localStorage prefs stand.
  useEffect(() => {
    if (!userLock || !address || hasReadChain.current) return;
    hasReadChain.current = true;
    setChainSyncState('reading');

    readCellswapPrefs(userLock)
      .then((chainPrefs) => {
        if (chainPrefs) {
          const merged: UserPrefs = {
            ...DEFAULT_PREFS,
            ...chainPrefs as Partial<UserPrefs>,
          };
          setPrefsState(merged);
          writeLocalPrefs(address, merged);
          setChainSyncState('done');
          setChainSyncMessage('Preferences loaded from chain');
        } else {
          setChainSyncState('done');
          setChainSyncMessage('No on-chain preferences found — using local');
        }
      })
      .catch(() => {
        setChainSyncState('error');
        setChainSyncMessage('Could not read on-chain preferences');
      });
  }, [userLock, address]);

  const setPref = useCallback(
    <K extends keyof UserPrefs>(key: K, value: UserPrefs[K]) => {
      setPrefsState((prev) => {
        const next = { ...prev, [key]: value };
        writeLocalPrefs(address, next);
        return next;
      });
    },
    [address],
  );

  // Explicit chain sync — writes current prefs to the JIDSDR cell.
  // Returns the tx hash on success.
  const syncToChain = useCallback(async (): Promise<string | null> => {
    if (!signer || !userLock) return null;
    setChainSyncState('writing');
    try {
      const txHash = await writeCellswapPrefs(
        signer,
        userLock,
        prefs,
        (msg) => setChainSyncMessage(msg),
      );
      setChainSyncState('done');
      setChainSyncMessage(`Saved on-chain: ${txHash.slice(0, 14)}...`);
      return txHash;
    } catch (e: unknown) {
      setChainSyncState('error');
      setChainSyncMessage(e instanceof Error ? e.message : 'Chain sync failed');
      return null;
    }
  }, [signer, userLock, prefs]);

  return {
    prefs,
    setPref,
    syncToChain,
    chainSyncState,
    chainSyncMessage,
  };
}
