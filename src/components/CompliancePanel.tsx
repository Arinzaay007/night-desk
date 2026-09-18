'use client';

import { useEffect, useState } from 'react';

/**
 * Did the mirrors actually run the plan?
 *
 * This is the panel that turns "3 wallets mirrored this" — a claim — into
 * "3 wallets ran it as published" — a fact read back from the exchange.
 *
 * It is deliberately careful about what it claims. It does NOT say people were
 * made to follow the plan, because nothing makes them; a mirror is its own
 * independent position and that is the whole point of the product. What it
 * says is narrower and checkable: the protection resting on Flash matches the
 * levels this plan asked for.
 *
 * Backed by /api/proof, which fetches the orders anyway.
 */

interface Verdict {
  status: 'published' | 'deviated' | 'unprotected' | 'unknown';
  takeProfitDeviationPct: number | null;
  stopLossDeviationPct: number | null;
  summary: string;
  checks: { name: string; expected: string; actual: string; ok: boolean; skipped?: boolean }[];
}

interface Summary {
  total: number;
  published: number;
  deviated: number;
  unprotected: number;
  unknown: number;
  ratePct: number | null;
}

interface ProofRow {
  funder: string;
  verified: boolean;
  compliance?: Verdict;
}

interface Payload {
  ok: boolean;
  mirrors: number;
  compliance?: Summary;
  revenue?: { integratorFeeMicro: number; fills: number };
  proof?: ProofRow[];
}

const short = (a: string) => (a && a.length > 10 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a || '—');

/**
 * Micro-USD for humans, without ever lying about a nonzero amount. A 375 µUSD
 * fee shown as "$0.00" reads as "this earns nothing", which is the opposite of
 * what the panel is there to demonstrate.
 */
const micro = (value: number) => {
  const usd = Math.abs(value) / 1_000_000;
  if (usd === 0) return '$0.00';
  if (usd < 0.01) return `${(usd * 100).toFixed(2)}¢`;
  if (usd < 1) return `$${usd.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}`;
  return `$${usd.toFixed(2)}`;
};

const PILL: Record<Verdict['status'], { label: string; cls: string }> = {
  published: { label: 'as published', cls: 'pill good' },
  deviated: { label: 'deviated', cls: 'pill bad' },
  unprotected: { label: 'unprotected', cls: 'pill bad' },
  unknown: { label: 'unread', cls: 'pill' },
};

export function CompliancePanel({ planKey }: { planKey: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/proof?planKey=${encodeURIComponent(planKey)}`, {
          cache: 'no-store',
        });
        const payload = (await response.json()) as Payload;
        if (cancelled) return;
        if (!response.ok || !payload.ok) setError('Could not read the mirrors back.');
        else setData(payload);
      } catch {
        if (!cancelled) setError('Could not reach the exchange.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [planKey]);

  if (error) {
    return (
      <div className="card card-tight">
        <p className="tiny dim" style={{ margin: 0 }}>
          {error} The plan still works — this readout is a check on it, not a dependency of it.
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="card card-tight">
        <p className="tiny dim" style={{ margin: 0 }}>
          Reading the mirrors back from the exchange…
        </p>
      </div>
    );
  }

  const rows = (data.proof ?? []).filter(p => p.verified);
  const summary = data.compliance;

  if (!summary || summary.total === 0) {
    return (
      <div className="card card-tight">
        <p className="tiny dim" style={{ margin: 0 }}>
          Nobody has run this plan yet. When someone does, this panel compares the protection that
          landed on the exchange against the levels above — so you can check, rather than take it on
          trust.
        </p>
      </div>
    );
  }

  const allPublished = summary.published === summary.total;
  const judgeable = summary.total - summary.unknown;

  return (
    <div className="card">
      <div className="spread" style={{ marginBottom: 12 }}>
        <div>
          <p className="eyebrow" style={{ margin: 0 }}>
            Ran as published
          </p>
          <p
            className="big-num"
            style={{
              margin: '4px 0 0',
              color: allPublished ? 'var(--good)' : undefined,
            }}
          >
            {summary.ratePct === null ? '—' : `${Math.round(summary.ratePct)}%`}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p className="eyebrow" style={{ margin: 0 }}>
            Mirrors
          </p>
          <p className="big-num" style={{ margin: '4px 0 0' }}>
            {summary.total}
          </p>
        </div>
      </div>

      <p className="tiny dim" style={{ margin: '0 0 4px' }}>
        {summary.published} of {judgeable} judgeable{' '}
        {judgeable === 1 ? 'mirror ran' : 'mirrors ran'} with the protection this plan asked for,
        read back from the exchange.
        {summary.unknown > 0 ? ` ${summary.unknown} could not be read yet.` : ''}
      </p>

      <div className="divider" />

      <table className="table">
        <thead>
          <tr>
            <th>Wallet</th>
            <th>Protection</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const verdict = row.compliance;
            if (!verdict) return null;
            const pill = PILL[verdict.status];
            const isOpen = open === row.funder;
            return (
              <>
                <tr key={row.funder}>
                  <td className="mono">{short(row.funder)}</td>
                  <td>
                    <span className={pill.cls}>{pill.label}</span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="button ghost small"
                      onClick={() => setOpen(isOpen ? null : row.funder)}
                    >
                      {isOpen ? 'Hide' : 'Checks'}
                    </button>
                  </td>
                </tr>
                {isOpen ? (
                  <tr key={`${row.funder}-detail`}>
                    <td colSpan={3} style={{ paddingTop: 0 }}>
                      <p className="tiny" style={{ margin: '4px 0 0' }}>
                        {verdict.summary}
                      </p>
                      <ul className="tiny dim" style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                        {verdict.checks.map(c => (
                          <li key={c.name}>
                            <span style={{ color: c.skipped ? undefined : c.ok ? 'var(--good)' : 'var(--bad)' }}>
                              {c.skipped ? '·' : c.ok ? '✓' : '✗'}
                            </span>{' '}
                            {c.name}
                            {!c.skipped ? (
                              <span className="dim">
                                {' '}
                                — wanted {c.expected}, got {c.actual}
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                ) : null}
              </>
            );
          })}
        </tbody>
      </table>

      <div className="divider" />

      {data.revenue && data.revenue.fills > 0 ? (
        <div style={{ marginBottom: 12 }}>
          <p className="eyebrow" style={{ margin: 0 }}>
            Revenue from this plan&rsquo;s execution
          </p>
          <p className="num" style={{ margin: '4px 0 0', color: 'var(--good)' }}>
            {micro(data.revenue.integratorFeeMicro)}
          </p>
          <p className="tiny dim" style={{ margin: '2px 0 0' }}>
            integrator fee, read off {data.revenue.fills} settled{' '}
            {data.revenue.fills === 1 ? 'fill' : 'fills'} — 60% of it is credited to the plan author
          </p>
        </div>
      ) : null}

      <p className="tiny dim" style={{ margin: 0 }}>
        Read back from the exchange, not self-reported. This is a <strong>readout, not a
        control</strong> — nothing makes anyone follow a plan, and a mirror that deviates is still
        their own position. That independence is the product, not a flaw in it.
      </p>
    </div>
  );
}

export default CompliancePanel;
