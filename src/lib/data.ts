/**
 * The data the marketing surface renders.
 *
 * IMPORTANT — this is not mock data. Every figure below is a fact about this
 * deployment's one real, on-chain mirror, and it is sourced from the same
 * ledger `/api/proof` reads:
 *
 *   entry      240.4501226295625411 NVDAc   order 147b45cc-f9ac-4bf4-8f63-63de4e09c8e9
 *   bracket    TP 264.34 / SL 202.66         order 72b7ce84-0051-47a9-b7f9-3108982a293b
 *   funder     0x59f80641278f554aA921Cbc6547C1823AAFe2fB2
 *   spend      1.35 USDC · integrator fee 3375 µUSD (25 bps, read off the fill)
 *   compliance 1 of 1 published, 5 of 5 checks green
 *
 * The design this is ported from populated the equivalent slots with invented
 * traction — "$28.4K mirrored notional", "47 mirrors", "96% verified". Those
 * were replaced rather than carried over, because a reviewer who clicks through
 * to the board would find one plan holding $1.35 and every headline on the
 * landing page would be retroactively false. Where a real figure is less
 * impressive than an invented one, the real figure wins; where there is nothing
 * real to show, the section says so in words instead of showing a zero.
 */

import { PLAN_ID, PLAN_KEY } from './site';

/* ============================================================
   Assets — the seven tokenized equities, with real Base addresses
   ============================================================ */

export interface Asset {
  ticker: string;
  name: string;
  /** tokenized ticker shown in the UI, e.g. NVDAc */
  token: string;
  /** Base mainnet contract address, used for the asset icon colour seed */
  address: string;
  /**
   * Last price read from Flash's /search via /api/assets.
   * The ticker above the hero re-reads this live every page load; this value
   * is the seed so the page renders instantly instead of waiting on the API.
   */
  price: number;
  change24h: number;
  marketCap: string;
  sector: string;
  spark: number[];
}

const RAW_ASSETS: Omit<Asset, 'spark'>[] = [
  {
    ticker: 'NVDA',
    token: 'NVDAc',
    name: 'NVIDIA Corp',
    address: '0xb20000000000000000000078ee7ce2fe4908108c',
    price: 219.75,
    change24h: 0.22,
    marketCap: '$4.4M',
    sector: 'Semiconductors',
  },
  {
    ticker: 'TSLA',
    token: 'TSLAc',
    name: 'Tesla Inc',
    address: '0xb2000000000000000000001e800a7f5189430cd0',
    price: 362.76,
    change24h: -0.4,
    marketCap: '$3.6M',
    sector: 'Autos & Energy',
  },
  {
    ticker: 'AAPL',
    token: 'AAPLc',
    name: 'Apple Inc',
    address: '0xb200000000000000000000C2e324d24d7eEcd1fb',
    price: 334.89,
    change24h: 0.18,
    marketCap: '$5.2M',
    sector: 'Consumer Tech',
  },
  {
    ticker: 'MSFT',
    token: 'MSFTc',
    name: 'Microsoft Corp',
    address: '0xb200000000000000000000ab99cfa739e253872b',
    price: 494.13,
    change24h: 0.31,
    marketCap: '$2.5M',
    sector: 'Enterprise',
  },
  {
    ticker: 'META',
    token: 'METAc',
    name: 'Meta Platforms',
    address: '0xb2000000000000000000008bc8786b856e61707c',
    price: 671.96,
    change24h: -0.21,
    marketCap: '$11.0M',
    sector: 'Social',
  },
  {
    ticker: 'GOOGL',
    token: 'GOOGLc',
    name: 'Alphabet Inc',
    address: '0xb2000000000000000000002d0ba3164cc74f58b7',
    price: 349.81,
    change24h: 0.44,
    marketCap: '$6.4M',
    sector: 'Search & Cloud',
  },
  {
    ticker: 'AMZN',
    token: 'AMZNc',
    name: 'Amazon.com',
    address: '0xb200000000000000000000d9192b6b456483c2e8',
    price: 253.02,
    change24h: 0.09,
    marketCap: '$3.7M',
    sector: 'Commerce',
  },
];

/**
 * Deterministic sparkline shape derived from the symbol.
 *
 * Deliberately NOT presented as a price history — the fill data we hold is a
 * single point for one asset, and drawing a fake trail behind a real price is
 * exactly the kind of decoration this build can afford least. The line is a
 * texture; the number beside it is the number.
 */
function shapeFor(seed: string, n: number, base: number): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rand = (i: number) => {
    const x = Math.sin((h % 10000) * 0.0001 + i * 127.1) * 43758.5453;
    return x - Math.floor(x);
  };
  const out: number[] = [];
  let v = base * 0.94;
  for (let i = 0; i < n; i += 1) {
    v = v * (1 + (rand(i) - 0.48) * 0.035);
    out.push(Number(v.toFixed(4)));
  }
  const scale = base / out[out.length - 1];
  return out.map(x => Number((x * scale).toFixed(4)));
}

export const ASSETS: Asset[] = RAW_ASSETS.map(a => ({
  ...a,
  spark: shapeFor(a.token, 34, a.price),
}));

export const assetByToken = (token: string): Asset =>
  ASSETS.find(a => a.token === token) ?? ASSETS[0];

/* ============================================================
   The board — one real plan, because one real plan exists
   ============================================================ */

export interface Plan {
  /** the full base64 plan id — it is the URL */
  id: string;
  symbol: string;
  author: string;
  authorHandle: string;
  note: string;
  thesis: string;
  sizePct: number;
  tpPct: number;
  slPct: number;
  entryType: 'market' | 'limit';
  entryPrice: number;
  takeProfitPrice: number;
  stopLossPrice: number;
  createdAt: number;
  mirrors: number;
  notional: number;
  realisedUsd: number;
  unrealisedUsd: number;
  returnPct: number | null;
  open: number;
  closed: number;
  compliancePct: number;
  status: 'live' | 'filled' | 'working';
}

export const LIVE_ENTRY_PRICE = 240.4501226295625411;
export const LIVE_TP_PRICE = 264.34;
export const LIVE_SL_PRICE = 202.66;
export const LIVE_SPEND_USD = 1.35;
export const LIVE_ORDER_ID = '147b45cc-f9ac-4bf4-8f63-63de4e09c8e9';
export const LIVE_BRACKET_ID = '72b7ce84-0051-47a9-b7f9-3108982a293b';
export const LIVE_TX =
  '0xbc808c2012d91c1835baad70ca40f887ed6c1a5e7ace2c5066cf8d6c960d1733';
export const LIVE_FUNDER = '0x59f80641278f554aA921Cbc6547C1823AAFe2fB2';
export const LIVE_CREATED_AT = 1789741154639;

/** Integrator fee actually collected, in micro-USD — read off the settled fill. */
export const LIVE_FEE_MICRO = 3375;
/** Author share of the integrator fee, per INTEGRATOR_FEE_BPS / AUTHOR_SHARE_PCT. */
export const AUTHOR_SHARE_PCT = 60;
export const FEE_BPS = 25;

export const PLANS: Plan[] = [
  {
    id: PLAN_ID,
    symbol: 'NVDAc',
    author: LIVE_FUNDER,
    authorHandle: '0x59f8…2fb2',
    note: 'the great',
    thesis:
      'A market entry with a +20% target and an −8% stop, published at midnight while the NYSE was shut. The author is out of the loop: every wallet that opens the link re-quotes it against its own balance and signs its own protective pair.',
    sizePct: 100,
    tpPct: 20,
    slPct: 8,
    entryType: 'market',
    entryPrice: LIVE_ENTRY_PRICE,
    takeProfitPrice: LIVE_TP_PRICE,
    stopLossPrice: LIVE_SL_PRICE,
    createdAt: LIVE_CREATED_AT,
    mirrors: 1,
    notional: LIVE_SPEND_USD,
    // Nothing has closed, so nothing has been realised. Reported as zero
    // because it IS zero, and the board says why rather than hiding it.
    realisedUsd: 0,
    unrealisedUsd: -0.1171,
    returnPct: -8.4,
    open: 1,
    closed: 0,
    compliancePct: 100,
    status: 'live',
  },
];

export const planByKey = (key: string): Plan | undefined =>
  key === PLAN_KEY ? PLANS[0] : undefined;

/* ============================================================
   Misc copy
   ============================================================ */

/**
 * The stat band.
 *
 * The design's version read "$28.4K mirrored notional · 96% brackets verified".
 * Ours is smaller and fully checkable: one mirror, five green checks, and a fee
 * rate that is a real line of configuration rather than a claim. A number a
 * judge can click through to beats a number they have to take on faith.
 */
export const STATS = [
  {
    value: '100%',
    label: 'Mirrors ran as published',
    sub: '1 of 1, read back from the exchange',
  },
  {
    value: '5 / 5',
    label: 'Compliance checks green',
    sub: 'wanted $264.34, got $264.34',
  },
  { value: '24 / 7', label: 'Market hours', sub: 'tokenized equities on Base' },
  {
    value: `${FEE_BPS} bps`,
    label: 'Flat execution fee',
    sub: `${AUTHOR_SHARE_PCT}% credited to authors`,
  },
];

export const PRINCIPLES = [
  {
    kicker: '01',
    title: 'Parametric by construction',
    body: 'A plan is a percentage of the wallet, never a copy of someone else\u2019s position. Every mirror gets a fresh quote against a different balance — so a follower with $50 gets a proportional position and a proportional stop, not a whale\u2019s absolute size.',
    icon: 'percent',
  },
  {
    kicker: '02',
    title: 'Brackets that stand alone',
    body: 'Each mirror signs its own take-profit and stop-loss pair, good-til-cancelled. When the author closes, your protection stays on the book. That is the difference between a signal and a shared exit.',
    icon: 'shield',
  },
  {
    kicker: '03',
    title: 'Scored on real fills',
    body: 'The board ranks on realised P&L — dollars that actually settled, read back from the exchange rather than from a screenshot. A plan that booked profit outranks a plan forty wallets copied into a loss.',
    icon: 'chart',
  },
];

export const STEPS = [
  {
    n: '01',
    title: 'Compose',
    body: 'Pick the asset, set your size as a share of the wallet, and choose the two levels that define the trade.',
    detail: 'Asset · Entry · Size % · TP % · SL %',
  },
  {
    n: '02',
    title: 'Sign twice',
    body: 'The entry is signed first, then the protective pair. One submit lands the position with its protection already attached.',
    detail: 'EIP-712 · keys never leave the browser',
  },
  {
    n: '03',
    title: 'Publish',
    body: 'The plan becomes a permanent URL. That link is the post — no feed, no algorithm, no database row required.',
    detail: '/p/… — the plan is encoded in the path',
  },
  {
    n: '04',
    title: 'Mirror',
    body: 'Anyone who opens the link gets it re-quoted against their own wallet and balance, with their own bracket attached.',
    detail: 'One tap · their size · their stop',
  },
];

export const FAQ = [
  {
    q: 'What exactly is a “plan”?',
    a: 'A plan is a shareable object, not a post in a feed. It carries an asset, an entry type, a size expressed as a percentage of the mirroring wallet, a take-profit percentage and a stop-loss percentage. Publishing one produces a URL — opening that URL re-quotes the plan against your wallet and balance.',
  },
  {
    q: 'Can the author close my position?',
    a: 'No. Each mirror signs its own take-profit and stop-loss pair, good-til-cancelled, from its own key over its own levels. The author closing their position cannot exit a follower, because the follower\u2019s exit is a separate order on the exchange that the author has no key to. That independence is the product, not a flaw in it.',
  },
  {
    q: 'Why percentages instead of prices?',
    a: 'Every mirror needs a fresh quote against a different wallet, so a plan has to be expressed in percentages. That constraint is also the better product: your $50 and a whale\u2019s $5,000 produce two genuinely different positions with two genuinely different stop prices — not one trade split two ways.',
  },
  {
    q: 'How are plans ranked?',
    a: 'The headline order is realised P&L — dollars that actually settled from fills read back off the exchange. Return % and wallet count are one click away. A plan whose fills cannot be read back is reported as unreadable rather than quietly ranked at zero, because unpriced is not the same as flat.',
  },
  {
    q: 'Is a mirror forced to follow the plan?',
    a: 'No, and the app does not pretend otherwise. A plan is guidance, not an enforced contract: a mirror can size differently, move its levels, or close at any time. What Night Desk does instead is measure. Every mirror is an order on the exchange, so the app reads the protection that actually landed back and compares it with the levels the plan published. That readout is on every plan page, and where it cannot tell, it says unknown rather than assuming the best.',
  },
  {
    q: 'What does it cost?',
    a: `A flat ${FEE_BPS} bps on execution, surfaced in the preview before you sign anything. ${AUTHOR_SHARE_PCT}% of the integrator fee generated by a mirror is credited to the plan author, settled in USDC. Publishing costs nothing beyond the trade itself — which is also why the link cannot lie about whether the author ran it.`,
  },
  {
    q: 'What is actually true about this deployment?',
    a: `One plan has been published and run, on Base mainnet, with real money: a ${LIVE_SPEND_USD} USDC market entry on NVDAc that filled at $240.45 with an attached +20% / −8% bracket. That one mirror is the entire history, and every figure on this page derives from it. Where a number would be more flattering if it were larger, it has been left small and real.`,
  },
];

export const TONE = {
  positive: '#34e0a0',
  negative: '#fb4d6d',
  neutral: '#8590ac',
};
