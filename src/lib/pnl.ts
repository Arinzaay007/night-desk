/**
 * Realised and unrealised P&L for a single mirror, computed from settled fills.
 *
 * Pure functions on purpose: no network, no clock, no formatting. That makes
 * the maths unit-testable in scripts/preflight.mjs, which matters because this
 * is the number the board is judged on and we cannot spend real money to verify
 * it repeatedly.
 *
 * Definitions, stated plainly because a wrong definition is worse than no number:
 *
 *   entryCost      USDC actually spent acquiring the position (settled fills only)
 *   exitProceeds   USDC actually received selling it (settled bracket fills only)
 *   realised       exitProceeds - the portion of entryCost that has been sold
 *   unrealised     value of what is still held, at the current market price,
 *                  minus the portion of entryCost still at work
 *
 * A mirror with no exit fills is entirely unrealised. A mirror whose bracket
 * fully filled is entirely realised. Partial exits are pro-rated by the fraction
 * of tokens sold.
 */

export interface FillLike {
  notional?: string | null;
  fillPrice?: string | null;
  filledAt?: string | null;
  transactionId?: string | null;
}

export interface OrderLike {
  status?: string | null;
  closeReason?: string | null;
  qty?: string | null;
  filled?: {
    targetAmount?: string | null;
    contraAmount?: string | null;
    averageNotionalPrice?: string | null;
  } | null;
  fills?: FillLike[] | null;
}

export type PnlStatus = 'open' | 'closed' | 'partial' | 'unfilled';

export interface MirrorPnl {
  status: PnlStatus;
  /** USDC spent on settled entry fills. */
  entryCostUsd: number;
  /** USDC received from settled exit fills. */
  exitProceedsUsd: number;
  /** Tokens still held. */
  tokensHeld: number;
  /** Market value of what is still held. */
  positionValueUsd: number;
  /** Booked profit/loss from completed exits. */
  realisedUsd: number;
  /** Paper profit/loss on the open remainder. */
  unrealisedUsd: number;
  /** realised + unrealised. */
  totalUsd: number;
  /** totalUsd as a percentage of entry cost. Null when nothing was spent. */
  totalPct: number | null;
  /** True when the numbers rest on settled fills rather than estimates. */
  fromFills: boolean;
  /** Why a figure is missing, when one is. */
  note?: string;
}

const num = (value: string | number | null | undefined): number => {
  const n = typeof value === 'string' ? Number(value) : (value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const sum = (values: number[]): number => values.reduce((a, b) => a + b, 0);

/**
 * Tokens acquired, preferring the settled amount and falling back to
 * notional / average price when the API has not reported a target amount yet.
 */
export function tokensAcquired(entry: OrderLike): number {
  const settled = num(entry.filled?.targetAmount);
  if (settled > 0) return settled;

  const avg = num(entry.filled?.averageNotionalPrice);
  const contra = num(entry.filled?.contraAmount);
  if (avg > 0 && contra > 0) return contra / avg;

  return 0;
}

/** Tokens sold, from exit fills. Falls back to notional / price per fill. */
export function tokensSold(exit: OrderLike | null | undefined): number {
  if (!exit?.fills?.length) return 0;
  return sum(
    exit.fills.map(fill => {
      const notional = num(fill.notional);
      const price = num(fill.fillPrice);
      if (price > 0) return notional / price;
      return 0;
    }),
  );
}

export interface PnlInput {
  entry: OrderLike;
  /** The protective pair, if the entry carried one. */
  exit?: OrderLike | null;
  /** Current market price of the token in USD. Required for unrealised figures. */
  currentPrice?: number | null;
}

export function computePnl({ entry, exit, currentPrice }: PnlInput): MirrorPnl {
  const entryFills = entry.fills ?? [];
  const exitFills = exit?.fills ?? [];

  const entryCost = sum(entryFills.map(f => num(f.notional)));
  const exitProceeds = sum(exitFills.map(f => num(f.notional)));

  const bought = tokensAcquired(entry);
  const sold = tokensSold(exit);
  const held = Math.max(bought - sold, 0);

  const price = num(currentPrice);
  const positionValue = price > 0 ? held * price : 0;

  // Nothing settled yet: the entry is still working.
  if (entryFills.length === 0) {
    const hasExit = exitFills.length > 0;
    return {
      status: hasExit ? 'closed' : 'unfilled',
      entryCostUsd: 0,
      exitProceedsUsd: exitProceeds,
      tokensHeld: held,
      positionValueUsd: positionValue,
      realisedUsd: exitProceeds,
      unrealisedUsd: 0,
      totalUsd: exitProceeds,
      totalPct: null,
      fromFills: entryFills.length > 0 || exitFills.length > 0,
      note: hasExit
        ? 'Exits settled but no entry fills were reported — P&L is proceeds only.'
        : 'Entry has not filled yet, so there is nothing to value.',
    };
  }

  // Pro-rate the cost basis across what has been sold and what is still held,
  // so a half-exited position reports half its cost as realised.
  const soldFraction = bought > 0 ? Math.min(sold / bought, 1) : 0;
  const costOfSold = entryCost * soldFraction;
  const costOfHeld = entryCost - costOfSold;

  const realised = exitProceeds - costOfSold;
  const unrealised = price > 0 ? positionValue - costOfHeld : 0;
  const total = realised + unrealised;

  const fullyExited = exitProceeds > 0 && (sold >= bought || held <= 0 || entry.closeReason === 'REASON_FULLY_FILLED' && sold > 0);
  const status: PnlStatus =
    exitProceeds <= 0 ? 'open' : fullyExited || held <= 0 ? 'closed' : 'partial';

  return {
    status,
    entryCostUsd: round(entryCost),
    exitProceedsUsd: round(exitProceeds),
    tokensHeld: held,
    positionValueUsd: round(positionValue),
    realisedUsd: round(realised),
    unrealisedUsd: round(unrealised),
    totalUsd: round(total),
    totalPct: entryCost > 0 ? round((total / entryCost) * 100, 2) : null,
    fromFills: true,
    note:
      price > 0
        ? undefined
        : 'No current price available, so unrealised P&L is excluded — realised figures are unaffected.',
  };
}

/** Aggregates mirror-level P&L into a plan total. */
export interface PlanPnl {
  mirrors: number;
  pricedMirrors: number;
  realisedUsd: number;
  unrealisedUsd: number;
  totalUsd: number;
  investedUsd: number;
  totalPct: number | null;
  open: number;
  closed: number;
  partial: number;
  unfilled: number;
}

export function aggregatePnl(rows: MirrorPnl[]): PlanPnl {
  const invested = sum(rows.map(r => r.entryCostUsd));
  const realised = sum(rows.map(r => r.realisedUsd));
  const unrealised = sum(rows.map(r => r.unrealisedUsd));
  const total = realised + unrealised;

  return {
    mirrors: rows.length,
    pricedMirrors: rows.filter(r => r.status !== 'unfilled').length,
    realisedUsd: round(realised),
    unrealisedUsd: round(unrealised),
    totalUsd: round(total),
    investedUsd: round(invested),
    totalPct: invested > 0 ? round((total / invested) * 100, 2) : null,
    open: rows.filter(r => r.status === 'open').length,
    closed: rows.filter(r => r.status === 'closed').length,
    partial: rows.filter(r => r.status === 'partial').length,
    unfilled: rows.filter(r => r.status === 'unfilled').length,
  };
}

function round(value: number, digits = 4): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
