import { useState } from 'react';
import { useListings } from '../hooks/useListings';
import { ItemCard } from './ItemCard';
import { shannonsToCkb } from '../lib/codec';
import { categoriseContent, categoryLabel, badgeClass } from '../lib/content';
import { ccc } from '@ckb-ccc/connector-react';
import { Link } from 'react-router-dom';

export function Browse() {
  const { listings, loading, error, refresh } = useListings();
  const [view, setView] = useState<'gallery' | 'list'>('gallery');

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 700 }}>
          Examine Cells
          {!loading && <span style={{ fontSize: '0.85rem', color: 'var(--muted)', fontWeight: 400, marginLeft: '0.75rem' }}>
            {listings.length} listed
          </span>}
        </h2>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <div className="view-toggle">
            <button className={view === 'gallery' ? 'active' : ''} onClick={() => setView('gallery')}>Grid</button>
            <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>List</button>
          </div>
          <button className="btn btn-ghost" onClick={refresh} style={{ padding: '0.3rem 0.6rem', fontSize: '0.85rem' }}>
            Refresh
          </button>
        </div>
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

      {!loading && listings.length > 0 && view === 'gallery' && (
        <div className="items-grid">
          {listings.map(listing => (
            <ItemCard key={`${ccc.hexFrom(listing.outPoint.txHash)}:${listing.outPoint.index}`} listing={listing} />
          ))}
        </div>
      )}

      {!loading && listings.length > 0 && view === 'list' && (
        <div className="items-list">
          {listings.map(listing => {
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
