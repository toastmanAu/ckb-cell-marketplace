import { useState } from 'react';
import { useCcc, ccc } from '@ckb-ccc/connector-react';
import { useMyItems } from '../hooks/useMyItems';
import { ContentRenderer } from './ContentRenderer';
import { ListItem } from './ListItem';
import { TxStatus } from './TxStatus';
import { categoriseContent, categoryLabel, badgeClass } from '../lib/content';
import { shannonsToCkb } from '../lib/codec';
import { buildCancelTx } from '../lib/transactions';
import { createClient, fetchCell } from '../lib/indexer';
import type { TxState } from '../types';

export function MyItems() {
  const { signerInfo } = useCcc();
  const signer = signerInfo?.signer;
  const { owned, listed, loading, error, refresh } = useMyItems();
  const [listingFor, setListingFor] = useState<string | null>(null);
  const [txState, setTxState] = useState<TxState>({ status: 'idle' });

  async function handleCancelListing(outPoint: ccc.OutPoint) {
    if (!signer) return;
    try {
      setTxState({ status: 'building', message: 'Constructing cancel transaction...' });
      const client = createClient();
      const cell = await fetchCell(client, outPoint);
      if (!cell) { setTxState({ status: 'error', message: 'Cell not found' }); return; }
      const tx = await buildCancelTx(signer, cell);
      setTxState({ status: 'signing' });
      const hash = await signer.sendTransaction(tx);
      setTxState({ status: 'success', txHash: hash });
      refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setTxState({ status: 'error', message: msg });
    }
  }

  if (!signer) {
    return (
      <div className="empty-state">
        <h3>Connect your wallet</h3>
        <p>View your owned and listed cells after connecting.</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 700 }}>My Cells</h2>
        <button className="btn btn-ghost" onClick={refresh} style={{ padding: '0.3rem 0.6rem', fontSize: '0.85rem' }}>
          Refresh
        </button>
      </div>

      {loading && <div className="empty-state"><div className="tx-protocol-text">Scanning your cells...</div></div>}

      {error && <div style={{ color: 'var(--red)', padding: '1rem', background: 'var(--surface)', borderRadius: '8px', fontSize: '0.88rem' }}>Error: {error}</div>}

      {!loading && (
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1rem', color: 'var(--green)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
            Owned ({owned.length})
          </h3>
          {owned.length === 0 && <div style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>No owned MarketItem cells. Mint one to get started.</div>}
          {owned.map(item => {
            const key = `${ccc.hexFrom(item.outPoint.txHash)}:${item.outPoint.index}`;
            return (
              <div key={key} style={{ marginBottom: '0.75rem' }}>
                <div className="card">
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                    <div style={{ width: '100px', flexShrink: 0 }}>
                      <ContentRenderer item={item.marketItem} mode="preview" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                        <span className={badgeClass(categoriseContent(item.marketItem.contentType))}>
                          {categoryLabel(item.marketItem.contentType)}
                        </span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{item.marketItem.content.length} bytes</span>
                      </div>
                      <div style={{ fontSize: '0.88rem', marginBottom: '0.5rem' }}>{item.marketItem.description}</div>
                      <button
                        className="btn btn-primary"
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.82rem' }}
                        onClick={() => setListingFor(listingFor === key ? null : key)}
                      >
                        {listingFor === key ? 'Close' : 'List for Sale'}
                      </button>
                    </div>
                  </div>
                </div>
                {listingFor === key && (
                  <ListItem
                    item={item}
                    onListed={() => { setListingFor(null); refresh(); }}
                    onCancel={() => setListingFor(null)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && (
        <div>
          <h3 style={{ fontSize: '1rem', color: 'var(--purple)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--purple)', display: 'inline-block' }} />
            Listed ({listed.length})
          </h3>
          {listed.length === 0 && <div style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>No items listed for sale.</div>}
          {listed.map(listing => {
            const key = `${ccc.hexFrom(listing.outPoint.txHash)}:${listing.outPoint.index}`;
            return (
              <div key={key} className="card" style={{ marginBottom: '0.75rem', borderColor: 'color-mix(in srgb, var(--purple) 30%, var(--border))' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                  <div style={{ width: '100px', flexShrink: 0 }}>
                    <ContentRenderer item={listing.marketItem} mode="preview" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <span className={badgeClass(categoriseContent(listing.marketItem.contentType))}>
                        {categoryLabel(listing.marketItem.contentType)}
                      </span>
                      <span className="price">{shannonsToCkb(listing.lsdlArgs.totalValue)} CKB</span>
                    </div>
                    <div style={{ fontSize: '0.88rem', marginBottom: '0.5rem' }}>{listing.marketItem.description}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.5rem' }}>
                      {(listing.lsdlArgs.royaltyBps / 100).toFixed(1)}% royalty ·
                      {listing.lsdlArgs.expiryEpoch === 0n ? ' Permanent' : ` Epoch ${listing.lsdlArgs.expiryEpoch}`}
                    </div>
                    <button
                      className="btn btn-danger"
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.82rem' }}
                      onClick={() => handleCancelListing(listing.outPoint)}
                    >
                      Cancel Listing
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <TxStatus state={txState} onClose={() => setTxState({ status: 'idle' })} />
    </div>
  );
}
