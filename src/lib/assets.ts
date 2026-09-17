/**
 * Base chain only, on purpose: one chain keeps the settlement path simple and
 * all seven tokenized equities below are liquid on Base.
 */

export const BASE_CHAIN = {
  id: 8453,
  hexId: '0x2105',
  slug: 'base',
  name: 'Base',
  rpc: process.env.BASE_RPC_URL ?? 'https://mainnet.base.org',
} as const;

export const USDC = {
  address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
  symbol: 'USDC',
  decimals: 6,
} as const;

export interface Equity {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
}

/**
 * Tokenized equities verified live on Flash (Base). Liquidity/volume figures
 * captured 2026-09-16 to help pick a demoable asset — the liquid ones matter
 * when you're trading $25 on camera.
 */
export const EQUITIES: Equity[] = [
  { symbol: 'NVDAc', name: 'NVIDIA', address: '0xb20000000000000000000078ee7ce2fe4908108c', decimals: 8 },
  { symbol: 'METAc', name: 'Meta Platforms', address: '0xb2000000000000000000008bc8786b856e61707c', decimals: 8 },
  { symbol: 'GOOGLc', name: 'Alphabet', address: '0xb2000000000000000000002d0ba3164cc74f58b7', decimals: 8 },
  { symbol: 'AAPLc', name: 'Apple', address: '0xb200000000000000000000C2e324d24d7eEcd1fb', decimals: 8 },
  { symbol: 'TSLAc', name: 'Tesla', address: '0xb2000000000000000000001e800a7f5189430cd0', decimals: 8 },
  { symbol: 'AMZNc', name: 'Amazon', address: '0xb200000000000000000000d9192b6b456483c2e8', decimals: 8 },
  { symbol: 'MSFTc', name: 'Microsoft', address: '0xb200000000000000000000ab99cfa739e253872b', decimals: 8 },
];

export const findEquity = (symbolOrAddress: string): Equity | undefined => {
  const needle = symbolOrAddress.toLowerCase();
  return EQUITIES.find(
    e => e.symbol.toLowerCase() === needle || e.address.toLowerCase() === needle,
  );
};

/**
 * Guard rails: demo trades are small, but never let a fat finger through.
 *
 * MIN_SPEND_USD is a policy floor we chose, not one Flash imposes. The API
 * itself will quote a bracket as small as ~$0.03 (measured — see TESTING.md).
 *
 * But small is not free, because every quote carries a roughly fixed
 * ~$0.025-0.03 of network/route cost baked into estimatedFeeNotional:
 *
 *     $0.50  ->  6.6% of the trade
 *     $1.00  ->  3.9%
 *     $2.50  ->  1.7%
 *     $5.00  ->  0.88%
 *     $25.00 ->  0.26%
 *
 * So the floor sits at $1: cheap enough to be a genuine throwaway smoke test,
 * high enough that fixed costs do not eat the trade. Lower it in .env.local if
 * you only care about the mechanics and not the economics.
 */
export const MIN_SPEND_USD = Number(process.env.MIN_SPEND_USD ?? 1);
export const MAX_SPEND_USD = Number(process.env.MAX_SPEND_USD ?? 250);

/**
 * The floor actually in force. Setting MAX below MIN is how you force tiny
 * test trades, so the refusal guard must respect the lower of the two.
 */
export const effectiveMinSpend = (): number => Math.min(MIN_SPEND_USD, MAX_SPEND_USD);
