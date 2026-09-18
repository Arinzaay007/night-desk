import { loadBoardRows } from '@/lib/plans';
import { BoardView } from './BoardView';
import type { BoardPlan } from '@/lib/boardPlan';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The board.
 *
 * Rows are read server-side so the table is real content in the first paint —
 * a plan's existence, its levels and how much was deployed are facts the ledger
 * already holds. What each mirror actually *earned* costs an exchange round trip
 * per plan, so those numbers arrive after paint and every row carries `priced:
 * false` until they do. Nothing is rendered as a zero in the meantime.
 */
export default async function BoardPage() {
  const { rows } = await loadBoardRows();

  const plans: BoardPlan[] = rows.map(row => ({
    // The short key is what /api/proof indexes by; the long id is the link.
    planKey: row.planKey,
    id: row.planId ?? '',
    symbol: row.symbol,
    author: row.author ?? '',
    authorHandle: shortAuthor(row.author),
    note: row.note ?? '',
    thesis: '',
    sizePct: row.sizePct ?? 0,
    tpPct: row.tpPct ?? 0,
    slPct: row.slPct ?? 0,
    entryType: 'market',
    // The plan published percentages; the absolute stop is whatever the first
    // mirror's bracket landed at. Shown as recorded, never recomputed.
    entryPrice: 0,
    takeProfitPrice: row.takeProfitPrice,
    stopLossPrice: row.stopLossPrice,
    createdAt: row.createdAt,
    mirrors: row.mirrors,
    notional: row.notional,
    realisedUsd: 0,
    unrealisedUsd: 0,
    returnPct: null,
    open: row.mirrors,
    closed: 0,
    compliancePct: 0,
    status: 'live',
    priced: false,
    unreadable: false,
  }));

  return <BoardView rows={plans} />;
}

function shortAuthor(address?: string): string {
  if (!address) return 'unknown';
  if (address.length < 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
