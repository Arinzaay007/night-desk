'use client';

import { WalletContext, useWalletState } from '@/lib/useWallet';

/**
 * One wallet for the whole app.
 *
 * The wallet used to be per-component state, which meant the header, the compose
 * page and the plan page each had their own private and disconnected copy. The
 * visible symptom was a header that kept saying "Connect wallet" over a page
 * that was already connected — and the same class of bug would have shown up as
 * a balance that never refreshed on one screen after a trade on another.
 *
 * Mounted once, in the root layout, above the header and every route.
 */
export function WalletProvider({ children }: { children: React.ReactNode }) {
  const wallet = useWalletState();
  return <WalletContext.Provider value={wallet}>{children}</WalletContext.Provider>;
}
