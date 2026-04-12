import type { ContentCategory } from '../types';

/** Categorise a MIME type for UI badge and rendering */
export function categoriseContent(contentType: string): ContentCategory {
  if (contentType.startsWith('image/')) return 'image';
  if (contentType === 'text/html') return 'html';
  if (contentType.startsWith('text/')) return 'text';
  return 'data';
}

/** Get badge CSS class for a content category */
export function badgeClass(category: ContentCategory): string {
  return `badge badge-${category}`;
}

/** Get human-readable label for a content category */
export function categoryLabel(contentType: string): string {
  const cat = categoriseContent(contentType);
  switch (cat) {
    case 'image': return contentType.replace('image/', '').toUpperCase();
    case 'text': return 'TEXT';
    case 'html': return 'HTML';
    case 'data': return contentType.split('/').pop()?.toUpperCase() || 'DATA';
  }
}

/** Convert content bytes to a data URL for preview */
/** Convert content bytes to a base64 data URL — proven approach from DOB minter */
export function contentToDataUrl(content: Uint8Array, contentType: string): string {
  let binary = '';
  for (let i = 0; i < content.length; i++) {
    binary += String.fromCharCode(content[i]);
  }
  return `data:${contentType};base64,${btoa(binary)}`;
}

/** Convert content bytes to string (for text/json/html) */
export function contentToString(content: Uint8Array): string {
  return new TextDecoder().decode(content);
}

/** Truncate a hex string for display */
export function shortHash(hash: string, head = 10, tail = 6): string {
  if (hash.length <= head + tail + 3) return hash;
  return `${hash.slice(0, head)}...${hash.slice(-tail)}`;
}

/** Truncate an address for display */
export function shortAddress(addr: string): string {
  return shortHash(addr, 12, 8);
}
