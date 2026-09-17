/**
 * Board ranking.
 *
 * The board's headline claim is that plans are ranked on realised profit and
 * loss — money that actually settled — rather than on how many wallets copied
 * them. That is an ordering rule, so it lives in a pure function that can be
 * asserted against, instead of in the middle of a component where the only way
 * to check it is to squint at a rendered table.
 *
 * The awkward case this exists to get right: a plan whose performance has not
 * been read back yet has no score at all, which is not the same as a score of
 * zero. Unpriced plans sink to the bottom and stay there until they are priced;
 * they are never quietly ranked as flat.
 */

export type SortMode = 'realised' | 'return' | 'wallets';

export interface RankableRow {
  planKey: string;
  mirrors: number;
  createdAt: number;
}

export interface RankablePnl {
  realisedUsd: number;
  unrealisedUsd: number;
  totalUsd: number;
  totalPct: number | null;
}

/** Below every real score, so unpriced rows sort last under the same comparison. */
const UNPRICED = Number.NEGATIVE_INFINITY;

/**
 * A row's sort key, most significant first. Returning an array rather than a
 * single number is what makes the fall-through explicit: a plan is ranked on
 * realised P&L, and only when two plans tie there does the next column decide.
 */
export function scoreRow(
  row: RankableRow,
  pnl: Record<string, RankablePnl>,
  mode: SortMode,
): number[] {
  if (mode === 'wallets') return [row.mirrors];

  const result = pnl[row.planKey];
  if (!result) return [UNPRICED];

  if (mode === 'return') return [result.totalPct ?? UNPRICED, result.totalUsd, row.mirrors];
  return [result.realisedUsd, result.totalUsd, row.mirrors];
}

/** Highest first. Ties fall through the score array, then to the newest plan. */
export function rankPlans<T extends RankableRow>(
  rows: T[],
  pnl: Record<string, RankablePnl>,
  mode: SortMode = 'realised',
): T[] {
  return [...rows].sort((a, b) => {
    const left = scoreRow(a, pnl, mode);
    const right = scoreRow(b, pnl, mode);

    for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
      const delta = (right[i] ?? 0) - (left[i] ?? 0);
      if (delta !== 0) return delta;
    }
    return b.createdAt - a.createdAt;
  });
}

/** True when at least one plan has booked a non-zero realised figure. */
export function hasRealised(pnl: Record<string, RankablePnl>): boolean {
  return Object.values(pnl).some(result => result.realisedUsd !== 0);
}
