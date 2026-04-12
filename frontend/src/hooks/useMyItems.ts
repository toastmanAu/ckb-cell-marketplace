import { useState, useEffect, useCallback } from 'react';
import { useCcc } from '@ckb-ccc/connector-react';
import { createClient, fetchOwnedItems, fetchMyListings } from '../lib/indexer';
import type { OwnedItem, ListingInfo } from '../types';

export function useMyItems() {
  const { signerInfo } = useCcc();
  const signer = signerInfo?.signer;

  const [owned, setOwned] = useState<OwnedItem[]>([]);
  const [listed, setListed] = useState<ListingInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!signer) {
      setOwned([]);
      setListed([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const client = createClient();
      const userLock = (await signer.getRecommendedAddressObj()).script;
      const [ownedResults, listedResults] = await Promise.all([
        fetchOwnedItems(client, userLock),
        fetchMyListings(client, userLock),
      ]);
      setOwned(ownedResults);
      setListed(listedResults);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [signer]);

  useEffect(() => { refresh(); }, [refresh]);

  return { owned, listed, loading, error, refresh };
}
