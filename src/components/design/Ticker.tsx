'use client';

import { useEffect, useState } from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

/**
 * The ticker, fed by real market data.
 *
 * Every number in here is read from the exchange or from the chain — prices and
 * 24h changes come from Flash's `/search` via `/api/assets`, gas is read off
 * Base, and the fee is this deployment's own configured rate. There is
 * deliberately no fallback figure: if a value is unknown the row is omitted
 * rather than filled in with something plausible. A ticker that shows a made-up
 * price is worse than a short ticker.
 */

interface Row {
  label: string;
  value: string;
  change: number | null;
}

interface AssetRow {
  symbol: string;
  price: number;
  change24h?: number;
}

function fmtPrice(n: number): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: n >= 1000 ? 0 : 2,
  });
}

function Item({ label, value, change }: Row) {
  const up = change !== null && change > 0;
  const down = change !== null && change < 0;
  return (
    <div className="flex items-center gap-2.5 px-6 py-2.5 border-r border-white/[0.055] whitespace-nowrap">
      <span className="num text-[10.5px] uppercase tracking-[0.16em] text-mist-500">{label}</span>
      <span className="num text-[12px] text-mist-100">{value}</span>
      <span
        className={`inline-flex items-center gap-0.5 num text-[10.5px] ${
          up ? 'text-mint-400' : down ? 'text-rose-400' : 'text-mist-500'
        }`}
      >
        {up && <ArrowUpRight size={11} strokeWidth={2.6} />}
        {down && <ArrowDownRight size={11} strokeWidth={2.6} />}
        {change === null || change === 0
          ? '—'
          : `${up ? '+' : ''}${change.toFixed(2)}%`}
      </span>
    </div>
  );
}

export function Ticker() {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/assets')
      .then(r => r.json())
      .then((payload: { ok?: boolean; assets?: AssetRow[]; gasGwei?: number | null; feeBps?: number }) => {
        if (cancelled || !payload?.ok) return;

        const next: Row[] = (payload.assets ?? [])
          .filter(a => a.price > 0)
          .map(a => ({
            label: a.symbol,
            value: fmtPrice(a.price),
            change: typeof a.change24h === 'number' ? a.change24h : null,
          }));

        if (typeof payload.gasGwei === 'number') {
          next.push({ label: 'BASE GAS', value: `${payload.gasGwei.toFixed(4)} Gwei`, change: null });
        }
        if (typeof payload.feeBps === 'number') {
          next.push({ label: 'DESK FEE', value: `${payload.feeBps} bps`, change: null });
        }

        setRows(next);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  // Nothing real to show yet — show an empty rail rather than inventing prices.
  if (rows.length === 0) {
    return (
      <div className="relative overflow-hidden bg-ink-900/70 border-y border-white/[0.055]">
        <div className="flex items-center px-6 py-2.5">
          <span className="num text-[10.5px] uppercase tracking-[0.16em] text-mist-600">
            reading the exchange…
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="pause-on-hover marquee-mask relative overflow-hidden bg-ink-900/70 border-y border-white/[0.055]">
      <div className="marquee-track">
        {[0, 1].map(copy => (
          <div key={copy} className="flex" aria-hidden={copy === 1}>
            {rows.map(row => (
              <Item key={`${copy}-${row.label}`} {...row} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
