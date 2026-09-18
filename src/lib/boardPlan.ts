/**
 * A board row, in the shape the board renders.
 *
 * `priced` is the load-bearing field. The server can say a plan exists and how
 * much went into it, but not what it earned — that costs an exchange round trip
 * per plan. Until that comes back the row is **unpriced**, which is a different
 * thing from a row that earned nothing, and the UI is required to keep the two
 * apart. Sorting, the aggregate header and the table cells all branch on it.
 */

import type { Plan } from './data';

export interface BoardPlan extends Plan {
  /** true once /api/proof has answered for this plan */
  priced: boolean;
  /** true when the read was attempted and failed — not the same as pending */
  unreadable: boolean;
  planKey: string;
}

/** The subset of /api/proof the board consumes. */
export interface ProofSummary {
  mirrors: number;
  pnl: {
    realisedUsd: number;
    unrealisedUsd: number;
    totalUsd: number;
    investedUsd: number;
  };
  compliance: { total: number; published: number; ratePct: number | null };
}
