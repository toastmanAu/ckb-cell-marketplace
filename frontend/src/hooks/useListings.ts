import { useState, useEffect, useCallback } from 'react';
import { createClient, fetchListings } from '../lib/indexer';
import type { ListingInfo } from '../types';

export function useListings() {
  const [listings, setListings] = useState<ListingInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const client = createClient();
      const results = await fetchListings(client);
      setListings(results);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { listings, loading, error, refresh };
}
