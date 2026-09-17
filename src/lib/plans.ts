import { listMirrors, type MirrorRecord } from './store';

/**
 * Grouping mirrors into board rows.
 *
 * Shared by the board page (which wants the rows at first paint, server-side)
 * and `GET /api/plans` (which wants them as JSON), so the two can never drift.
 */

export interface BoardRow {
  planKey: string;
  /** The base64url id of the shareable link. Absent on records written before it was captured. */
  planId?: string;
  symbol: string;
  author?: string;
  note?: string;
  sizePct?: number;
  tpPct?: number;
  slPct?: number;
  createdAt: number;
  mirrors: number;
  notional: number;
  funders: string[];
  takeProfitPrice: number;
  stopLossPrice: number;
}

export function groupPlans(mirrors: MirrorRecord[]): BoardRow[] {
  const grouped = new Map<string, BoardRow>();

  for (const mirror of mirrors) {
    const existing = grouped.get(mirror.planKey);
    if (existing) {
      // Any mirror may have arrived without the link; keep the first one that has it.
      if (!existing.planId && mirror.planId) existing.planId = mirror.planId;
      existing.mirrors += 1;
      existing.notional += mirror.spendUsd;
      if (!existing.funders.includes(mirror.funder)) existing.funders.push(mirror.funder);
      continue;
    }

    grouped.set(mirror.planKey, {
      planKey: mirror.planKey,
      planId: mirror.planId,
      symbol: mirror.symbol,
      author: mirror.author,
      note: mirror.note,
      sizePct: mirror.sizePct,
      tpPct: mirror.tpPct,
      slPct: mirror.slPct,
      createdAt: mirror.createdAt,
      mirrors: 1,
      notional: mirror.spendUsd,
      funders: [mirror.funder],
      takeProfitPrice: mirror.takeProfitPrice,
      stopLossPrice: mirror.stopLossPrice,
    });
  }

  return [...grouped.values()]
    .map(row => ({ ...row, notional: Number(row.notional.toFixed(2)) }))
    /* Provisional order only — the page re-ranks on performance once prices land. */
    .sort((a, b) => b.mirrors - a.mirrors || b.notional - a.notional);
}

export async function loadBoardRows(): Promise<{ rows: BoardRow[]; total: number }> {
  const mirrors = await listMirrors();
  return { rows: groupPlans(mirrors), total: mirrors.length };
}
