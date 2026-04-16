import { useState } from 'react';
import { ccc } from '@ckb-ccc/connector-react';

const REPORT_EMAIL = 'report@cellswap.xyz';

const REASONS = [
  { value: 'csam', label: 'Child sexual abuse material' },
  { value: 'violence', label: 'Threats of violence' },
  { value: 'doxxing', label: 'Doxxing / private information' },
  { value: 'nsii', label: 'Non-consensual intimate imagery' },
  { value: 'copyright', label: 'Copyright infringement' },
  { value: 'illegal', label: 'Otherwise unlawful content' },
  { value: 'spam', label: 'Spam / scam / malware' },
  { value: 'other', label: 'Other' },
];

interface ReportButtonProps {
  outPoint: ccc.OutPointLike;
  creatorLockHash?: string;
  contentType?: string;
  description?: string;
  variant?: 'link' | 'icon';
}

export function ReportButton({ outPoint, creatorLockHash, contentType, description, variant = 'link' }: ReportButtonProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0].value);
  const [note, setNote] = useState('');

  const txHash = ccc.hexFrom(outPoint.txHash);
  const index = Number(outPoint.index);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const subject = `[CellSwap report] ${reason} — ${txHash.slice(0, 12)}:${index}`;
    const body = [
      'Cell report from CellSwap',
      '',
      `Outpoint:        ${txHash}:${index}`,
      `Creator lock:    ${creatorLockHash ?? '(not provided)'}`,
      `Content type:    ${contentType ?? '(unknown)'}`,
      `Description:     ${description ?? '(none)'}`,
      `Reason category: ${reason}`,
      `Reported at:     ${new Date().toISOString()}`,
      '',
      'Reporter notes:',
      note.trim() || '(none)',
    ].join('\n');

    const mailto = `mailto:${REPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
    setOpen(false);
    setNote('');
    setReason(REASONS[0].value);
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
        title="Report this cell"
        style={
          variant === 'icon'
            ? { background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.8rem', padding: '0.2rem 0.4rem' }
            : { background: 'transparent', border: '1px solid var(--muted)', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.78rem', padding: '0.3rem 0.6rem', borderRadius: '4px' }
        }
      >
        Report
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem',
          }}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSubmit}
            style={{
              background: 'var(--bg, #111)', color: 'var(--text, #eee)', maxWidth: '480px', width: '100%',
              padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--muted)',
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Report this cell</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: '1rem', lineHeight: 1.4 }}>
              Submitting this opens your email app with a pre-filled report. The cell remains on chain regardless of the outcome — only this site's rendering is affected.
            </p>

            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem' }}>Reason</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              style={{ width: '100%', padding: '0.4rem', marginBottom: '0.8rem', background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--muted)', borderRadius: '4px' }}
            >
              {REASONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>

            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem' }}>Notes (optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              placeholder="Anything else the operator should know"
              style={{ width: '100%', padding: '0.4rem', marginBottom: '1rem', background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--muted)', borderRadius: '4px', fontFamily: 'inherit', fontSize: '0.85rem', resize: 'vertical' }}
            />

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-danger">Open email to send</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
