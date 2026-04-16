import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCcc, ccc } from '@ckb-ccc/connector-react';
import { ContentRenderer } from './ContentRenderer';
import { ReportButton } from './ReportButton';
import { TxStatus } from './TxStatus';
import { createClient, fetchCell } from '../lib/indexer';
import { decodeMarketItem, decodeLsdlArgs, shannonsToCkb } from '../lib/codec';
import { categoriseContent, categoryLabel, badgeClass, shortAddress } from '../lib/content';
import { buildBuyTx, buildCancelTx } from '../lib/transactions';
import { safeSendTransaction } from '../lib/tx-send';
import { summarizeTx, type TxSummary } from '../lib/tx-summary';
import { recordView } from '../lib/analytics';
import { TxConfirmModal } from './TxConfirmModal';
import { LSDL } from '../config';
import type { TxState, MarketItem, DecodedLsdlArgs } from '../types';

export function ItemDetail() {
  const { outpoint } = useParams<{ outpoint: string }>();
  const navigate = useNavigate();
  const { signerInfo } = useCcc();
  const signer = signerInfo?.signer;

  const [cell, setCell] = useState<ccc.Cell | null>(null);
  const [marketItem, setMarketItem] = useState<MarketItem | null>(null);
  const [lsdlArgs, setLsdlArgs] = useState<DecodedLsdlArgs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [txState, setTxState] = useState<TxState>({ status: 'idle' });
  const [userLock, setUserLock] = useState<ccc.Script | null>(null);
  const [pendingSign, setPendingSign] = useState<null | {
    action: string;
    tx: ccc.Transaction;
    summary: TxSummary;
    extraInfo: { label: string; value: string }[];
  }>(null);

  // Resolve user lock
  useEffect(() => {
    if (!signer) { setUserLock(null); return; }
    signer.getRecommendedAddressObj().then(a => setUserLock(a.script)).catch(() => setUserLock(null));
  }, [signer]);

  // Fetch cell data
  useEffect(() => {
    if (!outpoint) return;
    const decoded = decodeURIComponent(outpoint);
    const [txHash, indexStr] = decoded.split(':');
    const index = parseInt(indexStr, 10);

    setLoading(true);
    const client = createClient();
    fetchCell(client, { txHash, index }).then(c => {
      if (!c) { setError('Cell not found — it may have been purchased or cancelled.'); return; }
      setCell(c);
      // Fire-and-forget view record. No await — never block the UI render.
      void recordView(c.outPoint);

      const dataBytes = ccc.bytesFrom(c.outputData);
      setMarketItem(decodeMarketItem(dataBytes));

      // Check if this is an LSDL-locked cell
      const lockCodeHash = ccc.hexFrom(c.cellOutput.lock.codeHash);
      if (lockCodeHash === LSDL.DATA_HASH) {
        setLsdlArgs(decodeLsdlArgs(ccc.hexFrom(c.cellOutput.lock.args)));
      }
    }).catch(e => {
      setError(e instanceof Error ? e.message : String(e));
    }).finally(() => setLoading(false));
  }, [outpoint]);

  const isOwner = userLock && lsdlArgs && lsdlArgs.ownerLock.eq(userLock);
  const isListed = lsdlArgs !== null;

  async function handleBuy() {
    if (!signer || !cell || !userLock) return;
    try {
      setTxState({ status: 'building', message: 'Constructing purchase transaction...' });
      const tx = await buildBuyTx(signer, cell);
      const client = createClient();
      const summary = await summarizeTx(tx, client, userLock);
      setTxState({ status: 'idle' });
      setPendingSign({
        action: 'Buy Cell',
        tx,
        summary,
        extraInfo: lsdlArgs
          ? [
              { label: 'Listing price', value: `${(Number(lsdlArgs.totalValue) / 1e8).toFixed(8)} CKB` },
              { label: 'Royalty', value: `${(lsdlArgs.royaltyBps / 100).toFixed(1)}%` },
              { label: 'Content type', value: marketItem?.contentType ?? '' },
            ]
          : [],
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setTxState({ status: 'error', message: msg });
    }
  }

  async function handleCancel() {
    if (!signer || !cell || !userLock) return;
    try {
      setTxState({ status: 'building', message: 'Constructing cancel transaction...' });
      const tx = await buildCancelTx(signer, cell);
      const client = createClient();
      const summary = await summarizeTx(tx, client, userLock);
      setTxState({ status: 'idle' });
      setPendingSign({
        action: 'Cancel Listing',
        tx,
        summary,
        extraInfo: [
          { label: 'Content type', value: marketItem?.contentType ?? '' },
          { label: 'Returns to', value: 'your wallet' },
        ],
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setTxState({ status: 'error', message: msg });
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
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setTxState({ status: 'error', message: msg });
    }
  }

  function cancelSign() {
    setPendingSign(null);
    setTxState({ status: 'idle' });
  }

  if (loading) {
    return <div className="empty-state"><div className="tx-protocol-text">Inspecting cell...</div></div>;
  }

  if (error || !marketItem) {
    return (
      <div className="empty-state">
        <h3>Cell not found</h3>
        <p>{error || 'This cell may have been purchased or cancelled.'}</p>
        <button className="btn btn-ghost" onClick={() => navigate('/browse')} style={{ marginTop: '1rem' }}>
          Back to Browse
        </button>
      </div>
    );
  }

  const category = categoriseContent(marketItem.contentType);

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto' }}>
      <button className="btn btn-ghost" onClick={() => navigate(-1)} style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
        &larr; Back
      </button>

      <div className="content-glow" style={{ marginBottom: '1.25rem' }}>
        <ContentRenderer item={marketItem} mode="full" />
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
          <div>
            <span className={badgeClass(category)} style={{ marginRight: '0.5rem' }}>
              {categoryLabel(marketItem.contentType)}
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{marketItem.contentType}</span>
          </div>
          {isListed && lsdlArgs && (
            <span className="price" style={{ fontSize: '1.2rem' }}>{shannonsToCkb(lsdlArgs.totalValue)} CKB</span>
          )}
        </div>

        <p style={{ fontSize: '0.95rem', lineHeight: 1.5, marginBottom: '1rem' }}>{marketItem.description}</p>

        {isListed && lsdlArgs && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.82rem' }}>
            <div style={{ color: 'var(--muted)' }}>Seller</div>
            <div><code className="mono">{shortAddress(ccc.hexFrom(lsdlArgs.ownerLock.args))}</code></div>
            <div style={{ color: 'var(--muted)' }}>Royalty</div>
            <div>{(lsdlArgs.royaltyBps / 100).toFixed(1)}%</div>
            <div style={{ color: 'var(--muted)' }}>Expiry</div>
            <div>{lsdlArgs.expiryEpoch === 0n ? 'Permanent' : `Epoch ${lsdlArgs.expiryEpoch.toString()}`}</div>
            <div style={{ color: 'var(--muted)' }}>Data size</div>
            <div>{marketItem.content.length} bytes</div>
          </div>
        )}
      </div>

      {isListed && lsdlArgs?.isLegacy && (
        <div className="card" style={{ marginBottom: '1rem', border: '1px solid var(--warning, #a86a00)', background: 'rgba(168, 106, 0, 0.08)' }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.25rem' }}>* Locked legacy script</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--muted)', lineHeight: 1.4 }}>
            This listing was encoded before the args layout was corrected. The LSDL contract rejects it at spend time, so it cannot be bought or cancelled. The capacity is permanently locked.
          </div>
        </div>
      )}

      {isListed && signer && !isOwner && !lsdlArgs?.isLegacy && (
        <button className="btn btn-buy" onClick={handleBuy} style={{ width: '100%', padding: '0.8rem', fontSize: '1rem' }}>
          Buy for {shannonsToCkb(lsdlArgs!.totalValue)} CKB
        </button>
      )}
      {isListed && signer && isOwner && !lsdlArgs?.isLegacy && (
        <button className="btn btn-danger" onClick={handleCancel} style={{ width: '100%', padding: '0.8rem' }}>
          Cancel Listing
        </button>
      )}
      {isListed && !signer && (
        <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '1rem', fontSize: '0.9rem' }}>
          Connect your wallet to buy this cell
        </div>
      )}

      <TxStatus state={txState} onClose={() => setTxState({ status: 'idle' })} />

      {cell && (
        <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'center' }}>
          <ReportButton
            outPoint={cell.outPoint}
            creatorLockHash={lsdlArgs ? ccc.hexFrom(lsdlArgs.creatorLockHash) : undefined}
            contentType={marketItem.contentType}
            description={marketItem.description}
          />
        </div>
      )}

      {pendingSign && userLock && (
        <TxConfirmModal
          action={pendingSign.action}
          summary={pendingSign.summary}
          userLock={userLock}
          extraInfo={pendingSign.extraInfo}
          onConfirm={proceedSign}
          onCancel={cancelSign}
        />
      )}
    </div>
  );
}
