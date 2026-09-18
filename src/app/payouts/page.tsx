'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * The operator queue: who is owed what, and the two-step payout.
 *
 * Deliberately split into two clicks, because settling is an irreversible
 * bookkeeping act that marks real money as sent:
 *
 *   prepare → shows the exact USDC transfer and what it will cost in gas
 *   settle  → records that it happened, behind the operator token when armed
 *
 * A single "Pay" button would let one misclick invent a payment record.
 */

interface QueueRow {
  author: string;
  payableMicro: number;
  payable: string;
  estimated: string;
  claimed: string;
  records: number;
  plans: number;
}

interface PrepareResult {
  ok: boolean;
  author?: string;
  amount?: string;
  amountMicro?: number;
  tx?: { to: string; data: string; amountBaseUnits: string; chain: string; chainId: number };
  costs?: {
    gasPriceGwei?: number;
    gasUnits?: string;
    ethUsd?: number;
    estimatedGasUsd?: number | null;
    uneconomic?: boolean;
    note?: string;
  };
  covers?: { id: string; orderId: string; authorMicro: number }[];
  excludes?: { id: string; amount: string; reason: string }[];
  note?: string;
  error?: string;
}

const short = (address: string) =>
  address && address.length > 10 ? `${address.slice(0, 10)}…${address.slice(-6)}` : address || '—';

export default function PayoutsPage() {
  const [queue, setQueue] = useState<QueueRow[] | null>(null);
  const [total, setTotal] = useState<string>('—');
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [prepared, setPrepared] = useState<PrepareResult | null>(null);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [settled, setSettled] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/earnings?queue=1', { cache: 'no-store' });
      const payload = (await response.json()) as {
        ok: boolean;
        queue?: QueueRow[];
        totalPayable?: string;
        error?: string;
      };
      if (!response.ok || !payload.ok) {
        setError(payload.error ?? 'Could not read the ledger.');
      } else {
        setQueue(payload.queue ?? []);
        setTotal(payload.totalPayable ?? '$0.00');
        setError(null);
      }
    } catch {
      setError('Could not reach the ledger.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function prepare(author: string) {
    setBusy(true);
    setSelected(author);
    setSettled(null);
    setPrepared(null);
    try {
      const response = await fetch('/api/earnings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'prepare', author }),
      });
      setPrepared((await response.json()) as PrepareResult);
    } catch {
      setPrepared({ ok: false, error: 'Prepare failed.' });
    } finally {
      setBusy(false);
    }
  }

  async function settle(author: string) {
    setBusy(true);
    try {
      const response = await fetch('/api/earnings', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(token ? { 'x-nightdesk-operator': token } : {}),
        },
        body: JSON.stringify({ action: 'settle', author }),
      });
      const payload = (await response.json()) as { ok: boolean; total?: string; error?: string; note?: string };
      if (!response.ok || !payload.ok) {
        setError(payload.error ?? 'Settle refused.');
      } else {
        setSettled(payload.total ?? payload.note ?? 'Recorded.');
        setPrepared(null);
        setSelected(null);
        await load();
      }
    } catch {
      setError('Settle failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <main className="shell">
        <section className="section">
          <div className="spread" style={{ marginBottom: 6 }}>
            <h1 style={{ margin: 0 }}>Payouts</h1>
            <span className="pill accent">Operator</span>
          </div>
          <p className="lede" style={{ maxWidth: '68ch' }}>
            Flash pays one integrator per order — this deployment — so the author share is settled
            from here as a plain USDC transfer, against obligations recorded in the ledger.
          </p>

          <div className="card" style={{ marginTop: 18 }}>
            <div className="spread">
              <div>
                <p className="eyebrow" style={{ margin: 0 }}>
                  Owed across all authors
                </p>
                <p className="big-num" style={{ margin: '4px 0 0' }}>
                  {total}
                </p>
              </div>
              <button className="button" onClick={() => void load()} disabled={busy}>
                Refresh
              </button>
            </div>
          </div>

          {error ? (
            <div className="notice" style={{ marginTop: 14 }}>
              {error}
            </div>
          ) : null}

          {settled ? (
            <div className="notice" style={{ marginTop: 14 }}>
              Recorded as paid: <strong>{settled}</strong>
            </div>
          ) : null}

          <h2 style={{ marginTop: 26 }}>Queue</h2>
          <p className="tiny dim" style={{ maxWidth: '62ch' }}>
            Largest debt first. Only <strong>settled fills</strong> appear here — a plan whose order
            has not settled shows a forecast on the plan page and nothing on this queue, because
            there is no collected fee to share yet.
          </p>

          {queue === null ? (
            <p className="tiny dim">Reading the ledger…</p>
          ) : queue.length === 0 ? (
            <div className="card card-tight" style={{ marginTop: 12 }}>
              <p className="tiny dim" style={{ margin: 0 }}>
                Nothing payable. Either no plan has been mirrored, or no mirror has settled yet.
              </p>
            </div>
          ) : (
            <table className="table" style={{ marginTop: 12 }}>
              <thead>
                <tr>
                  <th>Author</th>
                  <th>Payable</th>
                  <th>Forecast</th>
                  <th>Paid</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {queue.map(row => (
                  <tr key={row.author}>
                    <td className="mono">{short(row.author)}</td>
                    <td className="num">{row.payable}</td>
                    <td className="num dim">{row.estimated}</td>
                    <td className="num dim">{row.claimed}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="button"
                        disabled={busy}
                        onClick={() => void prepare(row.author)}
                      >
                        Prepare
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {prepared ? (
          <section className="section">
            <h2>Step 2 — broadcast, then record</h2>

            {!prepared.ok ? (
              <div className="notice">{prepared.error ?? 'Prepare failed.'}</div>
            ) : prepared.amountMicro === 0 ? (
              <div className="notice">{prepared.note ?? 'Nothing payable yet.'}</div>
            ) : (
              <div className="card">
                <div className="grid grid-2">
                  <div>
                    <p className="tiny dim" style={{ margin: 0 }}>
                      Send to
                    </p>
                    <p className="mono" style={{ margin: '2px 0 0' }}>
                      {short(prepared.tx?.to ?? '')}
                    </p>
                    <p className="tiny dim" style={{ margin: '2px 0 0' }}>
                      USDC on {prepared.tx?.chain}
                    </p>
                  </div>
                  <div>
                    <p className="tiny dim" style={{ margin: 0 }}>
                      Amount
                    </p>
                    <p className="big-num" style={{ margin: '2px 0 0', color: 'var(--good)' }}>
                      {prepared.amount}
                    </p>
                    <p className="tiny dim" style={{ margin: '2px 0 0' }}>
                      {prepared.tx?.amountBaseUnits} base units
                    </p>
                  </div>
                </div>

                <div className="divider" />

                <p className="eyebrow" style={{ margin: 0 }}>
                  Transaction
                </p>
                <pre
                  className="mono tiny"
                  style={{
                    overflowX: 'auto',
                    background: 'var(--bg-soft)',
                    padding: 12,
                    borderRadius: 8,
                    margin: '8px 0 0',
                  }}
                >
{prepared.tx?.data}
                </pre>

                <div className="divider" />

                <div className="grid grid-3">
                  <div>
                    <p className="tiny dim" style={{ margin: 0 }}>
                      Gas
                    </p>
                    <p className="num" style={{ margin: '2px 0 0' }}>
                      {prepared.costs?.estimatedGasUsd != null
                        ? `$${prepared.costs.estimatedGasUsd.toFixed(6)}`
                        : 'unknown'}
                    </p>
                  </div>
                  <div>
                    <p className="tiny dim" style={{ margin: 0 }}>
                      Gas price
                    </p>
                    <p className="num" style={{ margin: '2px 0 0' }}>
                      {prepared.costs?.gasPriceGwei != null
                        ? `${prepared.costs.gasPriceGwei} gwei`
                        : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="tiny dim" style={{ margin: 0 }}>
                      Covers
                    </p>
                    <p className="num" style={{ margin: '2px 0 0' }}>
                      {prepared.covers?.length ?? 0} settled
                      {prepared.covers?.length === 1 ? ' fill' : ' fills'}
                    </p>
                  </div>
                </div>

                {prepared.costs?.uneconomic ? (
                  <div className="notice" style={{ marginTop: 14 }}>
                    <strong>Uneconomic.</strong> This payout is smaller than the gas to send it.
                    Leave it on the ledger and pay it once more mirrors settle — better a later
                    payment than one that costs more than it delivers.
                  </div>
                ) : null}

                {prepared.costs?.note ? (
                  <p className="tiny dim" style={{ marginTop: 10, marginBottom: 0 }}>
                    {prepared.costs.note}
                  </p>
                ) : null}

                {prepared.excludes && prepared.excludes.length > 0 ? (
                  <>
                    <div className="divider" />
                    <p className="eyebrow" style={{ margin: 0 }}>
                      Not included
                    </p>
                    <ul className="tiny dim" style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                      {prepared.excludes.slice(0, 5).map(row => (
                        <li key={row.id}>
                          {row.amount} — {row.reason}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}

                <div className="divider" />

                <p className="tiny dim" style={{ maxWidth: '62ch' }}>
                  Broadcast the transaction above from the integrator wallet, then record it. The
                  record is irreversible: settling marks the whole payable balance for{' '}
                  {short(prepared.author ?? '')} as paid.
                </p>

                <div className="inline-fields" style={{ marginTop: 12, alignItems: 'flex-end' }}>
                  <label className="field" style={{ flex: 1 }}>
                    <span className="label">Operator token (only required when armed)</span>
                    <input
                      className="input"
                      type="password"
                      value={token}
                      onChange={event => setToken(event.target.value)}
                      placeholder="x-nightdesk-operator"
                    />
                  </label>
                  <button
                    className="button"
                    disabled={busy || !prepared.author}
                    onClick={() => void settle(prepared.author!)}
                  >
                    Record as paid
                  </button>
                </div>
              </div>
            )}
          </section>
        ) : selected && busy ? (
          <section className="section">
            <p className="tiny dim">Preparing…</p>
          </section>
        ) : null}

        <footer className="footer">
          <span>
            The author ledger is a record of obligation, not a contract: Flash pays one integrator
            per order and cannot split a fee across authors.
          </span>
        </footer>
      </main>
    </>
  );
}
