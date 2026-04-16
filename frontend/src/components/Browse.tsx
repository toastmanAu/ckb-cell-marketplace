import { useEffect, useMemo, useState } from 'react';
import { useListings } from '../hooks/useListings';
import { usePrefs, type SortOrder } from '../hooks/usePrefs';
import { ItemCard } from './ItemCard';
import { shannonsToCkb } from '../lib/codec';
import { categoriseContent, categoryLabel, badgeClass } from '../lib/content';
import { ccc, useCcc } from '@ckb-ccc/connector-react';
import { Link } from 'react-router-dom';
import { fetchViewCounts } from '../lib/analytics';
import type { ListingInfo } from '../types';

const SORT_OPTIONS: Array<{ value: SortOrder; label: string }> = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'most-viewed', label: 'Most viewed' },
  { value: 'price-low', label: 'Price: low to high' },
  { value: 'price-high', label: 'Price: high to low' },
  { value: 'az', label: 'A → Z' },
  { value: 'za', label: 'Z → A' },
];

function outpointId(outPoint: ccc.OutPointLike): string {
  return `${ccc.hexFrom(outPoint.txHash)}:${Number(outPoint.index)}`;
}

function applySort(
  items: ListingInfo[],
  order: SortOrder,
  viewCounts: Record<string, number>,
): ListingInfo[] {
  // The CCC indexer returns listings in ascending block/tx order, so the
  // raw array is oldest-first. We reverse for 'newest' and leave as-is for
  // 'oldest'. Using array position as the age proxy avoids an extra RPC
  // per cell to resolve confirmation blocks.
  if (order === 'newest') return [...items].reverse();
  if (order === 'oldest') return items;
  const copy = [...items];
  switch (order) {
    case 'az':
      return copy.sort((a, b) => a.marketItem.description.localeCompare(b.marketItem.description));
    case 'za':
      return copy.sort((a, b) => b.marketItem.description.localeCompare(a.marketItem.description));
    case 'price-low':
      return copy.sort((a, b) => Number(a.lsdlArgs.totalValue - b.lsdlArgs.totalValue));
    case 'price-high':
      return copy.sort((a, b) => Number(b.lsdlArgs.totalValue - a.lsdlArgs.totalValue));
    case 'most-viewed':
      return copy.sort((a, b) => {
        const ca = viewCounts[outpointId(a.outPoint)] ?? 0;
        const cb = viewCounts[outpointId(b.outPoint)] ?? 0;
        // Tie-break on newest: higher raw-array index (=newer in asc order)
        // first so cards with 0 views still surface recent mints.
        if (cb !== ca) return cb - ca;
        return items.indexOf(b) - items.indexOf(a);
      });
    default:
      return copy;
  }
}

function applySearch(items: ListingInfo[], query: string): ListingInfo[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((l) => {
    const description = l.marketItem.description.toLowerCase();
    const type = l.marketItem.contentType.toLowerCase();
    const owner = ccc.hexFrom(l.lsdlArgs.ownerLock.args).toLowerCase();
    return description.includes(q) || type.includes(q) || owner.includes(q);
  });
}

export function Browse() {
  const { listings, loading, error, refresh } = useListings();
  const { signerInfo } = useCcc();
  const signer = signerInfo?.signer;

  // Resolve the connected wallet's address to a string key for preference
  // scoping. Anonymous users get their own silo — see usePrefs.
  const [address, setAddress] = useState<string | null>(null);
  useEffect(() => {
    if (!signer) { setAddress(null); return; }
    signer.getRecommendedAddress().then(setAddress).catch(() => setAddress(null));
  }, [signer]);

  const { prefs, setPref } = usePrefs(address);
  const [search, setSearch] = useState('');
  const [viewCounts, setViewCounts] = useState<Record<string, number>>({});
  const [visibleCount, setVisibleCount] = useState(24);
  const PAGE_SIZE = 24;

  // Batch-fetch view counts for the listings on screen. Worker is
  // best-effort — if unreachable, counts stay empty and Most-viewed sort
  // degrades into newest-first (all 0s → tie-break on newness).
  useEffect(() => {
    if (listings.length === 0) return;
    let cancelled = false;
    fetchViewCounts(listings.map((l) => l.outPoint)).then((c) => {
      if (!cancelled) setViewCounts(c);
    });
    return () => { cancelled = true; };
  }, [listings]);

  const visible = useMemo(
    () => applySort(applySearch(listings, search), prefs.sortOrder, viewCounts),
    [listings, search, prefs.sortOrder, viewCounts],
  );

  // Reset page slice when the filter/sort criteria change, so the user sees
  // the top of the new result set rather than whatever page position they
  // had in the previous one.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search, prefs.sortOrder]);

  const paginated = visible.slice(0, visibleCount);
  const canLoadMore = visibleCount < visible.length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 700 }}>
          Examine Cells
          {!loading && (
            <span style={{ fontSize: '0.85rem', color: 'var(--muted)', fontWeight: 400, marginLeft: '0.75rem' }}>
              {visible.length === listings.length
                ? `${listings.length} listed`
                : `${visible.length} of ${listings.length}`}
            </span>
          )}
        </h2>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="view-toggle">
            <button className={prefs.viewMode === 'gallery' ? 'active' : ''} onClick={() => setPref('viewMode', 'gallery')}>Grid</button>
            <button className={prefs.viewMode === 'list' ? 'active' : ''} onClick={() => setPref('viewMode', 'list')}>List</button>
          </div>
          <button className="btn btn-ghost" onClick={refresh} style={{ padding: '0.3rem 0.6rem', fontSize: '0.85rem' }}>
            Refresh
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search description, content type, owner args..."
          style={{
            flex: '1 1 240px',
            minWidth: 0,
            padding: '0.45rem 0.65rem',
            background: 'var(--surface)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            fontSize: '0.88rem',
          }}
        />
        <select
          value={prefs.sortOrder}
          onChange={(e) => setPref('sortOrder', e.target.value as SortOrder)}
          style={{
            padding: '0.45rem 0.65rem',
            background: 'var(--surface)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            fontSize: '0.88rem',
          }}
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="empty-state">
          <div className="tx-protocol-text" style={{ fontSize: '0.9rem' }}>Scanning indexer...</div>
        </div>
      )}

      {error && (
        <div style={{ color: 'var(--red)', padding: '1rem', background: 'var(--surface)', borderRadius: '8px', fontSize: '0.88rem' }}>
          Error: {error}
        </div>
      )}

      {!loading && !error && listings.length === 0 && (
        <div className="empty-state">
          <h3>No cells listed yet</h3>
          <p>Mint some content and list it for sale to see it here.</p>
        </div>
      )}

      {!loading && listings.length > 0 && visible.length === 0 && (
        <div className="empty-state">
          <h3>No matches</h3>
          <p>No listings match your search. Try a different term or clear the search box.</p>
        </div>
      )}

      {!loading && visible.length > 0 && prefs.viewMode === 'gallery' && (
        <div className="items-grid">
          {paginated.map(listing => (
            <ItemCard
              key={outpointId(listing.outPoint)}
              listing={listing}
              viewCount={viewCounts[outpointId(listing.outPoint)]}
            />
          ))}
        </div>
      )}

      {!loading && visible.length > 0 && prefs.viewMode === 'list' && (
        <div className="items-list">
          {paginated.map(listing => {
            const outPointId = `${ccc.hexFrom(listing.outPoint.txHash)}:${listing.outPoint.index}`;
            return (
              <Link key={outPointId} to={`/item/${encodeURIComponent(outPointId)}`} style={{ textDecoration: 'none' }}>
                <div className="list-row">
                  <div>
                    <span className={badgeClass(categoriseContent(listing.marketItem.contentType))} style={{ marginRight: '0.5rem' }}>
                      {categoryLabel(listing.marketItem.contentType)}
                    </span>
                    <span style={{ color: 'var(--text)' }}>
                      {listing.marketItem.description.length > 60
                        ? listing.marketItem.description.slice(0, 60) + '...'
                        : listing.marketItem.description}
                    </span>
                  </div>
                  <span className="price">{shannonsToCkb(listing.lsdlArgs.totalValue)} CKB</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {!loading && canLoadMore && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem' }}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
            style={{ padding: '0.6rem 1.4rem', fontSize: '0.9rem' }}
          >
            Load {Math.min(PAGE_SIZE, visible.length - visibleCount)} more ·
            <span style={{ color: 'var(--muted)', marginLeft: '0.4rem' }}>
              {visibleCount}/{visible.length}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
