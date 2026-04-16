import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useCcc, ccc } from '@ckb-ccc/connector-react';
import { ContentRenderer } from './ContentRenderer';
import { TxStatus } from './TxStatus';
import { buildMintTx, buildImmutableMintTx } from '../lib/transactions';
import { safeSendTransaction } from '../lib/tx-send';
import { summarizeTx, type TxSummary } from '../lib/tx-summary';
import { createClient } from '../lib/indexer';
import { TxConfirmModal } from './TxConfirmModal';
import { processImage, isProcessableImage, formatBytes, type ImageProcessOptions } from '../lib/image';
import { publishToCkbfs, estimateCkbfsCost } from '../lib/ckbfs';
import { isWalletBlocked, getBlockedWalletReason } from '../moderation';
import type { TxState, MarketItem } from '../types';

const MIME_OPTIONS = [
  'image/svg+xml',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/html',
  'application/json',
];

type StorageMode = 'inline' | 'ckbfs';

export function Mint() {
  const { signerInfo } = useCcc();
  const signer = signerInfo?.signer;
  const fileRef = useRef<HTMLInputElement>(null);

  // Resolve connected wallet's lock once per session — used to gate minting.
  const [walletLock, setWalletLock] = useState<ccc.Script | null>(null);
  useEffect(() => {
    if (!signer) { setWalletLock(null); return; }
    signer.getRecommendedAddressObj().then(a => setWalletLock(a.script)).catch(() => setWalletLock(null));
  }, [signer]);
  const walletBlocked = walletLock ? isWalletBlocked(walletLock) : false;
  const blockReason = walletLock ? getBlockedWalletReason(walletLock) : null;

  // Pre-sign confirmation. When set, a modal renders; onConfirm/onCancel
  // resolve the pending send.
  const [pendingSign, setPendingSign] = useState<null | {
    action: string;
    tx: ccc.Transaction;
    summary: TxSummary;
    extraInfo: { label: string; value: string }[];
  }>(null);

  const [contentType, setContentType] = useState('text/plain');
  const [description, setDescription] = useState('');
  const [rawContent, setRawContent] = useState<Uint8Array>(new Uint8Array());
  const [processedContent, setProcessedContent] = useState<Uint8Array>(new Uint8Array());
  const [processedMime, setProcessedMime] = useState('');
  const [fileName, setFileName] = useState('');
  const [textInput, setTextInput] = useState('');
  const [txState, setTxState] = useState<TxState>({ status: 'idle' });

  // Storage mode
  const [storageMode, setStorageMode] = useState<StorageMode>('inline');

  // Immutable mode — cell can never be transferred, sold, or destroyed
  const [immutable, setImmutable] = useState(false);

  // Image processing options
  const [imgOpts, setImgOpts] = useState<ImageProcessOptions>({
    maxDimension: 512,
    format: 'jpeg',
    quality: 0.85,
  });
  const [processing, setProcessing] = useState(false);

  const isImage = isProcessableImage(contentType);
  const useFileMode =
    contentType.startsWith('image/') ||
    contentType === 'application/pdf' ||
    contentType === 'application/json' ||
    contentType === 'text/markdown';

  // The final content to mint (processed if image, raw otherwise)
  const content = isImage && processedContent.length > 0 ? processedContent : rawContent;
  const finalMime = isImage && processedMime ? processedMime : contentType;

  // Auto-process image when raw content or options change
  useEffect(() => {
    if (!isImage || rawContent.length === 0) {
      setProcessedContent(new Uint8Array());
      setProcessedMime('');
      return;
    }

    let cancelled = false;
    setProcessing(true);
    processImage(rawContent, contentType, imgOpts)
      .then(result => {
        if (cancelled) return;
        setProcessedContent(result.data);
        setProcessedMime(result.mimeType);
      })
      .catch(() => {
        if (cancelled) return;
        // Fall back to raw content
        setProcessedContent(rawContent);
        setProcessedMime(contentType);
      })
      .finally(() => {
        if (!cancelled) setProcessing(false);
      });

    return () => { cancelled = true; };
  }, [rawContent, contentType, isImage, imgOpts]);

  // Auto-select CKBFS for large content
  useEffect(() => {
    if (content.length > 500_000 && storageMode === 'inline') {
      setStorageMode('ckbfs');
    }
  }, [content.length, storageMode]);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    if (file.name.endsWith('.md') || file.name.endsWith('.markdown')) {
      setContentType('text/markdown');
    } else if (file.type && MIME_OPTIONS.includes(file.type)) {
      setContentType(file.type);
    }
    file.arrayBuffer().then(buf => {
      setRawContent(new Uint8Array(buf));
    });
  }

  function handleTextChange(text: string) {
    setTextInput(text);
    setRawContent(new TextEncoder().encode(text));
  }

  const preview: MarketItem | null = content.length > 0
    ? { contentType: finalMime, description: description || '(no description)', content }
    : null;

  const canMint = signer && content.length > 0 && description.trim().length > 0 && finalMime.length > 0 && !processing && !walletBlocked;

  // Inline cost estimate
  const inlineCostCkb = Math.ceil(content.length * 2.2 / 100) + 300;
  const ckbfsCost = estimateCkbfsCost(content.length);

  async function handleMint() {
    if (!signer || !canMint || !walletLock) return;
    if (walletBlocked) {
      setTxState({ status: 'error', message: `This wallet is restricted from minting on CellSwap (${blockReason ?? 'see Rules'}).` });
      return;
    }
    try {
      const client = createClient();
      const mintFn = immutable ? buildImmutableMintTx : buildMintTx;

      if (storageMode === 'ckbfs') {
        // CKBFS flow: publish content to CKBFS, then mint MarketItem with URI reference.
        // The CKBFS publish tx is signed inside publishToCkbfs; cellswap owns the
        // tx-object path for the MINT tx below and can show its confirmation there.
        setTxState({ status: 'building', message: 'Publishing to CKBFS...' });
        const ckbfsResult = await publishToCkbfs(signer, content, finalMime, fileName || 'content');

        setTxState({ status: 'building', message: 'Building mint transaction...' });
        const uriBytes = new TextEncoder().encode(ckbfsResult.uri);
        const tx = await mintFn(signer, finalMime, description.trim(), uriBytes);
        const summary = await summarizeTx(tx, client, walletLock);

        setTxState({ status: 'idle' });
        setPendingSign({
          action: immutable ? 'Immutable Mint (via CKBFS)' : 'Mint (via CKBFS)',
          tx,
          summary,
          extraInfo: [
            { label: 'Content type', value: finalMime },
            { label: 'CKBFS URI', value: ckbfsResult.uri },
            { label: 'Description', value: description.trim() },
          ],
        });
      } else {
        setTxState({ status: 'building', message: 'Building mint transaction...' });
        const tx = await mintFn(signer, finalMime, description.trim(), content);
        const summary = await summarizeTx(tx, client, walletLock);

        setTxState({ status: 'idle' });
        setPendingSign({
          action: immutable ? 'Immutable Mint (inline)' : 'Mint (inline)',
          tx,
          summary,
          extraInfo: [
            { label: 'Content type', value: finalMime },
            { label: 'Content size', value: `${content.length} bytes` },
            { label: 'Description', value: description.trim() },
          ],
        });
      }
      return; // rest of flow continues in proceedSign when user confirms
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      const dbg = (window as unknown as { __CKBFS_DEBUG__?: string }).__CKBFS_DEBUG__;
      const full = dbg && !msg.includes('[') ? `${msg} [ckbfs:${dbg}]` : msg;
      setTxState({ status: 'error', message: full });
    }
  }

  async function proceedSign() {
    if (!signer || !pendingSign) return;
    const { tx } = pendingSign;
    setPendingSign(null);
    try {
      setTxState({ status: 'signing' });
      const txHash = await safeSendTransaction(signer, tx, (msg) => setTxState({ status: 'building', message: msg }));
      setTxState({ status: 'success', txHash });
      // Reset form on success
      setRawContent(new Uint8Array());
      setProcessedContent(new Uint8Array());
      setDescription('');
      setTextInput('');
      setFileName('');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setTxState({ status: 'error', message: msg });
    }
  }

  function cancelSign() {
    setPendingSign(null);
    setTxState({ status: 'idle' });
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '1.25rem' }}>Mint a Cell</h2>

      {!signer && (
        <div className="card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>
          Connect your wallet to mint
        </div>
      )}

      {signer && walletBlocked && (
        <div className="card" style={{ marginBottom: '1rem', border: '1px solid var(--danger, #c22)', background: 'rgba(192, 32, 32, 0.08)' }}>
          <div style={{ fontWeight: 600, marginBottom: '0.3rem' }}>This wallet is restricted from minting</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--muted)', lineHeight: 1.4, marginBottom: '0.5rem' }}>
            Reason: {blockReason ?? 'see the Rules page'}.
          </div>
          <div style={{ fontSize: '0.82rem' }}>
            See the <Link to="/rules">Rules</Link> page for the full policy and appeal process.
          </div>
        </div>
      )}

      {signer && !walletBlocked && (
        <div className="card" style={{ marginBottom: '1rem', fontSize: '0.82rem', color: 'var(--muted)', lineHeight: 1.45 }}>
          Cells are permanent on chain — you cannot delete them after minting. By minting you confirm the content does not violate the <Link to="/rules">Rules</Link>. CellSwap reserves the right to hide content and restrict wallets from this interface.
        </div>
      )}

      {signer && !walletBlocked && (
        <>
          <div className="card" style={{ marginBottom: '1rem' }}>
            {/* Content type */}
            <div className="form-group">
              <label className="form-label">Content Type</label>
              <select className="form-select" value={contentType} onChange={e => setContentType(e.target.value)}>
                {MIME_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            {/* Description */}
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

            {/* Content input */}
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
                      if (file.name.endsWith('.md') || file.name.endsWith('.markdown')) {
                        setContentType('text/markdown');
                      } else if (file.type && MIME_OPTIONS.includes(file.type)) {
                        setContentType(file.type);
                      }
                      file.arrayBuffer().then(buf => setRawContent(new Uint8Array(buf)));
                    }
                  }}
                >
                  {fileName ? (
                    <span style={{ color: 'var(--accent)' }}>{fileName} ({formatBytes(rawContent.length)})</span>
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
          </div>

          {/* Image optimization controls */}
          {isImage && rawContent.length > 0 && (
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent)', marginBottom: '0.75rem' }}>
                Image Optimization
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Max Size (px)</label>
                  <select className="form-select" value={imgOpts.maxDimension}
                    onChange={e => setImgOpts({ ...imgOpts, maxDimension: Number(e.target.value) })}>
                    <option value={256}>256</option>
                    <option value={512}>512</option>
                    <option value={1024}>1024</option>
                    <option value={2048}>2048</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Format</label>
                  <select className="form-select" value={imgOpts.format}
                    onChange={e => setImgOpts({ ...imgOpts, format: e.target.value as ImageProcessOptions['format'] })}>
                    <option value="jpeg">JPEG</option>
                    <option value="webp">WebP</option>
                    <option value="png">PNG</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Quality ({Math.round(imgOpts.quality * 100)}%)</label>
                  <input type="range" min="0.3" max="1.0" step="0.05" value={imgOpts.quality}
                    onChange={e => setImgOpts({ ...imgOpts, quality: Number(e.target.value) })}
                    style={{ width: '100%', accentColor: 'var(--accent)' }} />
                </div>
              </div>

              {/* Before/after comparison */}
              {processing && (
                <div style={{ marginTop: '0.75rem', fontSize: '0.82rem', color: 'var(--muted)' }}>Processing...</div>
              )}
              {!processing && processedContent.length > 0 && (
                <div style={{
                  marginTop: '0.75rem', display: 'flex', gap: '1.5rem',
                  fontSize: '0.82rem', color: 'var(--muted)',
                }}>
                  <div>
                    <span style={{ color: 'var(--red)' }}>Original:</span> {formatBytes(rawContent.length)}
                  </div>
                  <div>
                    <span style={{ color: 'var(--green)' }}>Optimized:</span> {formatBytes(processedContent.length)}
                  </div>
                  <div>
                    Saved: {((1 - processedContent.length / rawContent.length) * 100).toFixed(0)}%
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Storage mode selector */}
          {content.length > 0 && (
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '0.75rem' }}>
                Storage
              </div>
              <div className="view-toggle" style={{ marginBottom: '0.75rem' }}>
                <button className={storageMode === 'inline' ? 'active' : ''} onClick={() => setStorageMode('inline')}>
                  Inline
                </button>
                <button className={storageMode === 'ckbfs' ? 'active' : ''} onClick={() => setStorageMode('ckbfs')}>
                  CKBFS
                </button>
              </div>

              {storageMode === 'inline' && (
                <div style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
                  <div>Data: {formatBytes(content.length)} stored directly in cell</div>
                  <div>Estimated cost: <span className="price">~{inlineCostCkb} CKB</span></div>
                  {content.length > 50_000 && (
                    <div style={{ color: 'var(--red)', marginTop: '0.4rem' }}>
                      Large file — consider using CKBFS for cheaper storage
                    </div>
                  )}
                </div>
              )}

              {storageMode === 'ckbfs' && (
                <div style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
                  <div>Data: {formatBytes(content.length)} stored in witnesses (prunable)</div>
                  <div>Index cell: <span className="price">~{ckbfsCost.indexCellCkb} CKB</span> (locked)</div>
                  <div style={{ color: 'var(--green)', marginTop: '0.3rem' }}>{ckbfsCost.note}</div>
                </div>
              )}
            </div>
          )}

          {/* Ownership mode */}
          {content.length > 0 && (
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '0.75rem' }}>
                Ownership
              </div>
              <div className="view-toggle" style={{ marginBottom: '0.75rem' }}>
                <button className={!immutable ? 'active' : ''} onClick={() => setImmutable(false)}>
                  Normal
                </button>
                <button
                  className={immutable ? 'active' : ''}
                  onClick={() => setImmutable(true)}
                  style={immutable ? { background: 'rgba(255, 69, 96, 0.15)', color: 'var(--red)', borderColor: 'var(--red)' } : {}}
                >
                  Permanent
                </button>
              </div>

              {!immutable && (
                <div style={{ fontSize: '0.82rem', color: 'var(--muted)', lineHeight: 1.6 }}>
                  <div>Content is <strong style={{ color: 'var(--green)' }}>immutable</strong> — enforced by the type script on-chain</div>
                  <div>You own the cell and can list it for sale, transfer it, or burn it</div>
                </div>
              )}

              {immutable && (
                <div style={{
                  padding: '0.75rem',
                  background: 'rgba(255, 69, 96, 0.08)',
                  border: '1px solid rgba(255, 69, 96, 0.25)',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  lineHeight: 1.6,
                  color: 'var(--red)',
                }}>
                  <strong>Permanent — no owner, no recovery.</strong>
                  <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.2rem' }}>
                    <li>Content is immutable (same as Normal)</li>
                    <li>The cell has <strong>no owner</strong> — it cannot be transferred, sold, or destroyed</li>
                    <li>The CKB capacity locked in this cell is gone forever</li>
                    <li>Ideal for reference documents, protocol specs, and shared knowledge</li>
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Preview */}
          {preview && !processing && (
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '0.75rem' }}>Preview</div>
              <ContentRenderer item={preview} mode="full" />
            </div>
          )}

          {/* Mint button */}
          <button
            className={`btn ${immutable ? 'btn-danger' : 'btn-primary'}`}
            disabled={!canMint}
            onClick={handleMint}
            style={{ width: '100%', padding: '0.8rem', fontSize: '1rem' }}
          >
            {immutable
              ? 'Mint Immutable Cell (Permanent)'
              : storageMode === 'ckbfs' ? 'Publish to CKBFS + Mint' : 'Mint Cell'}
          </button>

          {!canMint && signer && (
            <div style={{ textAlign: 'center', fontSize: '0.82rem', color: 'var(--muted)', marginTop: '0.5rem' }}>
              {processing ? 'Processing image...' : ''}
              {!processing && !description.trim() && 'Add a description'}
              {!processing && !description.trim() && content.length === 0 && ' and '}
              {!processing && content.length === 0 && 'add content'}
            </div>
          )}
        </>
      )}

      <TxStatus state={txState} onClose={() => setTxState({ status: 'idle' })} />

      {pendingSign && walletLock && (
        <TxConfirmModal
          action={pendingSign.action}
          summary={pendingSign.summary}
          userLock={walletLock}
          extraInfo={pendingSign.extraInfo}
          onConfirm={proceedSign}
          onCancel={cancelSign}
        />
      )}
    </div>
  );
}
