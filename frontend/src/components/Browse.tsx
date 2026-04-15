import { useEffect, useMemo, useState } from 'react';
import { useListings } from '../hooks/useListings';
import { usePrefs, type SortOrder } from '../hooks/usePrefs';
import { ItemCard } from './ItemCard';
import { shannonsToCkb } from '../lib/codec';
import { categoriseContent, categoryLabel, badgeClass } from '../lib/content';
import { ccc, useCcc } from '@ckb-ccc/connector-react';
import { Link } from 'react-router-dom';
import type { ListingInfo } from '../types';

const SORT_OPTIONS: Array<{ value: SortOrder; label: string }> = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'price-low', label: 'Price: low to high' },
  { value: 'price-high', label: 'Price: high to low' },
  { value: 'az', label: 'A → Z' },
  { value: 'za', label: 'Z → A' },
];

function applySort(items: ListingInfo[], order: SortOrder): ListingInfo[] {
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

  const visible = useMemo(
    () => applySort(applySearch(listings, search), prefs.sortOrder),
    [listings, search, prefs.sortOrder],
  );

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
          {visible.map(listing => (
            <ItemCard key={`${ccc.hexFrom(listing.outPoint.txHash)}:${listing.outPoint.index}`} listing={listing} />
          ))}
        </div>
      )}

      {!loading && visible.length > 0 && prefs.viewMode === 'list' && (
        <div className="items-list">
          {visible.map(listing => {
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
    </div>
  );
}
