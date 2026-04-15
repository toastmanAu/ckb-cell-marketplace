import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ccc } from '@ckb-ccc/connector-react';
import { ContentRenderer } from './ContentRenderer';
import { createClient, fetchLibraryDocs } from '../lib/indexer';
import type { OwnedItem } from '../types';

export function Library() {
  const [docs, setDocs] = useState<OwnedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const client = createClient();
    fetchLibraryDocs(client)
      .then((d) => { if (!cancelled) setDocs(d); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 1rem' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ marginBottom: '0.4rem' }}>CKB Library</h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', lineHeight: 1.5, maxWidth: '640px' }}>
          Permanent markdown documents minted to the CKB blockchain with an immutable lock. Once minted, these cells can never be spent, transferred, or destroyed — the content lives on chain for as long as CKB does.
        </p>
        <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: '0.75rem' }}>
          <Link to="/mint">Contribute a document</Link> — choose <code>text/markdown</code> and tick <strong>Immutable</strong> on the mint page.
        </p>
      </header>

      {loading && <div className="empty-state"><div className="tx-protocol-text">Scanning chain for library cells...</div></div>}
      {error && !loading && <div className="empty-state"><h3>Failed to load library</h3><p>{error}</p></div>}
      {!loading && !error && docs.length === 0 && (
        <div className="empty-state">
          <h3>The library is empty</h3>
          <p>Be the first to mint a permanent document.</p>
          <Link to="/mint" className="btn btn-buy" style={{ marginTop: '1rem', display: 'inline-block' }}>Mint a document</Link>
        </div>
      )}

      {!loading && !error && docs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {docs.map((doc) => {
            const id = `${ccc.hexFrom(doc.outPoint.txHash)}:${doc.outPoint.index}`;
            return (
              <Link
                key={id}
                to={`/item/${encodeURIComponent(id)}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <article className="card" style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem', gap: '0.5rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', flex: 1 }}>{doc.marketItem.description || '(untitled)'}</h3>
                    <span style={{ fontSize: '0.72rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                      {(doc.marketItem.content.length / 1024).toFixed(1)} KB
                    </span>
                  </div>
                  <div className="markdown-body" style={{ maxHeight: '180px', overflow: 'hidden', position: 'relative', fontSize: '0.88rem' }}>
                    <ContentRenderer item={doc.marketItem} mode="preview" />
                    <div style={{
                      position: 'absolute', inset: 0, pointerEvents: 'none',
                      background: 'linear-gradient(to bottom, transparent 60%, var(--bg, #0a0c11) 100%)',
                    }} />
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '0.5rem' }}>
                    Immutable · {doc.marketItem.contentType}
                  </div>
                </article>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
