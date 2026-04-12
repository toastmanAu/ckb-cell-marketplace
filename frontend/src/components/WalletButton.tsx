import { useCcc, ccc } from '@ckb-ccc/connector-react';
import { useState, useEffect } from 'react';

export function WalletButton() {
  const { signerInfo, open, setClient, disconnect } = useCcc();
  const signer = signerInfo?.signer;
  const [address, setAddress] = useState('');

  useEffect(() => {
    setClient(new ccc.ClientPublicTestnet());
  }, [setClient]);

  useEffect(() => {
    if (!signer) { setAddress(''); return; }
    signer.getRecommendedAddress().then(setAddress).catch(() => setAddress(''));
  }, [signer]);

  if (signer && address) {
    const short = `${address.slice(0, 10)}...${address.slice(-6)}`;
    return (
      <button className="wallet-btn" onClick={disconnect} title={address}>
        <span className="wallet-dot" />
        <code>{short}</code>
      </button>
    );
  }

  return (
    <button className="btn btn-primary" onClick={open}>
      Connect Wallet
    </button>
  );
}
