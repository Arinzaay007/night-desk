'use client';

import { useState } from 'react';
import { shortAddress, usd } from '@/lib/format';
import type { WalletState } from '@/lib/useWallet';

/**
 * Wallet connection. Two modes, because a two-wallet demo needs both:
 * an injected wallet for a real key you control, and a local throwaway key so
 * the second wallet needs no extension or profile switching.
 */
export function WalletBar({ wallet }: { wallet: WalletState }) {
  const [showKey, setShowKey] = useState(false);
  const [keyDraft, setKeyDraft] = useState('');

  if (wallet.address) {
    const lowGas = wallet.balance !== null && wallet.balance.eth < 0.0002;
    return (
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <span className="pill accent">
          <span className="dot" />
          {wallet.signer?.mode === 'local' ? 'local key' : 'wallet'}
        </span>
        {wallet.balance && (
          <span className="pill" title="USDC available on Base">
            {usd(wallet.balance.usdc)} USDC
          </span>
        )}
        {lowGas && (
          <span className="pill bad" title="Approvals need a little ETH on Base for gas">
            low gas
          </span>
        )}
        <span className="pill mono" title={wallet.address}>
          {shortAddress(wallet.address, 5)}
        </span>
        <button className="button ghost small" onClick={wallet.disconnect}>
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="row" style={{ justifyContent: 'flex-end' }}>
      {wallet.error && <span className="error-text">{wallet.error}</span>}
      {showKey ? (
        <>
          <input
            className="input mono"
            style={{ maxWidth: 320 }}
            placeholder="0x private key (throwaway only)"
            value={keyDraft}
            onChange={e => setKeyDraft(e.target.value)}
            spellCheck={false}
          />
          <button
            className="button small"
            disabled={wallet.connecting || keyDraft.length < 66}
            onClick={() => wallet.connectLocal(keyDraft)}
          >
            Use local key
          </button>
          <button className="button ghost small" onClick={() => setShowKey(false)}>
            Cancel
          </button>
        </>
      ) : (
        <>
          <button className="button small" disabled={wallet.connecting} onClick={wallet.connectInjected}>
            {wallet.connecting ? 'Connecting…' : 'Connect wallet'}
          </button>
          <button className="button ghost small" onClick={() => setShowKey(true)}>
            Use local key
          </button>
        </>
      )}
    </div>
  );
}

export function LocalKeyWarning() {
  return (
    <p className="tiny dim" style={{ marginTop: 6 }}>
      A local key stays in this browser and signs here — the server only ever sees signed material.
      Only ever use a throwaway key with a small balance.
    </p>
  );
}
