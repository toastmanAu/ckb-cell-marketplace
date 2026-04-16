import { useCallback, useEffect, useState } from 'react';

// User preferences are scoped to wallet identity so they follow the address
// across sessions, devices, and browsers — but without the overhead of an
// on-chain registry. Today this is localStorage keyed by address; when JIDSR
// (JoyID-keyed Sparse Merkle Tree registry) is deployed, the read and write
// bodies swap to async registry calls while the hook's signature stays the
// same. Browse and any other consumer need no change.

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

function readPrefs(address: string | null): UserPrefs {
  try {
    const raw = window.localStorage.getItem(storageKey(address));
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<UserPrefs>;
    return { ...DEFAULT_PREFS, ...parsed };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function usePrefs(address: string | null) {
  const [prefs, setPrefsState] = useState<UserPrefs>(() => readPrefs(address));

  // Swap prefs when the connected wallet changes. Anonymous (no address)
  // users get their own silo so connecting later doesn't overwrite the
  // wallet-scoped prefs with anonymous-session choices.
  useEffect(() => {
    setPrefsState(readPrefs(address));
  }, [address]);

  const setPref = useCallback(
    <K extends keyof UserPrefs>(key: K, value: UserPrefs[K]) => {
      setPrefsState((prev) => {
        const next = { ...prev, [key]: value };
        try {
          window.localStorage.setItem(storageKey(address), JSON.stringify(next));
        } catch {
          // Storage quota exceeded or privacy-mode — in-memory only is fine
        }
        return next;
      });
    },
    [address],
  );

  return { prefs, setPref };
}
