'use client';

import { DRY_RUN, DRY_RUN_LABEL } from '@/lib/dryRun';

/**
 * Unmissable banner while rehearsing, so a dry run is never mistaken for a trade.
 *
 * The `DRY_RUN` guard is the entire point of this component and it was missing:
 * the banner rendered unconditionally, which meant an armed recording carried a
 * strip across the top announcing that nothing was being sent to the exchange.
 * Worse than useless — it is the exact opposite of what the banner is for, and
 * it would have made a real order look staged.
 */
export function DryRunBanner() {
  if (!DRY_RUN) return null;

  return (
    <div
      style={{
        background: '#3a2a08',
        borderBottom: '1px solid rgba(255,159,69,0.5)',
        color: '#ffd9a8',
      }}
    >
      <div
        className="header-inner"
        style={{ padding: '8px 24px', fontSize: 12.5, fontFamily: 'var(--mono)', letterSpacing: '0.04em' }}
      >
        <span>◉</span>
        <span>{DRY_RUN_LABEL}</span>
        <span style={{ marginLeft: 'auto', opacity: 0.75 }}>
          approvals skipped (they cost gas) · set NEXT_PUBLIC_DRY_RUN=0 and restart to arm real orders
        </span>
      </div>
    </div>
  );
}
