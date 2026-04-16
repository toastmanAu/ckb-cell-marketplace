import { useState, useEffect, useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { categoriseContent, contentToDataUrl, contentToString } from '../lib/content';
import { resolveCkbfsContent } from '../lib/ckbfs-resolver';
import type { MarketItem } from '../types';

interface ContentRendererProps {
  item: MarketItem;
  mode: 'preview' | 'full';
}

/** Check if content bytes look like a ckbfs:// URI reference rather than raw binary */
function isCkbfsRef(content: Uint8Array): boolean {
  if (content.length > 200) return false;
  try {
    const text = new TextDecoder().decode(content);
    return text.startsWith('ckbfs://');
  } catch {
    return false;
  }
}

/** Sub-component that resolves and renders CKBFS content */
function CkbfsContent({ uri, description, mode }: {
  uri: string; contentType?: string; description: string; mode: 'preview' | 'full';
}) {
  const [state, setState] = useState<'loading' | 'done' | 'error'>('loading');
  const [resolved, setResolved] = useState<{ fileBytes: Uint8Array; contentType: string } | null>(null);
  const [error, setError] = useState('');
  const isPreview = mode === 'preview';

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    resolveCkbfsContent(uri, 'testnet')
      .then(result => {
        if (cancelled) return;
        setResolved(result);
        setState('done');
      })
      .catch(e => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setState('error');
      });
    return () => { cancelled = true; };
  }, [uri]);

  if (state === 'loading') {
    return (
      <div style={{
        background: 'var(--surface2)',
        borderRadius: '8px',
        padding: isPreview ? '0.75rem' : '1.25rem',
        height: isPreview ? '180px' : '200px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
      }}>
        <div className="tx-protocol-text" style={{ marginTop: 0, fontSize: '0.7rem' }}>
          Resolving from CKBFS...
        </div>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div style={{
        background: 'var(--surface2)',
        borderRadius: '8px',
        padding: '1rem',
        height: isPreview ? '180px' : 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
      }}>
        <span style={{ fontSize: '1.2rem' }}>&#x1F5C4;</span>
        <span style={{ fontSize: '0.78rem', color: 'var(--red)' }}>CKBFS resolve failed</span>
        {!isPreview && (
          <code style={{ fontSize: '0.7rem', color: 'var(--muted)', wordBreak: 'break-all' }}>{error}</code>
        )}
      </div>
    );
  }

  // Resolved — render the actual content
  if (resolved && resolved.contentType.startsWith('image/')) {
    let binary = '';
    for (let i = 0; i < resolved.fileBytes.length; i++) {
      binary += String.fromCharCode(resolved.fileBytes[i]);
    }
    const dataUrl = `data:${resolved.contentType};base64,${btoa(binary)}`;
    return (
      <img
        src={dataUrl}
        alt={description}
        style={{
          width: '100%',
          height: isPreview ? '180px' : 'auto',
          maxHeight: isPreview ? '180px' : '500px',
          objectFit: isPreview ? 'cover' : 'contain',
          borderRadius: '8px',
          background: 'var(--surface2)',
        }}
      />
    );
  }

  // Non-image CKBFS content
  if (resolved) {
    const text = new TextDecoder().decode(resolved.fileBytes);
    return (
      <pre style={{
        background: 'var(--surface2)',
        borderRadius: '8px',
        padding: isPreview ? '0.75rem' : '1.25rem',
        fontSize: isPreview ? '0.78rem' : '0.88rem',
        color: 'var(--green)',
        fontFamily: "'JetBrains Mono', monospace",
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        maxHeight: isPreview ? '180px' : '500px',
        overflow: 'auto',
        lineHeight: 1.5,
      }}>
        {isPreview ? text.slice(0, 300) : text}
      </pre>
    );
  }

  return null;
}

/** Renders sanitized markdown as HTML using DOMPurify for XSS protection */
function MarkdownViewer({ markdown }: { markdown: string }) {
  const [node, setNode] = useState<HTMLDivElement | null>(null);

  const safeHtml = useMemo(() => {
    const raw = marked.parse(markdown, { async: false }) as string;
    return DOMPurify.sanitize(raw);
  }, [markdown]);

  useEffect(() => {
    if (node) {
      // Content is sanitized by DOMPurify above — safe to render
      const range = document.createRange();
      const fragment = range.createContextualFragment(safeHtml);
      node.replaceChildren(fragment);
    }
  }, [node, safeHtml]);

  return (
    <div
      ref={setNode}
      className="markdown-body"
      style={{
        background: 'var(--surface2)',
        borderRadius: '8px',
        padding: '1.25rem',
        maxHeight: '500px',
        overflow: 'auto',
        fontSize: '0.9rem',
        lineHeight: 1.7,
        color: 'var(--fg)',
      }}
    />
  );
}

export function ContentRenderer({ item, mode }: ContentRendererProps) {
  const category = categoriseContent(item.contentType);
  const isPreview = mode === 'preview';

  // Handle CKBFS references — resolve and render actual content from chain
  if (isCkbfsRef(item.content)) {
    const uri = new TextDecoder().decode(item.content);
    return <CkbfsContent uri={uri} description={item.description} mode={mode} />;
  }

  if (category === 'image') {
    const url = contentToDataUrl(item.content, item.contentType);
    return (
      <img
        src={url}
        alt={item.description}
        style={{
          width: '100%',
          height: isPreview ? '180px' : 'auto',
          maxHeight: isPreview ? '180px' : '500px',
          objectFit: isPreview ? 'cover' : 'contain',
          borderRadius: '8px',
          background: 'var(--surface2)',
        }}
      />
    );
  }

  if (category === 'text') {
    const text = contentToString(item.content);
    return (
      <pre style={{
        background: 'var(--surface2)',
        borderRadius: '8px',
        padding: isPreview ? '0.75rem' : '1.25rem',
        fontSize: isPreview ? '0.78rem' : '0.88rem',
        color: 'var(--green)',
        fontFamily: "'JetBrains Mono', monospace",
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        maxHeight: isPreview ? '180px' : '500px',
        overflow: 'hidden',
        lineHeight: 1.5,
      }}>
        {isPreview ? text.slice(0, 300) : text}
      </pre>
    );
  }

  if (category === 'markdown') {
    const md = contentToString(item.content);
    if (isPreview) {
      return (
        <pre style={{
          background: 'var(--surface2)',
          borderRadius: '8px',
          padding: '0.75rem',
          fontSize: '0.78rem',
          color: 'var(--cyan)',
          fontFamily: "'JetBrains Mono', monospace",
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          maxHeight: '180px',
          overflow: 'hidden',
          lineHeight: 1.5,
        }}>
          {md.slice(0, 300)}
        </pre>
      );
    }
    return <MarkdownViewer markdown={md} />;
  }

  if (category === 'pdf') {
    if (isPreview) {
      return (
        <div style={{
          background: 'var(--surface2)',
          borderRadius: '8px',
          padding: '1rem',
          height: '180px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.4rem',
          color: 'var(--muted)',
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          <span style={{ fontSize: '1.8rem' }}>📄</span>
          <span style={{ fontSize: '0.82rem' }}>PDF Document</span>
          <span style={{ fontSize: '0.72rem' }}>{(item.content.length / 1024).toFixed(1)} KB</span>
        </div>
      );
    }
    const url = contentToDataUrl(item.content, item.contentType);
    return (
      <iframe
        src={url}
        title={item.description}
        style={{
          width: '100%',
          height: '600px',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          background: '#fff',
        }}
      />
    );
  }

  if (category === 'html') {
    if (isPreview) {
      return (
        <div style={{
          background: 'var(--surface2)',
          borderRadius: '8px',
          padding: '1rem',
          height: '180px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--magenta)',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.85rem',
        }}>
          &lt;HTML&gt; Document
        </div>
      );
    }
    let binary = '';
    for (let i = 0; i < item.content.length; i++) {
      binary += String.fromCharCode(item.content[i]);
    }
    const dataUrl = `data:text/html;base64,${btoa(binary)}`;
    // sandbox="allow-scripts" (no allow-same-origin) means scripts run in a
    // null-origin context: they cannot read cellswap's cookies, localStorage,
    // parent DOM, or call APIs authenticated as this origin. A malicious cell
    // can render whatever it wants inside the frame but cannot exfiltrate or
    // phish against cellswap itself. Trade-off is that relative URLs inside
    // the HTML won't resolve, and the embedded script can't talk to any
    // cellswap context — intended for self-contained static HTML only.
    return (
      <iframe
        src={dataUrl}
        title={item.description}
        sandbox="allow-scripts"
        style={{
          width: '100%',
          height: '400px',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          background: '#fff',
        }}
      />
    );
  }

  // data (JSON, etc)
  const text = contentToString(item.content);
  let formatted = text;
  try {
    formatted = JSON.stringify(JSON.parse(text), null, 2);
  } catch { /* not JSON, show raw */ }

  return (
    <pre style={{
      background: 'var(--surface2)',
      borderRadius: '8px',
      padding: isPreview ? '0.75rem' : '1.25rem',
      fontSize: isPreview ? '0.75rem' : '0.85rem',
      color: 'var(--purple)',
      fontFamily: "'JetBrains Mono', monospace",
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
      maxHeight: isPreview ? '180px' : '500px',
      overflow: 'auto',
      lineHeight: 1.5,
    }}>
      {isPreview ? formatted.slice(0, 400) : formatted}
    </pre>
  );
}
