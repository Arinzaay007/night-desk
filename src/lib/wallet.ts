'use client';

import { privateKeyToAccount } from 'viem/accounts';
import { BASE_CHAIN } from './assets';

/**
 * Two signing modes, one interface.
 *
 *  - `injected`  : a real browser wallet (MetaMask, Rabby, …). Used for the
 *                  wallet that signs setup transactions and typed data.
 *  - `local`     : a throwaway key kept in localStorage, for the second wallet
 *                  in a two-wallet demo. It never leaves the browser — the
 *                  server only ever receives signed material.
 *
 * Both modes sign in the browser. The Flash API key never leaves the server.
 */

export interface Signer {
  mode: 'injected' | 'local';
  address: `0x${string}`;
  /** Signs an EIP-712 payload that Flash returned as a JSON string. */
  signTypedData(typedDataJson: string): Promise<`0x${string}`>;
  /** EIP-191 personal_sign over a plaintext message (used for cancels). */
  signMessage(message: string): Promise<`0x${string}`>;
  sendTransaction(tx: { to: string; data: string; value?: string }): Promise<string>;
}

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

export function injectedProvider(): Eip1193Provider | null {
  if (typeof window === 'undefined') return null;
  const eth = (window as unknown as { ethereum?: Eip1193Provider }).ethereum;
  return eth ?? null;
}

export const hasInjectedWallet = (): boolean => injectedProvider() !== null;

export async function ensureBaseChain(eth: Eip1193Provider): Promise<void> {
  const chainId = (await eth.request({ method: 'eth_chainId' })) as string;
  if (chainId?.toLowerCase() === BASE_CHAIN.hexId) return;
  try {
    await eth.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: BASE_CHAIN.hexId }],
    });
  } catch {
    throw new Error('Switch your wallet to Base to continue.');
  }
}

export async function connectInjected(): Promise<`0x${string}`> {
  const eth = injectedProvider();
  if (!eth) throw new Error('No browser wallet found. Install MetaMask or Rabby, or use a local key.');
  const accounts = (await eth.request({ method: 'eth_requestAccounts' })) as string[];
  if (!accounts?.length) throw new Error('Wallet connection was rejected.');
  await ensureBaseChain(eth);
  return accounts[0] as `0x${string}`;
}

export function injectedSigner(address: `0x${string}`): Signer {
  const eth = injectedProvider();
  if (!eth) throw new Error('No browser wallet found.');

  return {
    mode: 'injected',
    address,
    async signTypedData(typedDataJson: string) {
      // eth_signTypedData_v4 expects the payload *with* EIP712Domain in types,
      // which is exactly what Flash returns.
      const signature = (await eth.request({
        method: 'eth_signTypedData_v4',
        params: [address, typedDataJson],
      })) as string;
      return signature as `0x${string}`;
    },
    async signMessage(message: string) {
      // personal_sign takes the message as hex. Wallets render the decoded
      // plaintext, which is the point: the user sees which order they cancel.
      const hex = `0x${Array.from(new TextEncoder().encode(message))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')}`;
      const signature = (await eth.request({
        method: 'personal_sign',
        params: [hex, address],
      })) as string;
      return signature as `0x${string}`;
    },
    async sendTransaction({ to, data, value }) {
      const hash = (await eth.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: address,
            to,
            data,
            ...(value && value !== '0' ? { value: `0x${BigInt(value).toString(16)}` } : {}),
          },
        ],
      })) as string;
      return hash;
    },
  };
}

const LOCAL_KEY_STORAGE = 'nightdesk.localKey';

export const readLocalKey = (): string | null => {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(LOCAL_KEY_STORAGE);
};

export const writeLocalKey = (key: string | null): void => {
  if (typeof window === 'undefined') return;
  if (key) window.localStorage.setItem(LOCAL_KEY_STORAGE, key);
  else window.localStorage.removeItem(LOCAL_KEY_STORAGE);
};

export function localSigner(rawKey: string): Signer {
  const trimmed = rawKey.trim();
  const normalised = (trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`) as `0x${string}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalised)) {
    throw new Error('That does not look like a 32-byte private key.');
  }
  const account = privateKeyToAccount(normalised);

  return {
    mode: 'local',
    address: account.address,
    async signMessage(message: string) {
      return account.signMessage({ message });
    },
    async signTypedData(typedDataJson: string) {
      const payload = JSON.parse(typedDataJson) as {
        domain: Record<string, unknown>;
        types: Record<string, unknown>;
        primaryType: string;
        message: Record<string, unknown>;
      };
      // viem wants the struct types without EIP712Domain.
      const { EIP712Domain: _ignored, ...types } = payload.types;
      return account.signTypedData({
        domain: { ...payload.domain, chainId: Number(payload.domain.chainId) },
        types,
        primaryType: payload.primaryType,
        message: payload.message,
      } as Parameters<typeof account.signTypedData>[0]);
    },
    async sendTransaction({ to, data, value }) {
      // The server builds nonce/gas (it has an RPC), the key signs here, the
      // signed transaction goes back to the server to broadcast.
      const prepared = (await fetch('/api/setup-tx', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ stage: 'prepare', from: account.address, to, data, value }),
      }).then(r => r.json())) as { ok?: boolean; error?: string; tx?: Record<string, unknown> };

      if (!prepared.ok || !prepared.tx) throw new Error(prepared.error ?? 'Could not prepare transaction.');

      const signed = await account.signTransaction(
        prepared.tx as Parameters<typeof account.signTransaction>[0],
      );

      const broadcast = (await fetch('/api/setup-tx', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ stage: 'broadcast', rawTransaction: signed }),
      }).then(r => r.json())) as { ok?: boolean; error?: string; hash?: string };

      if (!broadcast.ok || !broadcast.hash) throw new Error(broadcast.error ?? 'Broadcast failed.');
      return broadcast.hash;
    },
  };
}
