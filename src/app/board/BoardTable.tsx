'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { relativeTime, shortAddress, usd } from '@/lib/format';
import type { BoardRow } from '@/lib/plans';
import { hasRealised, rankPlans, type SortMode } from '@/lib/rank';

interface Pnl {
  realisedUsd: number;
  unrealisedUsd: number;
  totalUsd: number;
  investedUsd: number;
  totalPct: number | null;
  verified: number;
  mirrors: number;
}

const signed = (value: number): string => `${value >= 0 ? '+' : '−'}${usd(Math.abs(value))}`;
const toneFor = (value: number): string =>
  value > 0 ? 'var(--good)' : value < 0 ? 'var(--bad)' : 'var(--muted)';

const MODES: { id: SortMode; label: string; hint: string }[] = [
  { id: 'realised', label: 'Realised P&L', hint: 'money actually booked from settled fills' },
  {
    id: 'return',
    label: 'Return %',
    hint: 'realised plus open, as a percentage of what was deployed',
  },
  { id: 'wallets', label: 'Wallets', hint: 'how many wallets ran the plan' },
];

/**
 * The board's interactive half.
 *
 * Rows arrive already fetched so the table is real content at first paint rather
 * than a spinner. Performance is the ranking key, so it loads for every plan
 * rather than on a click — see the loop below for why that has to be serial.
 */
export function BoardTable({ rows }: { rows: BoardRow[] }) {
  const [pnl, setPnl] = useState<Record<string, Pnl>>({});
  const [attempted, setAttempted] = useState<Record<string, boolean>>({});
  const [mode, setMode] = useState<SortMode>('realised');

  useEffect(() => {
    let cancelled = false;

    /*
     * Strictly one plan at a time. The proof route already paces its order reads
     * to stay under Flash's 5 req/sec, and fanning out here would undo that and
     * start collecting 429s. Each result lands on its own, so the board fills in
     * and reorders instead of blocking on the slowest plan. A plan that fails to
     * price keeps its retry button and is never shown as flat.
     */
    (async () => {
      for (const row of rows) {
        if (cancelled) return;
        try {
          const response = await fetch(`/api/proof?planKey=${encodeURIComponent(row.planKey)}`);
          const payload = (await response.json()) as {
            ok?: boolean;
            pnl?: Omit<Pnl, 'verified'>;
            verified?: number;
          };
          if (cancelled) return;
          if (payload.ok && payload.pnl) {
            setPnl(prev => ({
              ...prev,
              [row.planKey]: { ...payload.pnl!, verified: payload.verified ?? 0 },
            }));
          }
        } catch {
          /* handled by leaving the row unpriced */
        }
        if (cancelled) return;
        setAttempted(prev => ({ ...prev, [row.planKey]: true }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [rows]);

  const retry = async (planKey: string) => {
    setAttempted(prev => ({ ...prev, [planKey]: false }));
    try {
      const response = await fetch(`/api/proof?planKey=${encodeURIComponent(planKey)}`);
      const payload = (await response.json()) as {
        ok?: boolean;
        pnl?: Omit<Pnl, 'verified'>;
        verified?: number;
      };
      if (payload.ok && payload.pnl) {
        setPnl(prev => ({ ...prev, [planKey]: { ...payload.pnl!, verified: payload.verified ?? 0 } }));
      }
    } catch {
      /* stays unpriced */
    } finally {
      setAttempted(prev => ({ ...prev, [planKey]: true }));
    }
  };

  // The ordering rule itself lives in src/lib/rank.ts, where it is asserted against.
  const ranked = useMemo(() => rankPlans(rows, pnl, mode), [rows, pnl, mode]);

  const priced = ranked.filter(row => pnl[row.planKey]).length;
  const unreadable = ranked.filter(row => attempted[row.planKey] && !pnl[row.planKey]).length;
  const pending = rows.length - priced - unreadable;
  const anyRealised = hasRealised(pnl);

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <div className="row" style={{ gap: 6 }}>
          {MODES.map(option => (
            <button
              key={option.id}
              className={option.id === mode ? 'button small' : 'button ghost small'}
              onClick={() => setMode(option.id)}
              title={option.hint}
            >
              {option.label}
            </button>
          ))}
        </div>
        <span className="tiny dim">
          {priced} of {rows.length} priced
          {pending > 0 ? ` · reading ${pending} more` : ''}
          {unreadable > 0 ? ` · ${unreadable} unreadable` : ''}
        </span>
      </div>

      <div className="card" style={{ padding: '8px 8px 4px' }}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 34 }}>#</th>
              <th>Asset</th>
              <th>Plan</th>
              <th>Realised</th>
              <th>Open</th>
              <th>Total</th>
              <th>Wallets</th>
              <th>Author</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((row, index) => {
              const result = pnl[row.planKey];
              const reading = !result && !attempted[row.planKey];
              return (
                <tr key={row.planKey}>
                  <td className="num dim">{result || mode === 'wallets' ? index + 1 : '—'}</td>
                  <td>
                    {row.planId ? (
                      <Link className="mono" href={`/p/${row.planId}`} title="Open the plan">
                        {row.symbol}
                      </Link>
                    ) : (
                      <strong className="mono">{row.symbol}</strong>
                    )}
                    <div className="tiny dim">
                      {row.createdAt ? relativeTime(row.createdAt) : ''}
                    </div>
                  </td>
                  <td>
                    <div className="num">
                      {row.sizePct ?? '—'}% · +{row.tpPct ?? '—'}% / −{row.slPct ?? '—'}%
                    </div>
                    {row.note && (
                      <div className="tiny dim" style={{ maxWidth: 280 }}>
                        {row.note}
                      </div>
                    )}
                  </td>
                  {result ? (
                    <>
                      <td className="num" style={{ color: toneFor(result.realisedUsd) }}>
                        {signed(result.realisedUsd)}
                      </td>
                      <td className="num" style={{ color: toneFor(result.unrealisedUsd) }}>
                        {signed(result.unrealisedUsd)}
                      </td>
                      <td className="num" style={{ color: toneFor(result.totalUsd) }}>
                        {signed(result.totalUsd)}
                        {result.totalPct !== null && (
                          <span className="tiny" style={{ marginLeft: 5 }}>
                            {result.totalPct >= 0 ? '+' : '−'}
                            {Math.abs(result.totalPct).toFixed(2)}%
                          </span>
                        )}
                      </td>
                    </>
                  ) : (
                    <td colSpan={3}>
                      {reading ? (
                        <span className="tiny dim">reading fills…</span>
                      ) : (
                        <span className="row" style={{ gap: 8, alignItems: 'center' }}>
                          <span className="tiny dim">unreadable</span>
                          <button
                            className="button ghost small"
                            onClick={() => void retry(row.planKey)}
                            title="The exchange did not return one or more of this plan's orders."
                          >
                            retry
                          </button>
                        </span>
                      )}
                    </td>
                  )}
                  <td>
                    <span className="pill accent">{row.mirrors}</span>
                    <div className="tiny dim">{usd(row.notional)} in</div>
                  </td>
                  <td>
                    <span className="mono tiny">{shortAddress(row.author)}</span>
                    {row.planId && (
                      <div>
                        <Link className="link tiny" href={`/p/${row.planId}`}>
                          open plan →
                        </Link>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {mode === 'realised' && !anyRealised && priced > 0 && (
        <p className="tiny dim" style={{ marginTop: 10 }}>
          Nothing has been closed yet, so every plan books <strong>$0.00 realised</strong> and the
          order you are looking at falls through to open performance. That is the ranking working
          correctly, not an empty column — a stop firing or a take-profit hit moves a plan up this
          board for good.
        </p>
      )}
    </>
  );
}
