/**
 * Plan compliance — did the mirrors actually run the plan?
 *
 * THE HOLE THIS CLOSES
 * --------------------
 * A plan is not enforced. Someone opens the link, reads the parameters, and
 * signs their own order. Nothing made them use +20% / -8%; the app has no way
 * to know whether they did.
 *
 * "Mirror" was therefore a claim rather than a fact, and a claim is what a
 * sharp reviewer pokes at first: *is this a product, or a screenshot with a
 * share button?*
 *
 * It does not have to be a claim. Every mirror is an order on the exchange with
 * its bracket levels in the fill data, and we already read that back for the
 * proof panel. So we can compare what the plan asked for against what actually
 * landed and say which mirrors honoured it.
 *
 * WHAT "COMPLIANT" MEANS HERE — AND WHAT IT DOES NOT
 * --------------------------------------------------
 * It means: **the protection that landed on the exchange is the protection the
 * plan specified.** The take-profit and stop-loss sitting on Flash match the
 * levels this plan asked for, to within a rounding tolerance.
 *
 * It does NOT mean we forced anyone to do anything, and the UI must not imply
 * that. A mirror can be perfectly compliant and still be its own independent
 * position — that is the entire point of the product. Compliance is a readout,
 * not a control.
 *
 * Nor is it a return or a quality signal: an honest 100% compliance rate says
 * nothing about whether the plan was any good.
 */

export const TOLERANCE_PCT = 0.5;

export type ComplianceStatus = 'published' | 'deviated' | 'unprotected' | 'unknown';

export interface ComplianceCheck {
  name: string;
  expected: string;
  actual: string;
  ok: boolean;
  /** Checks that could not be evaluated are reported, never silently passed. */
  skipped?: boolean;
}

export interface ComplianceVerdict {
  status: ComplianceStatus;
  /** Take-profit as actually placed vs as the plan specified. */
  takeProfitDeviationPct: number | null;
  stopLossDeviationPct: number | null;
  checks: ComplianceCheck[];
  /** One line a human can read. */
  summary: string;
}

export interface ComplianceInput {
  /** The plan's intent. Percentages, never prices. */
  tpPct: number;
  slPct: number;
  /** The absolute levels the plan resolved to for THIS wallet, at mirror time. */
  plannedTakeProfit: number | null;
  plannedStopLoss: number | null;
  /** What is actually resting on the exchange, read back from the order. */
  actualTakeProfit: number | null;
  actualStopLoss: number | null;
  /** Did a bracket order get attached and is it still live? */
  bracketOrderId: string | null;
  bracketStatus: string | null;
  /** Entry fill price, when the entry has traded. */
  entryPrice: number | null;
}

const round = (n: number, dp = 2) => Number(n.toFixed(dp));

/** Is `actual` within tolerance of `expected`? */
export function withinTolerance(actual: number, expected: number, tolerancePct = TOLERANCE_PCT): boolean {
  if (!Number.isFinite(actual) || !Number.isFinite(expected) || expected === 0) return false;
  return Math.abs((actual - expected) / expected) * 100 <= tolerancePct;
}

/**
 * Level comparison.
 *
 * Both sides are absolute USD prices derived from the same percentages, so a
 * clean mirror should match almost exactly. The tolerance absorbs float
 * rounding in the quote, not real drift — a mirrorer who widened their stop
 * from -8% to -16% is out by 100%, far outside it.
 */
export function evaluateCompliance(input: ComplianceInput): ComplianceVerdict {
  const checks: ComplianceCheck[] = [];

  /* 1. Was protection attached at all? The plan's central guarantee. */
  const hasBracket = Boolean(input.bracketOrderId);
  checks.push({
    name: 'protection attached',
    expected: 'a take-profit / stop-loss pair',
    actual: hasBracket ? 'attached' : 'none',
    ok: hasBracket,
  });

  /* 2. Is it still live? A cancelled bracket is protection that is gone. */
  const bracketState = (input.bracketStatus ?? '').toLowerCase();
  const live = hasBracket && ['active', 'accepted', 'pending_activation', 'partially_filled'].includes(bracketState);
  const terminal = ['cancelled', 'canceled', 'closed', 'rejected', 'expired'].includes(bracketState);
  checks.push({
    name: 'protection still live',
    expected: 'active',
    actual: input.bracketStatus ?? 'unknown',
    ok: live,
    // A closed bracket may simply have fired. Do not call that a failure.
    skipped: !hasBracket,
  });

  /* 3 and 4. Do the levels match what the plan asked for? */
  const tpDev = deviationPct(input.actualTakeProfit, input.plannedTakeProfit);
  const slDev = deviationPct(input.actualStopLoss, input.plannedStopLoss);

  const tpOk = tpDev !== null && tpDev <= TOLERANCE_PCT;
  const slOk = slDev !== null && slDev <= TOLERANCE_PCT;

  checks.push({
    name: `take-profit at +${round(input.tpPct)}%`,
    expected: input.plannedTakeProfit ? `$${round(input.plannedTakeProfit)}` : 'not set',
    actual: input.actualTakeProfit ? `$${round(input.actualTakeProfit)}` : 'none',
    ok: tpOk,
    skipped: input.plannedTakeProfit === null || input.actualTakeProfit === null,
  });

  checks.push({
    name: `stop-loss at -${round(input.slPct)}%`,
    expected: input.plannedStopLoss ? `$${round(input.plannedStopLoss)}` : 'not set',
    actual: input.actualStopLoss ? `$${round(input.actualStopLoss)}` : 'none',
    ok: slOk,
    skipped: input.plannedStopLoss === null || input.actualStopLoss === null,
  });

  /* 5. Sanity: is the protection actually protective? */
  if (input.entryPrice && input.actualTakeProfit && input.actualStopLoss) {
    const correctSide = input.actualTakeProfit > input.entryPrice && input.actualStopLoss < input.entryPrice;
    checks.push({
      name: 'levels sit on the correct side of the entry',
      expected: 'TP above, SL below',
      actual: correctSide ? 'correct' : 'inverted',
      ok: correctSide,
    });
  }

  const evaluated = checks.filter(c => !c.skipped);
  const failed = evaluated.filter(c => !c.ok);

  let status: ComplianceStatus;
  if (!hasBracket) status = 'unprotected';
  else if (evaluated.length < 3) status = 'unknown';
  else if (failed.length === 0) status = 'published';
  else status = 'deviated';

  if (status === 'unknown' && terminal) status = 'deviated';

  return {
    status,
    takeProfitDeviationPct: tpDev,
    stopLossDeviationPct: slDev,
    checks,
    summary: summarise(status, input, tpDev, slDev),
  };
}

/** How far off, as a percentage of the expected level. Null when not comparable. */
export function deviationPct(actual: number | null, expected: number | null): number | null {
  if (actual === null || expected === null) return null;
  if (!Number.isFinite(actual) || !Number.isFinite(expected) || expected === 0) return null;
  return Math.abs((actual - expected) / expected) * 100;
}

function summarise(
  status: ComplianceStatus,
  input: ComplianceInput,
  tpDev: number | null,
  slDev: number | null,
): string {
  switch (status) {
    case 'published':
      return `Ran as published — protection resting at +${round(input.tpPct)}% / -${round(input.slPct)}%.`;
    case 'unprotected':
      return 'No protection attached. This order is not running the plan as published.';
    case 'deviated':
      return tpDev !== null && tpDev > TOLERANCE_PCT
        ? `Take-profit is ${round(tpDev, 1)}% away from the level this plan asked for.`
        : slDev !== null && slDev > TOLERANCE_PCT
          ? `Stop-loss is ${round(slDev, 1)}% away from the level this plan asked for.`
          : 'Protection is no longer resting as published.';
    default:
      return 'Not enough read back from the exchange to judge this mirror yet.';
  }
}

/* ------------------------------- aggregate -------------------------------- */

export interface ComplianceSummary {
  total: number;
  published: number;
  deviated: number;
  unprotected: number;
  unknown: number;
  /** Share that ran as published, 0-100, or null when nothing is judgeable. */
  ratePct: number | null;
}

export function summariseCompliance(verdicts: ComplianceVerdict[]): ComplianceSummary {
  const summary: ComplianceSummary = {
    total: verdicts.length,
    published: 0,
    deviated: 0,
    unprotected: 0,
    unknown: 0,
    ratePct: null,
  };
  for (const v of verdicts) summary[v.status] += 1;
  const judgeable = summary.total - summary.unknown;
  if (judgeable > 0) summary.ratePct = (summary.published / judgeable) * 100;
  return summary;
}
