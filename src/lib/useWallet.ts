'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  connectInjected,
  hasInjectedWallet,
  injectedProvider,
  injectedSigner,
  localSigner,
  readLocalKey,
  writeLocalKey,
  type Signer,
} from '@/lib/wallet';

const MODE_KEY = 'nightdesk.mode';

export interface WalletState {
  signer: Signer | null;
  address: string | null;
  balance: { usdc: number; eth: number } | null;
  connecting: boolean;
  error: string | null;
  connectInjected: () => Promise<void>;
  connectLocal: (privateKey: string) => Promise<void>;
  disconnect: () => void;
  refreshBalance: () => Promise<void>;
}

export const WalletContext = createContext<WalletState | null>(null);

/**
 * The wallet's actual state machine. Instantiated exactly once, by
 * <WalletProvider> — this is deliberately not exported under the name
 * `useWallet`, because calling it from two components gives two independent
 * wallets. That was the bug: the header held its own disconnected state while
 * the page below it was connected.
 */
export function useWalletState(): WalletState {
  const [signer, setSigner] = useState<Signer | null>(null);
  const [balance, setBalance] = useState<{ usdc: number; eth: number } | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshBalance = useCallback(async () => {
    const address = signer?.address;
    if (!address) {
      setBalance(null);
      return;
    }
    try {
      const response = await fetch(`/api/balance?address=${address}`);
      const payload = (await response.json()) as { ok?: boolean; usdc?: number; eth?: number };
      if (payload.ok) setBalance({ usdc: payload.usdc ?? 0, eth: payload.eth ?? 0 });
    } catch {
      /* balance is advisory; a failure must not block a trade */
    }
  }, [signer]);

  // Restore a previous session. Runs after mount so SSR markup stays stable.
  useEffect(() => {
    const mode = window.localStorage.getItem(MODE_KEY);
    if (mode === 'local') {
      const key = readLocalKey();
      if (key) {
        try {
          setSigner(localSigner(key));
        } catch {
          writeLocalKey(null);
        }
      }
    } else if (mode === 'injected' && hasInjectedWallet()) {
      const eth = injectedProvider();
      eth
        ?.request({ method: 'eth_accounts' })
        .then(accounts => {
          const list = accounts as string[];
          if (list?.length) setSigner(injectedSigner(list[0] as `0x${string}`));
        })
        .catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (signer) void refreshBalance();
    else setBalance(null);
  }, [signer, refreshBalance]);

  const connectInjectedWallet = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      const address = await connectInjected();
      setSigner(injectedSigner(address));
      window.localStorage.setItem(MODE_KEY, 'injected');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not connect.');
    } finally {
      setConnecting(false);
    }
  }, []);

  const connectLocal = useCallback(async (privateKey: string) => {
    setConnecting(true);
    setError(null);
    try {
      const next = localSigner(privateKey);
      writeLocalKey(privateKey);
      window.localStorage.setItem(MODE_KEY, 'local');
      setSigner(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not use that key.');
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    writeLocalKey(null);
    window.localStorage.removeItem(MODE_KEY);
    setSigner(null);
    setBalance(null);
  }, []);

  return {
    signer,
    address: signer?.address ?? null,
    balance,
    connecting,
    error,
    connectInjected: connectInjectedWallet,
    connectLocal,
    disconnect,
    refreshBalance,
  };
}

/**
 * Read the one wallet. Every caller — the header, the plan page, the mirror
 * form — sees the same connection, the same address and the same balance.
 *
 * Throws rather than quietly falling back to a private instance, because a
 * fallback is exactly the failure this replaced: a component that connects
 * fine and a header that never notices.
 */
export function useWallet(): WalletState {
  const wallet = useContext(WalletContext);
  if (!wallet) {
    throw new Error('useWallet() must be called beneath <WalletProvider>. See src/components/WalletProvider.tsx.');
  }
  return wallet;
}
