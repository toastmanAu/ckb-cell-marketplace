import { ccc } from '@ckb-ccc/connector-react';
import { shannonsToCkb } from '../lib/codec';
import type { TxSummary } from '../lib/tx-summary';

interface TxConfirmModalProps {
  action: string;
  summary: TxSummary;
  userLock: ccc.Script;
  extraInfo?: { label: string; value: string }[];
  onConfirm: () => void;
  onCancel: () => void;
}

export function TxConfirmModal({ action, summary, userLock, extraInfo, onConfirm, onCancel }: TxConfirmModalProps) {
  const ownerArgsShort = ccc.hexFrom(userLock.args).slice(0, 14) + '…';

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ maxWidth: '500px', width: '100%', padding: '1.5rem' }}
      >
        <h2 style={{ marginTop: 0, marginBottom: '0.3rem', fontSize: '1.15rem' }}>Confirm {action}</h2>
        <p style={{ margin: '0 0 1rem', color: 'var(--muted)', fontSize: '0.82rem', lineHeight: 1.4 }}>
          Verify the numbers below before signing. CellSwap computes these directly from the transaction you are about to sign, independent of the wallet's preview.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.45rem 1rem', fontSize: '0.9rem', marginBottom: '1rem' }}>
          <div style={{ color: 'var(--muted)' }}>Signing wallet</div>
          <div><code className="mono">{ownerArgsShort}</code></div>

          {summary.toOthers > 0n && (
            <>
              <div style={{ color: 'var(--muted)' }}>Paid to others</div>
              <div>{shannonsToCkb(summary.toOthers)} CKB</div>
            </>
          )}

          {summary.toDeadLock > 0n && (
            <>
              <div style={{ color: 'var(--warning, #a86a00)' }}>Locked permanently</div>
              <div style={{ color: 'var(--warning, #a86a00)' }}>{shannonsToCkb(summary.toDeadLock)} CKB</div>
            </>
          )}

          <div style={{ color: 'var(--muted)' }}>Protocol fee</div>
          <div>{shannonsToCkb(summary.fee)} CKB</div>

          <div style={{ color: 'var(--muted)' }}>Change back to you</div>
          <div>{shannonsToCkb(summary.toUser)} CKB</div>

          <div style={{ color: 'var(--muted)', borderTop: '1px solid var(--border)', paddingTop: '0.45rem' }}>Net out of wallet</div>
          <div style={{ fontWeight: 600, borderTop: '1px solid var(--border)', paddingTop: '0.45rem' }}>{shannonsToCkb(summary.netOut)} CKB</div>

          <div style={{ color: 'var(--muted)' }}>Inputs / Outputs</div>
          <div>{summary.inputCount} / {summary.outputCount}</div>

          {extraInfo?.map((row) => (
            <div key={row.label} style={{ display: 'contents' }}>
              <div style={{ color: 'var(--muted)' }}>{row.label}</div>
              <div style={{ overflowWrap: 'anywhere' }}>{row.value}</div>
            </div>
          ))}
        </div>

        {summary.toDeadLock > 0n && (
          <div style={{ fontSize: '0.8rem', color: 'var(--warning, #a86a00)', marginBottom: '1rem', lineHeight: 1.4 }}>
            ⚠ Immutable mint: the CKB marked "Locked permanently" can never be recovered. The cell stays on chain forever.
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn btn-buy" onClick={onConfirm}>Confirm &amp; Sign</button>
        </div>
      </div>
    </div>
  );
}
