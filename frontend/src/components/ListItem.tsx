import { useState } from 'react';
import { useCcc } from '@ckb-ccc/connector-react';
import { TxStatus } from './TxStatus';
import { buildListTx } from '../lib/transactions';
import { createClient, fetchCell } from '../lib/indexer';
import { ckbToShannons } from '../lib/codec';
import { EXPLORER_URL } from '../config';
import type { OwnedItem, TxState } from '../types';

interface ListItemProps {
  item: OwnedItem;
  onListed: () => void;
  onCancel: () => void;
}

export function ListItem({ item, onListed, onCancel }: ListItemProps) {
  const { signerInfo } = useCcc();
  const signer = signerInfo?.signer;

  const [price, setPrice] = useState('');
  const [royalty, setRoyalty] = useState('5');
  const [expiry, setExpiry] = useState('0');
  const [txState, setTxState] = useState<TxState>({ status: 'idle' });

  const priceValid = price.trim().length > 0 && !isNaN(Number(price)) && Number(price) > 0;
  const royaltyBps = Math.round(Number(royalty) * 100);
  const canList = signer && priceValid && royaltyBps >= 0 && royaltyBps <= 10000;

  async function handleList() {
    if (!signer || !canList) return;
    try {
      setTxState({ status: 'building', message: 'Fetching cell data...' });
      const client = createClient();
      const cell = await fetchCell(client, item.outPoint);
      if (!cell) { setTxState({ status: 'error', message: 'Cell not found on-chain' }); return; }

      setTxState({ status: 'building', message: 'Constructing listing transaction...' });
      const tx = await buildListTx(
        signer,
        item.outPoint,
        cell.outputData,
        item.capacity,
        ckbToShannons(price),
        royaltyBps,
        BigInt(expiry),
      );
      setTxState({ status: 'signing' });
      const txHash = await signer.sendTransaction(tx);
      setTxState({ status: 'confirming', txHash });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setTxState({ status: 'error', message: msg });
    }
  }

  // Listed confirmation banner — shown after TX is broadcast
  if (txState.status === 'confirming' || txState.status === 'success') {
    const txHash = txState.status === 'confirming' ? txState.txHash : txState.txHash;
    return (
      <div className="card" style={{ marginTop: '0.75rem', border: '1px solid var(--purple)', textAlign: 'center', padding: '1.5rem' }}>
        <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>&#x2713;</div>
        <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--purple)', marginBottom: '0.5rem' }}>
          Listed for {price} CKB
        </div>
        <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: '0.75rem' }}>
          Transaction broadcast — awaiting on-chain confirmation.
          <br />Your item will appear in the marketplace shortly.
        </div>
        <div className="tx-protocol-text" style={{ marginTop: 0, marginBottom: '0.75rem', fontSize: '0.7rem' }}>
          Cell Swap Protocol In Progress
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
          <a
            href={`${EXPLORER_URL}/transaction/${txHash}`}
            target="_blank"
            rel="noreferrer"
            className="btn btn-ghost"
            style={{ fontSize: '0.82rem', textDecoration: 'none' }}
          >
            View on Explorer
          </a>
          <button
            className="btn btn-primary"
            style={{ fontSize: '0.82rem' }}
            onClick={() => { setTxState({ status: 'idle' }); onListed(); }}
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ marginTop: '0.75rem', border: '1px solid var(--purple)' }}>
      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--purple)', marginBottom: '0.75rem' }}>
        List for Sale
      </div>

      <div className="form-group">
        <label className="form-label">Price (CKB)</label>
        <input
          className="form-input"
          type="text"
          value={price}
          onChange={e => setPrice(e.target.value)}
          placeholder="e.g. 500"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div className="form-group">
          <label className="form-label">Royalty %</label>
          <input
            className="form-input"
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={royalty}
            onChange={e => setRoyalty(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Expiry Epoch (0 = permanent)</label>
          <input
            className="form-input"
            type="number"
            min="0"
            value={expiry}
            onChange={e => setExpiry(e.target.value)}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button className="btn btn-primary" disabled={!canList} onClick={handleList} style={{ flex: 1 }}>
          List for {priceValid ? price : '...'} CKB
        </button>
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
      </div>

      <TxStatus state={txState} onClose={() => setTxState({ status: 'idle' })} />
    </div>
  );
}
