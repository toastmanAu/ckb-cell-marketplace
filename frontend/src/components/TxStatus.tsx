import type { TxState } from '../types';
import { EXPLORER_URL } from '../config';

interface TxStatusProps {
  state: TxState;
  onClose: () => void;
}

export function TxStatus({ state, onClose }: TxStatusProps) {
  if (state.status === 'idle') return null;

  const isActive = state.status === 'building' || state.status === 'signing' || state.status === 'broadcasting' || state.status === 'confirming';

  return (
    <div className="tx-overlay" onClick={isActive ? undefined : onClose}>
      <div className={`tx-card ${isActive ? 'tx-pulse' : ''}`} onClick={e => e.stopPropagation()}>
        {state.status === 'building' && (
          <>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>&#x2699;</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{state.message}</div>
            <div className="tx-protocol-text">Cell Swap Protocol In Progress</div>
          </>
        )}

        {state.status === 'signing' && (
          <>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>&#x1F511;</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>Waiting for signature...</div>
            <div className="tx-protocol-text">Approve in your wallet</div>
          </>
        )}

        {state.status === 'broadcasting' && (
          <>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>&#x1F4E1;</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>Broadcasting transaction...</div>
            <div className="tx-protocol-text">Cell Swap Protocol In Progress</div>
          </>
        )}

        {state.status === 'confirming' && (
          <>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>&#x23F3;</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>Confirming on-chain</div>
            <a
              href={`${EXPLORER_URL}/transaction/${state.txHash}`}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: '0.85rem', marginTop: '0.5rem', display: 'block' }}
            >
              View on Explorer
            </a>
            <div className="tx-protocol-text">Cell Swap Protocol In Progress</div>
          </>
        )}

        {state.status === 'success' && (
          <>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem', color: 'var(--green)' }}>&#x2713;</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--green)' }}>Transaction confirmed</div>
            <a
              href={`${EXPLORER_URL}/transaction/${state.txHash}`}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: '0.85rem', marginTop: '0.5rem', display: 'block' }}
            >
              View on Explorer
            </a>
            <button className="btn btn-primary" onClick={onClose} style={{ marginTop: '1rem' }}>
              Continue
            </button>
          </>
        )}

        {state.status === 'error' && (
          <>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem', color: 'var(--red)' }}>&#x2717;</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--red)' }}>Transaction failed</div>
            <div style={{
              fontSize: '0.82rem', color: 'var(--muted)', marginTop: '0.5rem',
              wordBreak: 'break-all', maxHeight: '120px', overflow: 'auto',
            }}>
              {state.message}
            </div>
            <button className="btn btn-ghost" onClick={onClose} style={{ marginTop: '1rem' }}>
              Dismiss
            </button>
          </>
        )}
      </div>
    </div>
  );
}
