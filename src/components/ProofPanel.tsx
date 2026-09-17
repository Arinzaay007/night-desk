'use client';

import { useEffect, useState } from 'react';
import { explorerTx, relativeTime, statusLabel, usd } from '@/lib/format';

interface Fill {
  notional: string | null;
  fillPrice?: string | null;
  filledAt?: string | null;
  txHash: string | null;
  integratorFee?: string | null;
  feeTicker?: string | null;
  venues?: string[];
}

interface MirrorPnl {
  status: 'open' | 'closed' | 'partial' | 'unfilled';
  entryCostUsd: number;
  exitProceedsUsd: number;
  positionValueUsd: number;
  realisedUsd: number;
  unrealisedUsd: number;
  totalUsd: number;
  totalPct: number | null;
  note?: string;
}

interface ProofRow {
  funder: string;
  spendUsd: number;
  createdAt: number;
  verified: boolean;
  error?: string;
  pnl?: MirrorPnl;
  entry?: {
    orderId: string;
    status: string;
    closeReason: string | null;
    ticker: string;
    qty: string;
    filledTarget: string | null;
    averagePrice: string | null;
    bracketStatus: string | null;
    takeProfit: string | null;
    stopLoss: string | null;
    fills: Fill[];
  };
  bracket?: { orderId: string; status: string; closeReason?: string | null; fills: Fill[] } | null;
}

interface PlanPnlShape {
  mirrors: number;
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

interface ProofResponse {
  ok?: boolean;
  mirrors?: number;
  verified?: number;
  currentPrice?: number | null;
  pnl?: PlanPnlShape;
  proof?: ProofRow[];
  error?: string;
}

const signed = (value: number): string => `${value >= 0 ? '+' : '−'}${usd(Math.abs(value))}`;

const toneFor = (value: number): string =>
  value > 0 ? 'var(--good)' : value < 0 ? 'var(--bad)' : 'var(--muted)';

const STATUS_LABEL: Record<MirrorPnl['status'], string> = {
  open: 'open',
  closed: 'closed',
  partial: 'partly exited',
  unfilled: 'not filled',
};

/**
 * Reads every mirror of this plan back from the exchange and shows the fills
 * and transaction hashes. A reviewer can click through to BaseScan and verify
 * the claim themselves — this is what "scored on real fills, not screenshots"
 * has to mean if it means anything.
 */
export function ProofPanel({ planKey }: { planKey: string }) {
  const [data, setData] = useState<ProofResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!planKey) return;
    fetch(`/api/proof?planKey=${encodeURIComponent(planKey)}`)
      .then(r => r.json())
      .then((payload: ProofResponse) => setData(payload))
      .catch(() => setData({ ok: false, error: 'Could not load proof.' }))
      .finally(() => setLoading(false));
  }, [planKey]);

  if (loading) {
    return (
      <p className="tiny dim">Reading fills back from the exchange…</p>
    );
  }

  if (!data?.ok || !data.mirrors) {
    return (
      <p className="tiny dim">
        No wallets have mirrored this plan yet. Once they do, every fill and transaction hash shows
        up here, read back from the exchange.
      </p>
    );
  }

  return (
    <div>
      <div className="row" style={{ marginBottom: 12 }}>
        <span className="pill accent">{data.mirrors} mirrors</span>
        <span className="pill good">
          <span className="dot" />
          {data.verified} verified onchain
        </span>
      </div>

      {data.pnl && data.pnl.investedUsd > 0 && (
        <div className="card card-tight" style={{ marginBottom: 12 }}>
          <div className="grid grid-3" style={{ gap: 10 }}>
            <div>
              <p className="tiny dim" style={{ margin: 0 }}>
                Realised
              </p>
              <p className="big-num" style={{ margin: '4px 0 0', color: toneFor(data.pnl.realisedUsd) }}>
                {signed(data.pnl.realisedUsd)}
              </p>
              <p className="tiny dim" style={{ margin: '4px 0 0' }}>
                {data.pnl.closed + data.pnl.partial} exited
              </p>
            </div>
            <div>
              <p className="tiny dim" style={{ margin: 0 }}>
                Unrealised
              </p>
              <p className="big-num" style={{ margin: '4px 0 0', color: toneFor(data.pnl.unrealisedUsd) }}>
                {signed(data.pnl.unrealisedUsd)}
              </p>
              <p className="tiny dim" style={{ margin: '4px 0 0' }}>
                {data.pnl.open} still open
              </p>
            </div>
            <div>
              <p className="tiny dim" style={{ margin: 0 }}>
                Total
              </p>
              <p className="big-num" style={{ margin: '4px 0 0', color: toneFor(data.pnl.totalUsd) }}>
                {signed(data.pnl.totalUsd)}
                {data.pnl.totalPct !== null && (
                  <span className="tiny" style={{ marginLeft: 6 }}>
                    {data.pnl.totalPct >= 0 ? '+' : '−'}
                    {Math.abs(data.pnl.totalPct).toFixed(2)}%
                  </span>
                )}
              </p>
              <p className="tiny dim" style={{ margin: '4px 0 0' }}>
                on {usd(data.pnl.investedUsd)} invested
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid" style={{ gap: 8 }}>
        {data.proof?.map(row => {
          const entry = row.entry;
          const fills = entry?.fills ?? [];
          const pnl = row.pnl;

          return (
            <div
              key={row.funder}
              className="card card-tight"
              style={{ background: 'var(--bg-soft)' }}
            >
              <div className="spread">
                <span className="mono tiny">
                  {row.funder.slice(0, 6)}…{row.funder.slice(-4)}
                </span>
                <span className="row" style={{ gap: 6 }}>
                  {pnl && <span className="pill">{STATUS_LABEL[pnl.status]}</span>}
                  {entry && <span className="pill">{statusLabel(entry.status)}</span>}
                  <span className="tiny dim">{relativeTime(row.createdAt)}</span>
                </span>
              </div>

              {!row.verified && (
                <p className="tiny" style={{ color: 'var(--bad)', margin: '8px 0 0' }}>
                  Could not verify this mirror: {row.error}
                </p>
              )}

              {entry && (
                <>
                  <div className="row" style={{ marginTop: 8, gap: 14 }}>
                    <span className="tiny dim">
                      Spent <span className="num">{usd(row.spendUsd)}</span>
                    </span>
                    <span className="tiny dim">
                      Filled{' '}
                      <span className="num">
                        {entry.filledTarget ? Number(entry.filledTarget).toFixed(6) : '—'} {entry.ticker}
                      </span>
                    </span>
                    <span className="tiny dim">
                      Levels{' '}
                      <span className="num">
                        {entry.takeProfit ? usd(entry.takeProfit) : '—'} /{' '}
                        {entry.stopLoss ? usd(entry.stopLoss) : '—'}
                      </span>
                    </span>
                    {entry.bracketStatus && !pnl && (
                      <span className="tiny dim">
                        pair <span className="mono">{entry.bracketStatus.replace(/_/g, ' ')}</span>
                      </span>
                    )}
                    {pnl && pnl.realisedUsd !== 0 && (
                      <span className="tiny" style={{ color: toneFor(pnl.realisedUsd) }}>
                        realised <span className="num">{signed(pnl.realisedUsd)}</span>
                      </span>
                    )}
                  </div>

                  {pnl?.note && (
                    <p className="tiny dim" style={{ margin: '6px 0 0' }}>
                      {pnl.note}
                    </p>
                  )}

                  {fills.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      {fills.map((fill, i) => (
                        <div className="tiny dim" key={fill.txHash ?? i} style={{ marginTop: 4 }}>
                          {fill.filledAt ? relativeTime(Date.parse(fill.filledAt)) : 'fill'} ·{' '}
                          <span className="num">{usd(fill.notional ?? 0)}</span>
                          {fill.venues?.length ? ` · ${fill.venues[0]}` : ''}
                          {fill.txHash && (
                            <>
                              {' '}
                              <a
                                className="link"
                                href={explorerTx(fill.txHash)}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                BaseScan ↗
                              </a>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {entry.fills.length === 0 && entry.bracketStatus !== 'never_activated' && (
                    <p className="tiny dim" style={{ margin: '8px 0 0' }}>
                      No fills yet — the entry is still working.
                    </p>
                  )}

                  {row.bracket && (
                    <p className="tiny dim" style={{ margin: '8px 0 0' }}>
                      Protective pair{' '}
                      <span className="mono">{row.bracket.orderId.slice(0, 8)}</span> ·{' '}
                      {statusLabel(row.bracket.status)}
                      {row.bracket.fills.length > 0 && (
                        <>
                          {' '}
                          · fired{' '}
                          <a
                            className="link"
                            href={explorerTx(row.bracket.fills[0].txHash)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            BaseScan ↗
                          </a>
                        </>
                      )}
                    </p>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      <p className="tiny dim" style={{ marginTop: 12, marginBottom: 0 }}>
        Every row is read back from the exchange by funder and order id. Nothing here is
        self-reported.
      </p>
    </div>
  );
}
