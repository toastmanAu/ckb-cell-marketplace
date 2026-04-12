import { categoriseContent, contentToDataUrl, contentToString } from '../lib/content';
import type { MarketItem } from '../types';

interface ContentRendererProps {
  item: MarketItem;
  mode: 'preview' | 'full';
}

/** Check if content bytes look like a ckbfs:// URI reference rather than raw binary */
function isCkbfsRef(content: Uint8Array): boolean {
  if (content.length > 200) return false; // real images are larger
  try {
    const text = new TextDecoder().decode(content);
    return text.startsWith('ckbfs://');
  } catch {
    return false;
  }
}

export function ContentRenderer({ item, mode }: ContentRendererProps) {
  const category = categoriseContent(item.contentType);
  const isPreview = mode === 'preview';

  // Handle CKBFS references — content is a URI, not the actual file
  if (isCkbfsRef(item.content)) {
    const uri = new TextDecoder().decode(item.content);
    return (
      <div style={{
        background: 'var(--surface2)',
        borderRadius: '8px',
        padding: isPreview ? '0.75rem' : '1.25rem',
        height: isPreview ? '180px' : 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
      }}>
        <span style={{ fontSize: '1.5rem' }}>&#x1F5C4;</span>
        <span style={{ fontSize: '0.82rem', color: 'var(--accent)', fontFamily: "'JetBrains Mono', monospace" }}>
          CKBFS Stored
        </span>
        {!isPreview && (
          <code style={{ fontSize: '0.75rem', color: 'var(--muted)', wordBreak: 'break-all' }}>
            {uri}
          </code>
        )}
      </div>
    );
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
    const blob = new Blob([item.content.slice().buffer], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    return (
      <iframe
        src={url}
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
