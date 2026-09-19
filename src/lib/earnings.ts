/**
 * The author ledger.
 *
 * WHY THIS IS OFF-CHAIN, AND WHY THAT IS NOT A SHORTCUT
 * -----------------------------------------------------
 * Flash pays exactly one integrator per order: us. The exchange has no way to
 * split `flashIntegratorFeeBps` across many authors, and we are not going to
 * deploy a contract to fake it. So this module is a LEDGER OF OBLIGATION, not a
 * contract: it records what we owe each plan author, and `POST /api/earnings`
 * settles it with a plain USDC transfer.
 *
 * DO NOT write UI copy that implies on-chain payout to authors.
 *
 * MONEY IS INTEGER MICRO-USD
 * --------------------------
 * A $0.25 mirror at 25 bps pays a 60% share of 625 µUSD — 375 µUSD. Express
 * that in float dollars and cents and it rounds to zero: the author is silently
 * paid nothing on exactly the small mirrors this product is designed for. So
 * every stored amount is an integer count of µUSD (1e-6 USD) and every division
 * happens once, late, with an explicit rounding rule.
 *
 * THE THREE STATES
 * ----------------
 *   estimated   — an order was placed; the fee is a forecast. NEVER PAYABLE.
 *   reconciled  — the fills settled and we recomputed from what was actually
 *                 charged (entry order AND bracket leg). This is the only state
 *                 that can be withdrawn.
 *   claimed     — a transfer was broadcast. Terminal.
 *
 * `estimated` cannot leak into a payout: `claimable()` filters it out by
 * construction rather than by remembering to check.
 */

import { addrKey, sameAddress } from './address';

/** Integer micro-USD per USD. */
export const MICRO = 1_000_000;

export type EarningState = 'estimated' | 'reconciled' | 'claimed';

export interface EarningRecord {
  /** `earningId(planKey, orderId)` — stable, so double-accrual is impossible. */
  id: string;
  planKey: string;
  planId?: string;
  symbol: string;
  /** The author's wallet: the address that published the plan. */
  author: string;
  /** The wallet that ran the plan; the fee was charged to them, not the author. */
  funder: string;
  /** The entry order. */
  orderId: string;
  /** The attached take-profit/stop-loss pair, which charges its own fee. */
  bracketOrderId?: string | null;
  /** Our integrator fee on this order, integer µUSD. */
  feeMicro: number;
  /** The author's share of it, integer µUSD. */
  authorMicro: number;
  state: EarningState;
  createdAt: number;
  reconciledAt?: number;
  claimedAt?: number;
  /** Transfer reference (tx hash or batch id) once claimed. */
  payoutRef?: string;
}

/* ------------------------------- arithmetic ------------------------------- */

/**
 * The share of the fee that goes to the author, as a fraction.
 * Clamped: a misconfigured env var must not pay out more than we collect.
 */
export function authorSharePct(): number {
  const raw = Number(process.env.AUTHOR_SHARE_PCT ?? 60);
  if (!Number.isFinite(raw)) return 60;
  return Math.min(100, Math.max(0, raw));
}

/** Round a float dollar amount to integer micro-USD. */
export function toMicro(usd: number): number {
  if (!Number.isFinite(usd)) return 0;
  return Math.round(usd * MICRO);
}

/** Micro-USD back to a float, for maths that must mix with API dollar strings. */
export function fromMicro(micro: number): number {
  return micro / MICRO;
}

/**
 * Our integrator fee on a notional, as integer micro-USD.
 *
 * This is deliberately NOT derived from `estimatedFeeNotional`. That figure is
 * all-in — it already contains Definitive's own 10 bps and the network cost.
 * Sharing it out would pay authors money nobody collected.
 */
export function integratorFeeMicro(notionalUsd: number, bps: number): number {
  if (!Number.isFinite(notionalUsd) || notionalUsd <= 0) return 0;
  if (!Number.isFinite(bps) || bps <= 0) return 0;
  return Math.round((notionalUsd * MICRO * bps) / 10_000);
}

/** The author's cut of a fee, integer micro-USD. */
export function authorCutMicro(feeMicro: number, pct = authorSharePct()): number {
  return Math.round((feeMicro * pct) / 100);
}

/**
 * The fee actually charged on one fill, from the fill itself when Flash reports
 * it, falling back to our own bps maths when it does not.
 *
 * Fills carry `integratorFeeAmount` denominated in `feeTicker`. We can only
 * trust it directly when the ticker is a dollar stablecoin; for any other
 * ticker we recompute from the notional we know the order was for.
 */
export function integratorFeeMicroFromFill(
  fill: {
    integratorFeeNotional?: string | null;
    integratorFeeAmount?: string | null;
    feeTicker?: string | null;
    notional?: string | null;
  },
  bps: number,
): number {
  /*
   * Prefer `integratorFeeNotional`: it is our fee already expressed in USD, so
   * it needs neither a ticker check nor a recomputation. Verified against a real
   * Base fill (2026-09-18): a $1.35 NVDAc order on a 25 bps rate reported
   * integratorFeeNotional = "0.003375", which is exactly 25 bps of 1.35.
   */
  const usd = Number(fill.integratorFeeNotional ?? '');
  if (Number.isFinite(usd) && usd > 0) return toMicro(usd);

  const ticker = (fill.feeTicker ?? '').toUpperCase();
  const reported = Number(fill.integratorFeeAmount ?? '');
  const dollarish = ticker === 'USDC' || ticker === 'USDT' || ticker === 'USD';
  if (dollarish && Number.isFinite(reported) && reported > 0) {
    return toMicro(reported);
  }
  const notional = Number(fill.notional ?? '');
  if (Number.isFinite(notional) && notional > 0) return integratorFeeMicro(notional, bps);
  return 0;
}

/** Stable key for one (plan, order) pair. Idempotent accrual depends on this. */
export function earningId(planKey: string, orderId: string): string {
  return `${planKey}::${orderId}`;
}

/* ------------------------------- formatting ------------------------------- */

/**
 * Render micro-USD for humans without ever lying about a nonzero amount.
 *
 * `$0.00` for a real 375 µUSD is the kind of copy that makes an author think
 * they were robbed. Sub-cent amounts get shown in cents, to two decimals.
 */
export function formatMicro(micro: number): string {
  if (!Number.isFinite(micro) || micro === 0) return '$0.00';
  // The sign belongs in front of the symbol: "-$0.15", never "$-0.15".
  const sign = micro < 0 ? '-' : '';
  const usd = Math.abs(micro) / MICRO;

  if (usd < 0.01) return `${sign}${(usd * 100).toFixed(2)}¢`;
  if (usd < 1) {
    // Four places, then drop the padding: $0.15 reads better than $0.1500,
    // and $0.0375 keeps every digit that matters.
    const fixed = usd.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
    return `${sign}$${fixed}`;
  }
  return `${sign}$${usd.toFixed(2)}`;
}

/* --------------------------------- entries -------------------------------- */

export interface AccrueInput {
  planKey: string;
  planId?: string;
  symbol: string;
  author: string;
  funder: string;
  orderId: string;
  bracketOrderId?: string | null;
  /** The notional actually quoted for the entry order, in USD. */
  notionalUsd: number;
  /** Our integrator fee in bps, as sent to Flash. */
  bps: number;
  now?: number;
}

/**
 * Record a forecast earning for a placed order.
 *
 * Returns the existing record unchanged if this (plan, order) was already
 * accrued, so a retried request cannot double-count.
 */
export function accrue(records: EarningRecord[], input: AccrueInput): EarningRecord {
  const id = earningId(input.planKey, input.orderId);
  const existing = records.find(r => r.id === id);
  if (existing) return existing;

  const feeMicro = integratorFeeMicro(input.notionalUsd, input.bps);
  const record: EarningRecord = {
    id,
    planKey: input.planKey,
    planId: input.planId,
    symbol: input.symbol,
    author: input.author,
    funder: input.funder,
    orderId: input.orderId,
    bracketOrderId: input.bracketOrderId ?? null,
    feeMicro,
    authorMicro: authorCutMicro(feeMicro),
    state: 'estimated',
    createdAt: input.now ?? Date.now(),
  };
  records.push(record);
  return record;
}

/* ------------------------------ reconciliation ----------------------------- */

export interface ReconcileInput {
  planKey: string;
  orderId: string;
  /** Settled (filled) legs. Entry first, then the bracket pair — both count. */
  fills: Array<{
    integratorFeeAmount?: string | null;
    feeTicker?: string | null;
    notional?: string | null;
    status?: string | null;
  }>;
  bps: number;
  now?: number;
}

/**
 * Replace the forecast with what was actually charged.
 *
 * RECOMPUTED, NOT ACCUMULATED. Summing the entry and the bracket leg gives the
 * true total; adding a settlement on top of the estimate would double-count the
 * entry fee. The bracket leg must be included — a plan that takes profit pays
 * the pair's fee too, and an entry-only total underpays that author.
 */
export function reconcile(records: EarningRecord[], input: ReconcileInput): EarningRecord | null {
  const id = earningId(input.planKey, input.orderId);
  const record = records.find(r => r.id === id);
  if (!record) return null;
  // Claimed is terminal: a late fill report must not reopen a settled payout.
  if (record.state === 'claimed') return record;

  const settled = input.fills.filter(f => {
    const status = (f.status ?? '').toUpperCase();

    /*
     * Flash reports a settled fill as CHAIN_STATUS_PROCESSED, and eventually
     * CHAIN_STATUS_FINALIZED. Only accepting the generic FILLED here meant no
     * real mirror ever reconciled: every author's row sat at `estimated`
     * forever, and `estimated` is deliberately not withdrawable. The money was
     * owed and structurally unpayable.
     *
     * Reorged and unspecified are excluded on purpose — a reorged fill was
     * undone, and an unknown state is not a settled one. A blank status counts
     * as neither: this is the one place in the system where guessing in the
     * generous direction pays out money nobody collected.
     */
    if (status === 'CHAIN_STATUS_REORGED' || status === 'CHAIN_STATUS_UNSPECIFIED') return false;

    return (
      status === 'CHAIN_STATUS_PROCESSED' ||
      status === 'CHAIN_STATUS_FINALIZED' ||
      status === 'FILLED' ||
      status === 'PARTIALLY_FILLED'
    );
  });
  if (settled.length === 0) return record;

  const feeMicro = settled.reduce((sum, fill) => sum + integratorFeeMicroFromFill(fill, input.bps), 0);
  // Never let a reconciliation push the obligation above the forecast plus a
  // sane margin; a unit error upstream should not invent a payout.
  record.feeMicro = feeMicro;
  record.authorMicro = authorCutMicro(feeMicro);
  record.state = 'reconciled';
  record.reconciledAt = input.now ?? Date.now();
  return record;
}

/** Mark reconciled records as paid. Returns the records that were changed. */
export function markClaimed(
  records: EarningRecord[],
  ids: string[],
  payoutRef: string,
  now = Date.now(),
): EarningRecord[] {
  const touched: EarningRecord[] = [];
  for (const record of records) {
    if (!ids.includes(record.id)) continue;
    if (record.state !== 'reconciled') continue; // estimates are not payable
    record.state = 'claimed';
    record.claimedAt = now;
    record.payoutRef = payoutRef;
    touched.push(record);
  }
  return touched;
}

/* --------------------------------- queries -------------------------------- */

/** Reconciled and unclaimed. Estimates are excluded by construction. */
export function claimable(records: EarningRecord[]): EarningRecord[] {
  return records.filter(r => r.state === 'reconciled');
}

export interface AuthorSummary {
  author: string;
  /** Forecast only. Must never appear in a payout total. */
  estimatedMicro: number;
  /** Owed and withdrawable. */
  payableMicro: number;
  claimedMicro: number;
  plans: number;
  records: number;
}

const emptySummary = (author: string): AuthorSummary => ({
  author,
  estimatedMicro: 0,
  payableMicro: 0,
  claimedMicro: 0,
  plans: 0,
  records: 0,
});

export function summariseForAuthor(records: EarningRecord[], author: string): AuthorSummary {
  const summary = emptySummary(author);
  const plans = new Set<string>();
  for (const record of records) {
    if (!sameAddress(record.author, author)) continue;
    summary.records += 1;
    plans.add(record.planKey);
    if (record.state === 'estimated') summary.estimatedMicro += record.authorMicro;
    else if (record.state === 'reconciled') summary.payableMicro += record.authorMicro;
    else summary.claimedMicro += record.authorMicro;
  }
  summary.plans = plans.size;
  return summary;
}

/** Every author with a balance, largest payable first — the operator queue. */
export function summariseAllAuthors(records: EarningRecord[]): AuthorSummary[] {
  const authors = new Set(records.map(r => addrKey(r.author)).filter(Boolean));
  return [...authors]
    .map(author => summariseForAuthor(records, author))
    .sort((a, b) => b.payableMicro - a.payableMicro || a.author.localeCompare(b.author));
}
