import { useEffect } from 'react';

interface HtmlFullscreenViewerProps {
  dataUrl: string;
  title: string;
  onClose: () => void;
}

// Full-viewport iframe view for HTML cells. Uses the exact same sandbox
// as the inline preview — allow-scripts only, no allow-same-origin, so the
// iframe runs in a null-origin context and cannot read cellswap's cookies,
// localStorage, parent DOM, or any cross-frame state. Navigation within the
// frame is scoped to the frame; the frame cannot navigate the parent.
//
// This is the "serve a static site from chain" viewer. Full viewport gives
// the content room to breathe without users zooming into a 400px panel on
// mobile. A visible close button restores the cellswap UI.
export function HtmlFullscreenViewer({ dataUrl, title, onClose }: HtmlFullscreenViewerProps) {
  // Close on Escape — expected UX for fullscreen-esque modals.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        background: '#000',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.5rem 0.9rem',
          background: 'rgba(8, 10, 15, 0.95)',
          borderBottom: '1px solid var(--border)',
          fontSize: '0.85rem',
          color: 'var(--muted)',
          flexShrink: 0,
        }}
      >
        <span style={{ maxWidth: '70%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title} · rendered in a null-origin sandbox
        </span>
        <button
          type="button"
          onClick={onClose}
          className="btn btn-ghost"
          style={{ padding: '0.3rem 0.75rem', fontSize: '0.85rem' }}
        >
          Close (Esc)
        </button>
      </header>
      <iframe
        src={dataUrl}
        title={title}
        sandbox="allow-scripts"
        style={{ flex: 1, width: '100%', border: 'none', background: '#fff' }}
      />
    </div>
  );
}
