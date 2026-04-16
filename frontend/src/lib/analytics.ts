import { ccc } from '@ckb-ccc/connector-react';

// Off-chain analytics client. Talks to the cellswap-api Worker for
// derived data — view counts, aggregates, etc. Nothing here is
// authoritative; losing all of it would not harm any user's on-chain
// position. Designed to degrade gracefully: if the worker is down or
// CORS-blocked, every call resolves to a benign fallback so the UI
// still renders.

const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined) ??
  'https://cellswap-api.toastmanau.workers.dev';

function outpointId(outPoint: ccc.OutPointLike): string {
  return `${ccc.hexFrom(outPoint.txHash)}:${Number(outPoint.index)}`;
}

export async function recordView(outPoint: ccc.OutPointLike): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outpoint: outpointId(outPoint) }),
    });
  } catch {
    // Worker unreachable — count simply doesn't increment. View tracking
    // is best-effort, never blocks the UI.
  }
}

export async function fetchViewCounts(
  outPoints: readonly ccc.OutPointLike[],
): Promise<Record<string, number>> {
  if (outPoints.length === 0) return {};
  try {
    const res = await fetch(`${API_BASE}/api/counts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outpoints: outPoints.map(outpointId) }),
    });
    if (!res.ok) return {};
    const data = (await res.json()) as { counts?: Record<string, number> };
    return data.counts ?? {};
  } catch {
    return {};
  }
}
