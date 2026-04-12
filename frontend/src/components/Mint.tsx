import { useState, useRef } from 'react';
import { useCcc } from '@ckb-ccc/connector-react';
import { ContentRenderer } from './ContentRenderer';
import { TxStatus } from './TxStatus';
import { buildMintTx } from '../lib/transactions';
import type { TxState, MarketItem } from '../types';

const MIME_OPTIONS = [
  'image/svg+xml',
  'image/png',
  'image/jpeg',
  'text/plain',
  'text/html',
  'application/json',
];

export function Mint() {
  const { signerInfo } = useCcc();
  const signer = signerInfo?.signer;
  const fileRef = useRef<HTMLInputElement>(null);

  const [contentType, setContentType] = useState('text/plain');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState<Uint8Array>(new Uint8Array());
  const [fileName, setFileName] = useState('');
  const [textInput, setTextInput] = useState('');
  const [txState, setTxState] = useState<TxState>({ status: 'idle' });

  const useFileMode = contentType.startsWith('image/') || contentType === 'application/json';

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    if (file.type && MIME_OPTIONS.includes(file.type)) {
      setContentType(file.type);
    }

    file.arrayBuffer().then(buf => {
      setContent(new Uint8Array(buf));
    });
  }

  function handleTextChange(text: string) {
    setTextInput(text);
    setContent(new TextEncoder().encode(text));
  }

  const preview: MarketItem | null = content.length > 0
    ? { contentType, description: description || '(no description)', content }
    : null;

  const canMint = signer && content.length > 0 && description.trim().length > 0 && contentType.length > 0;

  async function handleMint() {
    if (!signer || !canMint) return;
    try {
      setTxState({ status: 'building', message: 'Constructing mint transaction...' });
      const tx = await buildMintTx(signer, contentType, description.trim(), content);
      setTxState({ status: 'signing' });
      const txHash = await signer.sendTransaction(tx);
      setTxState({ status: 'success', txHash });
      setContent(new Uint8Array());
      setDescription('');
      setTextInput('');
      setFileName('');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setTxState({ status: 'error', message: msg });
    }
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '1.25rem' }}>Mint a Cell</h2>

      {!signer && (
        <div className="card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>
          Connect your wallet to mint
        </div>
      )}

      {signer && (
        <>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Content Type</label>
              <select className="form-select" value={contentType} onChange={e => setContentType(e.target.value)}>
                {MIME_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                className="form-textarea"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe this cell's content..."
                maxLength={500}
              />
            </div>

            {useFileMode ? (
              <div className="form-group">
                <label className="form-label">Content File</label>
                <div
                  className="drop-zone"
                  onClick={() => fileRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('dragover'); }}
                  onDragLeave={e => e.currentTarget.classList.remove('dragover')}
                  onDrop={e => {
                    e.preventDefault();
                    e.currentTarget.classList.remove('dragover');
                    const file = e.dataTransfer.files[0];
                    if (file) {
                      setFileName(file.name);
                      if (file.type && MIME_OPTIONS.includes(file.type)) setContentType(file.type);
                      file.arrayBuffer().then(buf => setContent(new Uint8Array(buf)));
                    }
                  }}
                >
                  {fileName ? (
                    <span style={{ color: 'var(--accent)' }}>{fileName} ({content.length} bytes)</span>
                  ) : (
                    <span>Drop a file here or click to select</span>
                  )}
                </div>
                <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={handleFileSelect} />
              </div>
            ) : (
              <div className="form-group">
                <label className="form-label">Content</label>
                <textarea
                  className="form-textarea"
                  value={textInput}
                  onChange={e => handleTextChange(e.target.value)}
                  placeholder={contentType === 'text/html' ? '<html>...</html>' : 'Enter content...'}
                  style={{ minHeight: '120px', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.85rem' }}
                />
              </div>
            )}

            {content.length > 0 && (
              <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginTop: '0.5rem' }}>
                Data size: {content.length} bytes · Estimated capacity: ~{Math.ceil(content.length * 2.2 / 100) + 300} CKB
              </div>
            )}
          </div>

          {preview && (
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '0.75rem' }}>Preview</div>
              <ContentRenderer item={preview} mode="full" />
            </div>
          )}

          <button
            className="btn btn-primary"
            disabled={!canMint}
            onClick={handleMint}
            style={{ width: '100%', padding: '0.8rem', fontSize: '1rem' }}
          >
            Mint Cell
          </button>

          {!canMint && (
            <div style={{ textAlign: 'center', fontSize: '0.82rem', color: 'var(--muted)', marginTop: '0.5rem' }}>
              {!description.trim() && 'Add a description'}{!description.trim() && content.length === 0 && ' and '}{content.length === 0 && 'add content'}
            </div>
          )}
        </>
      )}

      <TxStatus state={txState} onClose={() => setTxState({ status: 'idle' })} />
    </div>
  );
}
