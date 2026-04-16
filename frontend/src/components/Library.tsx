import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ccc, useCcc } from '@ckb-ccc/connector-react';
import { ContentRenderer } from './ContentRenderer';
import { createClient, fetchLibraryDocs } from '../lib/indexer';
import { fetchViewCounts } from '../lib/analytics';
import { usePrefs } from '../hooks/usePrefs';
import type { OwnedItem } from '../types';

// Library shares sort semantics with Browse where they overlap but drops
// price-related options (library docs are immutable and unsellable) and
// adds a size option since document size is a meaningful discrimination
// criterion for a read-oriented page.
type LibrarySortOrder = 'newest' | 'oldest' | 'az' | 'za' | 'most-viewed' | 'size-small' | 'size-large';

const SORT_OPTIONS: Array<{ value: LibrarySortOrder; label: string }> = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'most-viewed', label: 'Most viewed' },
  { value: 'az', label: 'A → Z' },
  { value: 'za', label: 'Z → A' },
  { value: 'size-small', label: 'Size: smallest first' },
  { value: 'size-large', label: 'Size: largest first' },
];

function outpointId(outPoint: ccc.OutPointLike): string {
  return `${ccc.hexFrom(outPoint.txHash)}:${Number(outPoint.index)}`;
}

function applySearch(items: OwnedItem[], query: string): OwnedItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((doc) => {
    const description = doc.marketItem.description.toLowerCase();
    const type = doc.marketItem.contentType.toLowerCase();
    return description.includes(q) || type.includes(q);
  });
}

function applySort(
  items: OwnedItem[],
  order: LibrarySortOrder,
  viewCounts: Record<string, number>,
): OwnedItem[] {
  if (order === 'newest') return [...items].reverse();
  if (order === 'oldest') return items;
  const copy = [...items];
  switch (order) {
    case 'az':
      return copy.sort((a, b) => a.marketItem.description.localeCompare(b.marketItem.description));
    case 'za':
      return copy.sort((a, b) => b.marketItem.description.localeCompare(a.marketItem.description));
    case 'size-small':
      return copy.sort((a, b) => a.marketItem.content.length - b.marketItem.content.length);
    case 'size-large':
      return copy.sort((a, b) => b.marketItem.content.length - a.marketItem.content.length);
    case 'most-viewed':
      return copy.sort((a, b) => {
        const ca = viewCounts[outpointId(a.outPoint)] ?? 0;
        const cb = viewCounts[outpointId(b.outPoint)] ?? 0;
        if (cb !== ca) return cb - ca;
        return items.indexOf(b) - items.indexOf(a);
      });
    default:
      return copy;
  }
}

const PAGE_SIZE = 12;

export function Library() {
  const [docs, setDocs] = useState<OwnedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const { signerInfo } = useCcc();
  const signer = signerInfo?.signer;
  const [address, setAddress] = useState<string | null>(null);
  useEffect(() => {
    if (!signer) { setAddress(null); return; }
    signer.getRecommendedAddress().then(setAddress).catch(() => setAddress(null));
  }, [signer]);

  // Library reuses the Browse pref namespace for sort/viewMode because the
  // anchor is "how does this user like lists arranged?", which carries
  // across both views. LibrarySortOrder is a subset of SortOrder plus two
  // new options; we store via a narrow-case that ignores incompatible
  // values on read and writes its own choices directly.
  const { prefs, setPref } = usePrefs(address);
  const baselineSort: LibrarySortOrder =
    prefs.sortOrder === 'price-low' || prefs.sortOrder === 'price-high'
      ? 'newest'
      : (prefs.sortOrder as LibrarySortOrder);
  const [sortOrder, setSortOrder] = useState<LibrarySortOrder>(baselineSort);

  useEffect(() => {
    setSortOrder(baselineSort);
  }, [baselineSort]);

  const [search, setSearch] = useState('');
  const [viewCounts, setViewCounts] = useState<Record<string, number>>({});
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

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

  useEffect(() => {
    if (docs.length === 0) return;
    let cancelled = false;
    fetchViewCounts(docs.map((d) => d.outPoint)).then((c) => {
      if (!cancelled) setViewCounts(c);
    });
    return () => { cancelled = true; };
  }, [docs]);

  const visible = useMemo(
    () => applySort(applySearch(docs, search), sortOrder, viewCounts),
    [docs, search, sortOrder, viewCounts],
  );

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search, sortOrder]);

  const paginated = visible.slice(0, visibleCount);
  const canLoadMore = visibleCount < visible.length;

  function handleSortChange(next: LibrarySortOrder) {
    setSortOrder(next);
    // Persist back to the shared pref namespace when the choice is one of
    // the Browse-compatible options. Library-exclusive options (size)
    // remain session-local by design.
    const shared: ReadonlyArray<LibrarySortOrder> = ['newest', 'oldest', 'az', 'za', 'most-viewed'];
    if ((shared as readonly string[]).includes(next)) {
      setPref('sortOrder', next as Exclude<typeof prefs.sortOrder, never>);
    }
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 1rem' }}>
      <header style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ marginBottom: '0.4rem' }}>CKB Library</h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', lineHeight: 1.5, maxWidth: '640px' }}>
          Permanent markdown documents minted to the CKB blockchain with an immutable lock. Once minted, these cells can never be spent, transferred, or destroyed — the content lives on chain for as long as CKB does.
        </p>
        <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: '0.75rem' }}>
          <Link to="/mint">Contribute a document</Link> — choose <code>text/markdown</code> and tick <strong>Immutable</strong> on the mint page.
        </p>
      </header>

      {!loading && docs.length > 0 && (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title or content type..."
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
            value={sortOrder}
            onChange={(e) => handleSortChange(e.target.value as LibrarySortOrder)}
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
          <div style={{ fontSize: '0.82rem', color: 'var(--muted)', alignSelf: 'center' }}>
            {visible.length === docs.length ? `${docs.length} docs` : `${visible.length} of ${docs.length}`}
          </div>
        </div>
      )}

      {loading && <div className="empty-state"><div className="tx-protocol-text">Scanning chain for library cells...</div></div>}
      {error && !loading && <div className="empty-state"><h3>Failed to load library</h3><p>{error}</p></div>}
      {!loading && !error && docs.length === 0 && (
        <div className="empty-state">
          <h3>The library is empty</h3>
          <p>Be the first to mint a permanent document.</p>
          <Link to="/mint" className="btn btn-buy" style={{ marginTop: '1rem', display: 'inline-block' }}>Mint a document</Link>
        </div>
      )}
      {!loading && !error && docs.length > 0 && visible.length === 0 && (
        <div className="empty-state">
          <h3>No matches</h3>
          <p>No documents match your search. Try a different term.</p>
        </div>
      )}

      {!loading && !error && visible.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {paginated.map((doc) => {
            const id = outpointId(doc.outPoint);
            const count = viewCounts[id] ?? 0;
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
                  <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Immutable · {doc.marketItem.contentType}</span>
                    {count > 0 && <span>👁 {count}</span>}
                  </div>
                </article>
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
