'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Header } from '@/components/Header';
import { Steps } from '@/components/Steps';
import { WalletBar } from '@/components/WalletBar';
import { cancelOpenOrder, closePosition, type ProgressStep } from '@/lib/execute';
import { explorerTx, relativeTime, statusLabel, usd } from '@/lib/format';
import { isCancellable } from '@/lib/orders';
import type { FlashGetOrderResponse, FlashOrder } from '@/lib/types';
import { useWallet } from '@/lib/useWallet';

interface Entry {
  order: FlashOrder;
  /** The protective pair, if this order carried one. */
  bracket?: FlashOrder;
}

export default function DeskPage() {
  const wallet = useWallet();
  const [orders, setOrders] = useState<FlashOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'good' | 'warn' | 'bad'; text: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [steps, setSteps] = useState<ProgressStep[]>([]);
  const [fills, setFills] = useState<Record<string, FlashGetOrderResponse>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    if (!wallet.address) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/orders?funder=${wallet.address}`);
      const payload = (await response.json()) as { ok?: boolean; orders?: FlashOrder[]; error?: string };
      if (!payload.ok) throw new Error(payload.error ?? 'Could not load orders.');
      setOrders(payload.orders ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load orders.');
    } finally {
      setLoading(false);
    }
  }, [wallet.address]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Group bracket legs under the entry they protect.
   *
   * Flash models the protective pair as its own order with its own id and a
   * `sourceEntryOrderId` pointing back at the entry. Listing them flat would
   * double-count every position and make the desk confusing, which matters most
   * when the entry filled and the pair is now live.
   */
  const entries = useMemo<Entry[]>(() => {
    const legsById = new Map<string, FlashOrder>();
    for (const order of orders) {
      if (order.sourceEntryOrderId) legsById.set(order.orderId, order);
    }
    return orders
      .filter(order => !order.sourceEntryOrderId)
      .map(order => ({
        order,
        bracket: order.attachedBracket?.bracketOrderId
          ? legsById.get(order.attachedBracket.bracketOrderId)
          : undefined,
      }));
  }, [orders]);

  const loadFills = async (orderId: string) => {
    if (!wallet.address) return;
    setExpanded(prev => ({ ...prev, [orderId]: !prev[orderId] }));
    if (fills[orderId]) return;
    try {
      const response = await fetch(`/api/orders?funder=${wallet.address}&orderId=${orderId}`);
      const payload = (await response.json()) as { ok?: boolean; order?: FlashGetOrderResponse };
      if (payload.order) setFills(prev => ({ ...prev, [orderId]: payload.order! }));
    } catch {
      /* fills are a nicety */
    }
  };

  const onCancel = async (orderId: string) => {
    if (!wallet.signer) return;
    setBusyId(orderId);
    setNotice(null);
    setSteps([]);
    try {
      await cancelOpenOrder(orderId, wallet.signer);
      setNotice({ kind: 'good', text: `Order ${orderId.slice(0, 8)} cancelled.` });
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Cancel failed.';
      // A raced fill is not a failure — say so plainly.
      setNotice({ kind: /filled before the cancel/i.test(message) ? 'warn' : 'bad', text: message });
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const onClose = async (order: FlashOrder, bracketOrderId?: string) => {
    if (!wallet.signer) return;
    setBusyId(order.orderId);
    setNotice(null);
    setSteps([]);
    try {
      const result = await closePosition(
        order.targetAsset.address,
        order.targetAsset.ticker,
        wallet.signer,
        bracketOrderId ? [bracketOrderId] : [],
        setSteps,
      );
      setNotice({
        kind: result.warnings.length ? 'warn' : 'good',
        text: result.warnings.length
          ? `Position sold (exit ${result.orderId.slice(0, 8)}). ${result.warnings.join(' ')}`
          : `Position sold into USDC (exit ${result.orderId.slice(0, 8)}) and the protective pair was cancelled.`,
      });
      await Promise.all([load(), wallet.refreshBalance()]);
    } catch (err) {
      setNotice({ kind: 'bad', text: err instanceof Error ? err.message : 'Close failed.' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <Header />
      <main className="shell">
        <section style={{ padding: '40px 0 20px' }}>
          <p className="eyebrow">My desk</p>
          <div className="spread">
            <h1 style={{ fontSize: 34, marginBottom: 6 }}>Positions, protection, exits.</h1>
            <WalletBar wallet={wallet} />
          </div>
          <p className="lede" style={{ fontSize: 16 }}>
            Read back from the exchange, per funder. Each entry is shown with the protective pair it
            carried, because Flash treats the pair as its own order.
          </p>
        </section>

        <section className="section" style={{ paddingTop: 10 }}>
          <div className="spread" style={{ marginBottom: 14 }}>
            <h2 style={{ margin: 0 }}>
              {entries.length > 0 && <span className="dim mono tiny">{entries.length} entries · </span>}
              <span className="dim mono tiny">{orders.length} orders</span>
            </h2>
            <div className="row">
              <button
                className="button ghost small"
                onClick={() => void load()}
                disabled={!wallet.address || loading}
              >
                {loading ? 'Refreshing…' : 'Refresh'}
              </button>
              <Link className="button secondary small" href="/create">
                Compose a plan
              </Link>
            </div>
          </div>

          {notice && (
            <div className={`notice ${notice.kind === 'good' ? 'good' : notice.kind === 'warn' ? 'warn' : 'bad'}`} style={{ marginBottom: 14 }}>
              {notice.text}
            </div>
          )}

          {steps.length > 0 && (
            <div className="card card-tight" style={{ marginBottom: 14 }}>
              <Steps steps={steps} />
            </div>
          )}

          {error && <div className="notice bad">{error}</div>}

          {!wallet.address && (
            <div className="card">
              <p style={{ marginBottom: 0 }}>Connect a wallet to see its orders and brackets.</p>
            </div>
          )}

          {wallet.address && !loading && !error && entries.length === 0 && (
            <div className="card">
              <p style={{ marginBottom: 10 }}>No orders yet for this wallet.</p>
              <Link className="button small" href="/create">
                Compose your first plan
              </Link>
            </div>
          )}

          <div className="grid" style={{ gap: 12 }}>
            {entries.map(({ order, bracket }) => {
              const isProtected = Boolean(order.attachedBracket);
              const filled = order.filled;
              const hasPosition = Number(filled?.targetAmount ?? 0) > 0;
              const open = isCancellable(order.status);
              const isBusy = busyId === order.orderId;
              const bracketLive = bracket ? isCancellable(bracket.status) : false;

              return (
                <div className="card card-tight" key={order.orderId}>
                  <div className="spread">
                    <div className="row">
                      <strong className="mono">{order.targetAsset?.ticker ?? '—'}</strong>
                      <span className="pill">{statusLabel(order.status)}</span>
                      <span className="pill">{order.orderType}</span>
                      {isProtected ? (
                        <span className="pill good" title={`Pair status: ${bracket?.status ?? 'unknown'}`}>
                          <span className="dot" />
                          {(order.attachedBracket?.status ?? '').replace(/_/g, ' ')}
                        </span>
                      ) : (
                        <span className="pill bad">unprotected</span>
                      )}
                    </div>
                    <span className="tiny dim">
                      {order.acceptedAt || order.placedAt
                        ? relativeTime(Date.parse(order.acceptedAt ?? order.placedAt ?? ''))
                        : ''}
                    </span>
                  </div>

                  <div className="grid grid-3" style={{ marginTop: 14, gap: 10 }}>
                    <div>
                      <p className="tiny dim" style={{ margin: 0 }}>
                        Spend
                      </p>
                      <p className="num" style={{ margin: '3px 0 0' }}>
                        {usd(order.qty)} USDC
                      </p>
                    </div>
                    <div>
                      <p className="tiny dim" style={{ margin: 0 }}>
                        Filled
                      </p>
                      <p className="num" style={{ margin: '3px 0 0' }}>
                        {filled?.targetAmount
                          ? `${Number(filled.targetAmount).toFixed(6)} @ ${usd(filled.averageNotionalPrice ?? 0)}`
                          : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="tiny dim" style={{ margin: 0 }}>
                        Protection
                      </p>
                      <p className="num" style={{ margin: '3px 0 0' }}>
                        {order.attachedBracket?.takeProfit?.notionalPrice
                          ? usd(order.attachedBracket.takeProfit.notionalPrice)
                          : '—'}{' '}
                        /{' '}
                        {order.attachedBracket?.stopLoss?.notionalPrice
                          ? usd(order.attachedBracket.stopLoss.notionalPrice)
                          : '—'}
                      </p>
                    </div>
                  </div>

                  {bracket && (
                    <p className="tiny dim" style={{ marginTop: 10, marginBottom: 0 }}>
                      Protective pair is its own order{' '}
                      <span className="mono">{bracket.orderId.slice(0, 8)}</span> ·{' '}
                      {statusLabel(bracket.status)} · capped at {bracket.qty} {bracket.contraAsset?.ticker}
                      {bracketLive ? ' · live' : ''}
                    </p>
                  )}

                  <div className="row" style={{ marginTop: 12 }}>
                    <button className="button ghost small" onClick={() => void loadFills(order.orderId)}>
                      {expanded[order.orderId] ? 'Hide fills' : 'Show fills'}
                    </button>

                    {open && (
                      <button
                        className="button secondary small"
                        disabled={isBusy}
                        onClick={() => void onCancel(order.orderId)}
                      >
                        {isBusy ? 'Cancelling…' : 'Cancel order'}
                      </button>
                    )}

                    {hasPosition && (
                      <button
                        className="button small"
                        disabled={isBusy}
                        onClick={() => void onClose(order, bracket?.orderId)}
                        title="Sell the whole balance into USDC, then cancel the protective pair"
                      >
                        {isBusy ? 'Closing…' : 'Close position'}
                      </button>
                    )}

                    <span className="tiny dim mono">{order.orderId.slice(0, 8)}</span>
                  </div>

                  {expanded[order.orderId] && (
                    <div style={{ marginTop: 12 }}>
                      <div className="divider" />
                      {(fills[order.orderId]?.fills ?? []).length === 0 ? (
                        <p className="tiny dim" style={{ marginBottom: 0 }}>
                          No fills recorded yet.
                        </p>
                      ) : (
                        (fills[order.orderId].fills ?? []).map((fill, index) => (
                          <div className="kv" key={fill.orderId ?? index}>
                            <dt>
                              {fill.filledAt ? relativeTime(Date.parse(fill.filledAt)) : 'fill'}
                              {fill.venues?.length ? ` · ${fill.venues.slice(0, 2).join(', ')}` : ''}
                            </dt>
                            <dd>
                              {usd(fill.notional ?? 0)}
                              {fill.integratorFeeAmount && Number(fill.integratorFeeAmount) > 0 && (
                                <span className="dim tiny"> · fee {fill.integratorFeeAmount} {fill.feeTicker}</span>
                              )}
                              {fill.transactionId && (
                                <>
                                  {' '}
                                  <a
                                    className="link tiny"
                                    href={explorerTx(fill.transactionId)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    tx
                                  </a>
                                </>
                              )}
                            </dd>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <p className="tiny dim" style={{ marginTop: 18 }}>
            Closing a position sells the wallet&apos;s whole balance into USDC and then cancels the
            protective pair — Flash cancels a pair separately from its entry, so leaving it behind
            would strand a live order. Cancelling an order only affects orders that have not filled;
            once an entry has filled at all, its pair stays live.
          </p>
        </section>
      </main>
    </>
  );
}
