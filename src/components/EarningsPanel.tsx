'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatMicro } from '@/lib/earnings';

/**
 * What the author of this plan has earned from it.
 *
 * Fetched rather than baked into the page, because a plan is a link: the page
 * renders from the URL alone and must never depend on the ledger being up.
 *
 * The copy carries two rules that the ledger enforces, because a payout number
 * whose rules are invisible is just a number:
 *
 *   - a forecast (the order is placed, nothing has settled) is NOT money
 *   - our fee is 25 bps of the mirror; the author gets a share of THAT, not of
 *     the all-in fee Flash quotes, which already contains Definitive's own cut
 *
 * Backed by GET /api/earnings?author=
 */

interface EarningRow {
  id: string;
  planKey: string;
  symbol: string;
  funder: string;
  orderId: string;
  authorMicro: number;
  state: 'estimated' | 'reconciled' | 'claimed';
  createdAt: number;
  reconciledAt?: number;
  claimedAt?: number;
}

interface Summary {
  author: string;
  estimatedMicro: number;
  payableMicro: number;
  claimedMicro: number;
  plans: number;
  records: number;
}

interface Payload {
  ok: boolean;
  author?: string;
  feeBps?: number;
  sharePct?: number;
  summary?: Summary;
  totals?: { estimated: string; payable: string; claimed: string };
  note?: string;
  earnings?: EarningRow[];
  error?: string;
}

const short = (address: string) =>
  address && address.length > 10 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address || '—';

const STATE_STYLE: Record<EarningRow['state'], { label: string; cls: string }> = {
  estimated: { label: 'forecast', cls: 'pill' },
  reconciled: { label: 'payable', cls: 'pill good' },
  claimed: { label: 'paid', cls: 'pill accent' },
};

export function EarningsPanel({ author }: { author?: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!author) {
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(`/api/earnings?author=${encodeURIComponent(author)}`, {
        cache: 'no-store',
      });
      const payload = (await response.json()) as Payload;
      if (!response.ok || !payload.ok) {
        setError(payload.error ?? 'Could not read the ledger.');
      } else {
        setData(payload);
        setError(null);
      }
    } catch {
      setError('Could not reach the ledger.');
    } finally {
      setLoading(false);
    }
  }, [author]);

  useEffect(() => {
    void load();
  }, [load]);

  // An unattributed plan cannot earn: there is no wallet to owe.
  if (!author) {
    return (
      <div className="card card-tight">
        <p className="tiny dim" style={{ margin: 0 }}>
          This plan was published without an author address, so mirrors of it pay nothing. Plans
          created while connected attribute to your wallet.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="card card-tight">
        <p className="tiny dim" style={{ margin: 0 }}>
          Reading the author ledger…
        </p>
      </div>
    );
  }

  if (error || !data?.summary || !data.totals) {
    return (
      <div className="card card-tight">
        <p className="tiny dim" style={{ margin: 0 }}>
          {error ?? 'The ledger is unavailable.'} Your plan still works — it lives in the URL, not
          in the database.
        </p>
      </div>
    );
  }

  const { summary, totals } = data;
  const mirrors = summary.records;
  const rows = (data.earnings ?? []).slice(0, 8);

  return (
    <div className="card">
      <div className="spread" style={{ marginBottom: 12 }}>
        <div>
          <p className="eyebrow" style={{ margin: 0 }}>
            Author
          </p>
          <p className="mono" style={{ margin: '2px 0 0' }}>
            {short(summary.author)}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p className="eyebrow" style={{ margin: 0 }}>
            Withdrawable
          </p>
          <p
            className="big-num"
            style={{ margin: '2px 0 0', color: summary.payableMicro > 0 ? 'var(--good)' : undefined }}
          >
            {totals.payable}
          </p>
        </div>
      </div>

      <div className="grid grid-3">
        <div>
          <p className="tiny dim" style={{ margin: 0 }}>
            Forecast
          </p>
          <p className="num" style={{ margin: '2px 0 0' }}>
            {totals.estimated}
          </p>
          <p className="tiny dim" style={{ margin: '2px 0 0' }}>
            not yet payable
          </p>
        </div>
        <div>
          <p className="tiny dim" style={{ margin: 0 }}>
            Payable
          </p>
          <p className="num" style={{ margin: '2px 0 0' }}>
            {totals.payable}
          </p>
          <p className="tiny dim" style={{ margin: '2px 0 0' }}>
            settled fills
          </p>
        </div>
        <div>
          <p className="tiny dim" style={{ margin: 0 }}>
            Paid
          </p>
          <p className="num" style={{ margin: '2px 0 0' }}>
            {totals.claimed}
          </p>
          <p className="tiny dim" style={{ margin: '2px 0 0' }}>
            {summary.plans} {summary.plans === 1 ? 'plan' : 'plans'}
          </p>
        </div>
      </div>

      <div className="divider" />

      {mirrors === 0 ? (
        <p className="tiny dim" style={{ margin: 0 }}>
          Nobody has run this plan yet. When someone does, a share of the {(data.sharePct ?? 60)}%
          author cut shows up here — {data.note ?? ''}
        </p>
      ) : (
        <>
          <table className="table">
            <thead>
              <tr>
                <th>Wallet</th>
                <th>Share</th>
                <th>State</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const style = STATE_STYLE[row.state];
                return (
                  <tr key={row.id}>
                    <td className="mono">{short(row.funder)}</td>
                    {/* Never $0.00 for money that exists: 375 µUSD is 0.04¢. */}
                    <td className="num">{formatMicro(row.authorMicro)}</td>
                    <td>
                      <span className={style.cls}>{style.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {data.earnings && data.earnings.length > rows.length ? (
            <p className="tiny dim" style={{ marginTop: 10, marginBottom: 0 }}>
              Showing the {rows.length} most recent of {data.earnings.length}.
            </p>
          ) : null}
        </>
      )}

      <div className="divider" />
      <p className="tiny dim" style={{ margin: 0 }}>
        Fee is {data.feeBps ?? 25} bps of each mirror, of which the author gets{' '}
        {data.sharePct ?? 60}%. A <strong>forecast</strong> is not money: it
        becomes withdrawable only once the fills settle and we can read what was actually charged.
        Payouts are USDC from the integrator balance.
      </p>
    </div>
  );
}

export default EarningsPanel;
