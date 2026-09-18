'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Header } from '@/components/Header';
import { PlanForm } from '@/components/PlanForm';
import { CompliancePanel } from '@/components/CompliancePanel';
import { EarningsPanel } from '@/components/EarningsPanel';
import { ProofPanel } from '@/components/ProofPanel';
import { WalletBar } from '@/components/WalletBar';
import { shortAddress, usd } from '@/lib/format';
import { decodePlan, planKey, type Plan } from '@/lib/plan';
import { useWallet } from '@/lib/useWallet';

/**
 * The plan link — the whole social layer.
 *
 * The plan is encoded into the URL, so a link is permanent and never depends
 * on a server row existing.
 */
export default function PlanPage() {
  const params = useParams<{ id: string }>();
  const wallet = useWallet();
  const [price, setPrice] = useState<number | null>(null);
  const [mirrorCount, setMirrorCount] = useState<number | null>(null);

  const decoded = useMemo(() => {
    if (!params?.id) return { errors: ['No plan in this link.'] };
    return decodePlan(Array.isArray(params.id) ? params.id[0] : params.id);
  }, [params?.id]);

  const plan: Plan | undefined = decoded.plan;

  useEffect(() => {
    if (!plan) return;
    fetch('/api/assets')
      .then(r => r.json())
      .then((payload: { ok?: boolean; assets?: { symbol: string; price: number }[] }) => {
        const match = payload.assets?.find(a => a.symbol === plan.s);
        if (match?.price) setPrice(match.price);
      })
      .catch(() => undefined);
  }, [plan]);

  const planKeyValue = useMemo(() => (plan ? planKey(plan) : ''), [plan]);

  useEffect(() => {
    if (!planKeyValue) return;
    fetch(`/api/plans?planKey=${planKeyValue}`)
      .then(r => r.json())
      .then((payload: { ok?: boolean; plans?: unknown[] }) => {
        setMirrorCount(payload.plans?.length ? (payload.plans[0] as { mirrors: number }).mirrors : 0);
      })
      .catch(() => undefined);
  }, [planKeyValue]);

  if (!plan) {
    return (
      <>
        <Header />
        <main className="shell">
          <section className="hero">
            <h1 style={{ fontSize: 32 }}>That plan link is not readable.</h1>
            <p>{decoded.errors.join(' ')}</p>
            <Link className="button" href="/create">
              Compose a plan instead
            </Link>
          </section>
        </main>
      </>
    );
  }

  const levels = price
    ? {
        tp: price * (1 + plan.tp / 100),
        sl: price * (1 - plan.sl / 100),
      }
    : null;

  return (
    <>
      <Header />
      <main className="shell">
        <section style={{ padding: '40px 0 22px' }}>
          <div className="spread" style={{ alignItems: 'flex-start' }}>
            <div>
              <p className="eyebrow">A published plan</p>
              <h1 style={{ fontSize: 34 }}>
                {plan.s} · {plan.e === 'limit' ? `limit ${usd(plan.lp ?? 0)}` : 'market entry'}
              </h1>
              <p className="lede" style={{ fontSize: 16 }}>
                {plan.m ? `“${plan.m}” — ` : ''}
                published by <span className="mono">{plan.n ?? shortAddress(plan.a)}</span>
                {mirrorCount !== null && (
                  <>
                    {' '}
                    · <span className="mono">{mirrorCount}</span> wallet
                    {mirrorCount === 1 ? '' : 's'} mirrored
                  </>
                )}
              </p>
            </div>
            <span className="pill accent">
              <span className="dot" />
              base · usdc
            </span>
          </div>
        </section>

        <section className="section" style={{ paddingTop: 8 }}>
          <div className="card">
            <div className="grid grid-3">
              <div>
                <p className="tiny dim" style={{ margin: 0 }}>
                  Size per mirror
                </p>
                <p className="big-num" style={{ margin: '4px 0 0' }}>
                  {plan.z}%
                </p>
                <p className="tiny dim" style={{ margin: '4px 0 0' }}>
                  of each mirroring wallet
                </p>
              </div>
              <div>
                <p className="tiny dim" style={{ margin: 0 }}>
                  Take-profit
                </p>
                <p className="big-num" style={{ margin: '4px 0 0', color: 'var(--good)' }}>
                  +{plan.tp}%
                </p>
                <p className="tiny dim" style={{ margin: '4px 0 0' }}>
                  {levels ? `${usd(levels.tp)} at today's price` : 'levels set at mirror time'}
                </p>
              </div>
              <div>
                <p className="tiny dim" style={{ margin: 0 }}>
                  Stop-loss
                </p>
                <p className="big-num" style={{ margin: '4px 0 0', color: 'var(--bad)' }}>
                  −{plan.sl}%
                </p>
                <p className="tiny dim" style={{ margin: '4px 0 0' }}>
                  {levels ? `${usd(levels.sl)} at today's price` : 'levels set at mirror time'}
                </p>
              </div>
            </div>
            <div className="divider" />
            <p className="tiny dim" style={{ marginBottom: 0 }}>
              Levels move with the live price at the moment you mirror, because your bracket is your
              own order. That is deliberate: two mirrors opened an hour apart are two independent
              positions, not one shared trade.
            </p>
          </div>
        </section>

        <section className="section">
          <div className="spread" style={{ marginBottom: 14 }}>
            <h2 style={{ margin: 0 }}>Mirror it</h2>
            <WalletBar wallet={wallet} />
          </div>
          <PlanForm mode="mirror" wallet={wallet} initial={plan} authorLabel={shortAddress(plan.a)} />
        </section>

        <section className="section">
          <h2>Did they run it?</h2>
          <p className="tiny dim" style={{ maxWidth: '62ch' }}>
            Every mirror is an order on the exchange, so we can read back what actually landed and
            compare it against the levels above. Anything else is just a claim.
          </p>
          <div style={{ marginTop: 14 }}>
            <CompliancePanel planKey={planKeyValue} />
          </div>
        </section>

        <section className="section">
          <h2>What the author earns</h2>
          <p className="tiny dim" style={{ maxWidth: '62ch' }}>
            Every mirror of this plan carries a small integrator fee, and the person who wrote the
            plan gets a cut of it — the one part of a shared plan that pays its author.
          </p>
          <div style={{ marginTop: 14 }}>
            <EarningsPanel author={plan.a} />
          </div>
        </section>

        <section className="section">
          <h2>Proof</h2>
          <p className="tiny dim" style={{ maxWidth: '62ch' }}>
            Fills and transaction hashes for every wallet that mirrored this plan, read back from the
            exchange.
          </p>
          <div style={{ marginTop: 14 }}>
            <ProofPanel planKey={planKeyValue} />
          </div>
        </section>

        <footer className="footer">
          <span>
            Execution by Definitive Flash advanced orders on Base. Not financial advice.
          </span>
          <Link className="link" href="/board">
            See the board →
          </Link>
        </footer>
      </main>
    </>
  );
}
