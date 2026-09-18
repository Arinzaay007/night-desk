'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Clock,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  TrendingUp,
  Users,
  Zap,
  Gauge as GaugeIcon,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Reveal } from '@/components/design/Reveal';
import { Eyebrow } from '@/components/design/Section';
import { Gauge } from '@/components/design/Charts';
import { PlanForm } from '@/components/PlanForm';
import { WalletBar } from '@/components/WalletBar';
import { EarningsPanel } from '@/components/EarningsPanel';
import { shortAddress } from '@/lib/format';
import { decodePlan, planKey, type Plan } from '@/lib/plan';
import { useWallet } from '@/lib/useWallet';
import { usd, usdCompact, relativeTime, microUsd } from '@/lib/df-format';

/* ------------------------------------------------------------------ */
/* shapes                                                              */
/* ------------------------------------------------------------------ */

interface Fill {
  notional: string;
  fillPrice: string;
  filledAt: string;
  txHash: string;
  integratorFee: string;
  feeTicker: string;
  venues?: string[];
}

interface EntryRow {
  orderId: string;
  status: string;
  ticker?: string;
  filledTarget?: string;
  averagePrice?: string;
  placedAt?: string;
  bracketStatus?: string;
  takeProfit?: string;
  stopLoss?: string;
  fills?: Fill[];
}

interface BracketRow {
  orderId: string;
  status: string;
  closeReason?: string | null;
}

interface ComplianceCheck {
  name: string;
  expected: string;
  actual: string;
  ok: boolean;
  skipped?: boolean;
}

interface MirrorProof {
  funder: string;
  spendUsd: number;
  createdAt: number;
  verified: boolean;
  entry?: EntryRow;
  bracket?: BracketRow;
  compliance?: {
    status: 'published' | 'deviated' | 'unprotected' | 'unknown';
    takeProfitDeviationPct?: number;
    stopLossDeviationPct?: number;
    checks?: ComplianceCheck[];
  };
  pnl?: {
    status: string;
    entryCostUsd: number;
    positionValueUsd: number;
    realisedUsd: number;
    unrealisedUsd: number;
    totalPct: number;
  };
}

interface Proof {
  ok: boolean;
  mirrors: number;
  verified: number;
  currentPrice: number;
  pnl: {
    mirrors: number;
    pricedMirrors: number;
    realisedUsd: number;
    unrealisedUsd: number;
    totalUsd: number;
    investedUsd: number;
    totalPct: number;
    open: number;
    closed: number;
  };
  compliance: {
    total: number;
    published: number;
    deviated: number;
    unprotected: number;
    unknown: number;
    ratePct: number | null;
  };
  revenue: { integratorFeeMicro: number; fills: number };
  proof: MirrorProof[];
  error?: string;
}

const BADGE = 'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5';

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

/**
 * The plan link — the whole social layer.
 *
 * The plan itself is decoded from the URL and needs no server row to exist.
 * Everything *about* the plan — whether the protection landed, what it has
 * earned, what the author is owed — is read back from the exchange, so each of
 * those panels is a separate arrival and each one says so while it waits.
 */
export default function PlanPage() {
  const params = useParams<{ id: string }>();
  const wallet = useWallet();
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [proof, setProof] = useState<Proof | null>(null);
  const [proofFailed, setProofFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  const decoded = useMemo(() => {
    if (!params?.id) return { errors: ['No plan in this link.'] };
    return decodePlan(Array.isArray(params.id) ? params.id[0] : params.id);
  }, [params?.id]);

  const plan: Plan | undefined = decoded.plan;
  const planKeyValue = useMemo(() => (plan ? planKey(plan) : ''), [plan]);

  useEffect(() => {
    if (!plan) return;
    fetch('/api/assets')
      .then(r => r.json())
      .then((payload: { ok?: boolean; assets?: { symbol: string; price: number }[] }) => {
        const match = payload.assets?.find(a => a.symbol === plan.s);
        if (match?.price) setLivePrice(match.price);
      })
      .catch(() => undefined);
  }, [plan]);

  useEffect(() => {
    if (!planKeyValue) return;
    let cancelled = false;
    fetch(`/api/proof?planKey=${encodeURIComponent(planKeyValue)}`)
      .then(r => r.json())
      .then((payload: Proof) => {
        if (cancelled) return;
        if (payload?.ok) setProof(payload);
        else setProofFailed(true);
      })
      .catch(() => {
        if (!cancelled) setProofFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [planKeyValue]);

  /* ---------------------------- invalid link ---------------------------- */

  if (!plan) {
    return (
      <main className="mx-auto max-w-[1240px] px-5 py-24 sm:px-8">
        <h1 className="text-[34px] font-semibold tracking-[-0.035em] text-mist-50">
          That plan link is not readable.
        </h1>
        <ul className="mt-6 space-y-2">
          {decoded.errors.map(e => (
            <li key={e} className="text-[14px] text-rose-300">
              {e}
            </li>
          ))}
        </ul>
        <Link
          href="/create"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-ember-300 to-ember-500 px-6 py-3 text-[14px] font-semibold text-ink-950"
        >
          Compose a plan instead
        </Link>
      </main>
    );
  }

  /* ---------------------------- derived --------------------------------- */

  const tp = proof?.proof?.[0]?.entry?.takeProfit
    ? Number(proof.proof[0].entry.takeProfit)
    : null;
  const sl = proof?.proof?.[0]?.entry?.stopLoss ? Number(proof.proof[0].entry.stopLoss) : null;
  const entryPrice = proof?.proof?.[0]?.entry?.averagePrice
    ? Number(proof.proof[0].entry.averagePrice)
    : null;

  const reference = livePrice ?? proof?.currentPrice ?? null;
  const complianceRate = proof?.compliance?.ratePct ?? null;
  const complianceRows = proof?.proof ?? [];
  const checks = complianceRows[0]?.compliance?.checks ?? [];

  // The bar's geometry comes from the plan's own percentages, and the entry
  // marker sits where that entry actually fell between the two levels.
  const slPct = plan.sl;
  const tpPct = plan.tp;
  const entryMarkerPct =
    entryPrice !== null && tp !== null && sl !== null && tp > sl
      ? ((entryPrice - sl) / (tp - sl)) * 100
      : (slPct / (slPct + tpPct)) * 100;

  const unrealised = proof?.pnl?.unrealisedUsd ?? null;

  return (
    <>
      {/* ================= HERO ================= */}
      <section className="relative overflow-hidden pb-12 pt-8 sm:pt-12">
        <div className="pointer-events-none absolute inset-0">
          <img
            src="/images/hero-bg.jpg"
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover opacity-[0.34]"
            style={{
              maskImage: 'radial-gradient(ellipse 82% 68% at 42% 18%, #000 10%, transparent 78%)',
              WebkitMaskImage:
                'radial-gradient(ellipse 82% 68% at 42% 18%, #000 10%, transparent 78%)',
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, rgba(4,6,12,0.24) 0%, rgba(4,6,12,0.7) 62%, #04060c 100%)',
            }}
          />
        </div>

        <div className="relative mx-auto max-w-[1240px] px-5 sm:px-8">
          {/* breadcrumb */}
          <Reveal>
            <div className="flex flex-wrap items-center gap-2.5">
              <Link
                href="/board"
                className="group inline-flex items-center gap-1.5 rounded-full border border-white/[0.085] bg-white/[0.028] px-3 py-1.5 text-mist-400 transition-colors hover:border-white/[0.15] hover:text-mist-200"
              >
                <ArrowLeft size={10} className="transition-transform group-hover:-translate-x-0.5" />
                <span className="num text-[8px] uppercase tracking-[0.19em]">back to board</span>
              </Link>

              <span className="h-[3px] w-[3px] rounded-full bg-mist-700" />

              <span className="num text-[8px] uppercase tracking-[0.19em] text-mist-500">
                /p/{planKeyValue}
              </span>
            </div>
          </Reveal>

          <div className="mt-8 grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
            {/* plan summary */}
            <div>
              <Reveal delay={0.05}>
                <div className="flex flex-wrap items-center gap-2.5">
                  <span
                    className={`${BADGE} ${
                      proofFailed
                        ? 'border-rose-500/25 bg-rose-500/[0.08]'
                        : 'border-mint-400/24 bg-mint-400/[0.09]'
                    }`}
                  >
                    <span className="relative flex h-1.5 w-1.5">
                      {!proofFailed && (
                        <span className="absolute inline-flex h-full w-full rounded-full bg-mint-400 animate-pulse-ring" />
                      )}
                      <span
                        className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
                          proofFailed ? 'bg-rose-400' : 'bg-mint-400'
                        }`}
                      />
                    </span>
                    <span
                      className={`num text-[8px] uppercase tracking-[0.19em] ${
                        proofFailed ? 'text-rose-300' : 'text-mint-300'
                      }`}
                    >
                      {proofFailed ? 'exchange read failed' : 'plan live'}
                    </span>
                  </span>

                  <span className={`${BADGE} border-white/[0.085] bg-white/[0.028]`}>
                    <Clock size={9.5} className="text-mist-400" />
                    <span className="num text-[8px] text-mist-400">
                      published {relativeTime(plan.ts)}
                    </span>
                  </span>

                  <span className={`${BADGE} border-ember-400/22 bg-ember-400/[0.082]`}>
                    <ShieldCheck size={9.5} className="text-ember-300" />
                    <span className="num text-[8px] text-ember-200">
                      {complianceRate === null ? 'compliance reading…' : `${complianceRate}% verified`}
                    </span>
                  </span>
                </div>
              </Reveal>

              <Reveal delay={0.11}>
                <h1 className="mt-6 max-w-[17ch] text-[38px] leading-[1.01] font-semibold tracking-[-0.042em] text-mist-50 sm:text-[52px] sm:leading-[0.97]">
                  {plan.s}{' '}
                  <span className="font-serif-it text-gradient-ember">
                    {plan.e === 'limit' ? 'limit entry' : 'momentum plan'}
                  </span>
                  , fully protected.
                </h1>
              </Reveal>

              {plan.m && (
                <Reveal delay={0.17}>
                  <p className="mt-6 max-w-[58ch] text-[15px] leading-[1.82] text-mist-300 sm:text-[16.5px]">
                    &ldquo;{plan.m}&rdquo;
                  </p>
                </Reveal>
              )}

              <Reveal delay={0.2}>
                <p className="mt-5 max-w-[58ch] text-[13.5px] leading-[1.8] text-mist-400">
                  Size is a proportion of whoever opens this link, never a copy of the author&apos;s
                  position. Each mirror signs its own take-profit and stop-loss pair, so the author
                  closing their trade cannot exit anyone who mirrored it.
                </p>
              </Reveal>

              {/* author + stats */}
              <Reveal delay={0.23}>
                <div className="mt-7 flex flex-wrap items-center gap-5">
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-full bg-gradient-to-br from-ember-300 to-ember-600 shadow-[0_12px_32px_-8px_rgba(255,143,66,0.58)]" />
                    <div>
                      <div className="num text-[13px] font-medium text-mist-100">
                        {shortAddress(plan.a)}
                      </div>
                      <div className="num mt-0.5 text-[8px] uppercase tracking-[0.16em] text-mist-500">
                        plan author
                      </div>
                    </div>
                  </div>

                  <div className="h-9 w-px bg-white/[0.085]" />

                  <div className="flex flex-wrap items-center gap-x-7 gap-y-2">
                    {[
                      {
                        k: 'mirrors',
                        v: proof ? String(proof.mirrors) : '—',
                        icon: <Users size={11} />,
                      },
                      {
                        k: 'notional',
                        v: proof ? usdCompact(proof.pnl?.investedUsd ?? 0) : '—',
                        icon: <TrendingUp size={11} />,
                      },
                      {
                        k: 'open p&l',
                        v: unrealised === null ? '—' : usd(unrealised),
                        icon: <Zap size={11} />,
                      },
                    ].map(stat => (
                      <div key={stat.k} className="flex items-center gap-2">
                        <span className="text-mist-500">{stat.icon}</span>
                        <div>
                          <div className="num text-[12px] text-mist-100">{stat.v}</div>
                          <div className="num text-[7px] uppercase tracking-[0.18em] text-mist-600">
                            {stat.k}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Reveal>

              {/* level strip */}
              <Reveal delay={0.29}>
                <div className="mt-8 overflow-hidden rounded-[18px] border border-white/[0.075] bg-white/[0.021]">
                  <div className="grid grid-cols-2 gap-px bg-white/[0.022] sm:grid-cols-4">
                    {[
                      {
                        k: 'Entry',
                        v: entryPrice !== null ? usd(entryPrice) : '—',
                        sub: `${plan.e === 'limit' ? 'limit · GTC' : 'market'}${
                          entryPrice === null ? ' · awaiting fill' : ''
                        }`,
                        tone: 'text-mist-50',
                      },
                      {
                        k: 'Take-profit',
                        v: tp !== null ? usd(tp) : '—',
                        sub: `+${plan.tp}%`,
                        tone: 'text-mint-200',
                      },
                      {
                        k: 'Stop-loss',
                        v: sl !== null ? usd(sl) : '—',
                        sub: `−${plan.sl}%`,
                        tone: 'text-rose-200',
                      },
                      {
                        k: 'Size',
                        v: `${plan.z}%`,
                        sub: 'of wallet',
                        tone: 'text-ember-200',
                      },
                    ].map(cell => (
                      <div key={cell.k} className="bg-ink-900/52 px-5 py-5">
                        <div className="num text-[7.5px] uppercase tracking-[0.21em] text-mist-500">
                          {cell.k}
                        </div>
                        <div className={`mt-2 num text-[19px] tracking-[-0.032em] ${cell.tone}`}>
                          {cell.v}
                        </div>
                        <div className="mt-1 num text-[7.5px] text-mist-600">{cell.sub}</div>
                      </div>
                    ))}
                  </div>

                  {/* risk band */}
                  <div className="border-t border-white/[0.058] px-5 py-5">
                    <div className="flex items-center justify-between num text-[7px] uppercase tracking-[0.2em] text-mist-600">
                      <span className="text-rose-400/72">stop −{plan.sl}%</span>
                      <span>{entryPrice === null ? 'reference price' : 'actual entry'}</span>
                      <span className="text-mint-400/72">target +{plan.tp}%</span>
                    </div>

                    <div className="relative mt-2.5 h-[7px] w-full overflow-hidden rounded-full bg-white/[0.055]">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-rose-600/72 to-rose-500/22"
                        style={{ width: `${entryMarkerPct}%` }}
                      />
                      <div
                        className="absolute inset-y-0 right-0 rounded-full bg-gradient-to-l from-mint-500/78 to-mint-400/16"
                        style={{ width: `${100 - entryMarkerPct}%` }}
                      />
                      <div
                        className="absolute top-1/2 h-[15px] w-[2.5px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-ember-300 shadow-[0_0_12px_rgba(255,143,66,0.85)]"
                        style={{ left: `${entryMarkerPct}%` }}
                      />
                    </div>

                    <div className="mt-2 flex items-center justify-between num text-[10px]">
                      <span className="text-mist-400">{sl !== null ? usd(sl) : '—'}</span>
                      <span className="text-ember-300">
                        {entryPrice !== null
                          ? usd(entryPrice)
                          : reference !== null
                            ? usd(reference)
                            : '—'}
                      </span>
                      <span className="text-mist-400">{tp !== null ? usd(tp) : '—'}</span>
                    </div>

                    {/* Where the market is now, kept separate from the entry the
                        fill actually booked — the marker above is the entry. */}
                    {entryPrice !== null &&
                      reference !== null &&
                      sl !== null &&
                      tp !== null && (
                      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 num text-[8px] text-mist-600">
                        <span>
                          market now{' '}
                          <span className={reference >= entryPrice ? 'text-mint-300/80' : 'text-rose-300/80'}>
                            {usd(reference)}
                          </span>{' '}
                          ({reference >= entryPrice ? '+' : '−'}
                          {Math.abs(((reference - entryPrice) / entryPrice) * 100).toFixed(1)}% from
                          your entry)
                        </span>
                        <span>
                          {reference <= sl
                            ? 'below your stop'
                            : reference >= tp
                              ? 'above your target'
                              : 'inside your bracket'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* open p&l */}
                  {proof?.pnl && (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.058] px-5 py-4">
                      <div className="flex items-center gap-2">
                        <GaugeIcon size={12} className="text-mist-500" />
                        <span className="num text-[8px] uppercase tracking-[0.18em] text-mist-500">
                          open position
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="num text-[11px] text-mist-300">
                          {proof.pnl.open} open · {proof.pnl.closed} closed
                        </span>
                        <span
                          className={`num text-[13px] font-medium ${
                            (proof.pnl.totalUsd ?? 0) >= 0 ? 'text-mint-200' : 'text-rose-200'
                          }`}
                        >
                          {usd(proof.pnl.totalUsd)} ({proof.pnl.totalPct?.toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </Reveal>

              {/* link + share */}
              <Reveal delay={0.33}>
                <div className="mt-5 flex flex-wrap items-center gap-2.5">
                  <button
                    onClick={() => {
                      const url =
                        typeof window !== 'undefined' ? window.location.href : '';
                      navigator.clipboard?.writeText(url).then(
                        () => {
                          setCopied(true);
                          setTimeout(() => setCopied(false), 1800);
                        },
                        () => undefined,
                      );
                    }}
                    className="inline-flex items-center gap-2 rounded-full border border-white/[0.09] bg-white/[0.03] px-4 py-2.5 text-[12.5px] font-medium text-mist-200 transition-colors hover:border-ember-500/38 hover:text-ember-300"
                  >
                    {copied ? <Check size={13} className="text-mint-400" /> : <Copy size={13} />}
                    {copied ? 'Copied' : 'Copy plan link'}
                  </button>

                  <a
                    href={`/api/proof?planKey=${planKeyValue}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-white/[0.09] bg-white/[0.03] px-4 py-2.5 text-[12.5px] font-medium text-mist-200 transition-colors hover:border-ember-500/38 hover:text-ember-300"
                  >
                    <ExternalLink size={13} />
                    Raw proof JSON
                  </a>
                </div>
                <p className="mt-3 max-w-[62ch] text-[11px] leading-[1.7] text-mist-600">
                  Everything below is read back from the exchange by funder and order id. The plan
                  itself lives in this URL — no database row is required for the link to work.
                </p>
              </Reveal>
            </div>

            {/* ---------------------- mirror panel ---------------------- */}
            <Reveal delay={0.16}>
              <div className="nd-panel-q overflow-hidden rounded-[20px] border border-white/[0.078] bg-gradient-to-b from-white/[0.045] to-white/[0.019] backdrop-blur-xl">
                <div className="flex items-center justify-between gap-3 border-b border-white/[0.062] px-6 py-5">
                  <div className="flex items-center gap-2.5">
                    <Wallet size={14} className="text-ember-300" />
                    <span className="font-display text-[14px] font-semibold tracking-[-0.02em] text-mist-50">
                      Mirror it
                    </span>
                  </div>
                  <span className="num text-[7.5px] uppercase tracking-[0.18em] text-mist-500">
                    your size · your stop
                  </span>
                </div>

                <div className="px-6 py-5">
                  <p className="mb-5 text-[12.5px] leading-[1.75] text-mist-400">
                    Opening this link re-quotes the plan against{' '}
                    <span className="text-mist-200">your</span> wallet and balance. Set your own
                    size and levels — you sign the protective pair yourself, so it is yours.
                  </p>

                  <WalletBar wallet={wallet} />
                  <PlanForm
                    mode="mirror"
                    wallet={wallet}
                    initial={plan}
                    authorLabel={shortAddress(plan.a)}
                    hideWalletBar
                  />
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ================= COMPLIANCE ================= */}
      <section className="relative py-16">
        <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
          <div className="grid gap-10 lg:grid-cols-[0.88fr_1.12fr] lg:items-start">
            {/* summary */}
            <div className="lg:sticky lg:top-[92px]">
              <Reveal>
                <Eyebrow tone="mint">Compliance readout</Eyebrow>
              </Reveal>

              <Reveal delay={0.08}>
                <h2 className="mt-5 text-[30px] leading-[1.08] font-semibold tracking-[-0.034em] text-mist-50 sm:text-[38px] sm:leading-[1.05]">
                  Did the mirrors
                  <br />
                  <span className="font-serif-it text-gradient-mint">actually run it?</span>
                </h2>
              </Reveal>

              <Reveal delay={0.14}>
                <p className="mt-5 max-w-[44ch] text-[13.5px] leading-[1.82] text-mist-400">
                  Every mirror is an order on the exchange, so the protection that actually landed
                  can be read back and compared with the levels this plan asked for. That is the
                  difference between “{proof?.mirrors ?? 1}{' '}
                  {(proof?.mirrors ?? 1) === 1 ? 'wallet mirrored this' : 'wallets mirrored this'}”
                  — a claim — and a fact you can check.
                </p>
              </Reveal>

              <Reveal delay={0.2}>
                <div className="mt-7 rounded-[18px] border border-mint-400/18 bg-mint-400/[0.052] p-6">
                  <div className="flex items-center gap-5">
                    <Gauge
                      value={complianceRate ?? 0}
                      size={92}
                      stroke={8}
                      color="#34e0a0"
                    >
                      <div className="text-center">
                        <div className="num text-[17px] font-medium text-mint-200">
                          {complianceRate === null ? '—' : `${complianceRate}%`}
                        </div>
                        <div className="num text-[6px] uppercase tracking-[0.16em] text-mint-400/62">
                          as published
                        </div>
                      </div>
                    </Gauge>

                    <div>
                      <div className="num text-[19px] font-medium tracking-[-0.032em] text-mist-50">
                        {proof ? `${proof.compliance.published} / ${proof.compliance.total}` : '—'}
                      </div>
                      <div className="mt-1 text-[9px] leading-[1.72] text-mist-400">
                        judgeable mirrors ran with the protection this plan asked for, read back
                        from the exchange.
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-mint-400/12">
                    {[
                      {
                        k: 'published',
                        v: proof ? String(proof.compliance.published) : '—',
                        tone: 'text-mint-200',
                      },
                      {
                        k: 'deviated',
                        v: proof ? String(proof.compliance.deviated) : '—',
                        tone: 'text-ember-200',
                      },
                      {
                        k: 'unprotected',
                        v: proof ? String(proof.compliance.unprotected) : '—',
                        tone: 'text-mist-100',
                      },
                    ].map(cell => (
                      <div key={cell.k} className="bg-mint-400/[0.038] px-3.5 py-3">
                        <div className="num text-[6.5px] uppercase tracking-[0.19em] text-mint-400/58">
                          {cell.k}
                        </div>
                        <div className={`mt-1.5 num text-[13px] ${cell.tone}`}>{cell.v}</div>
                      </div>
                    ))}
                  </div>

                  {proof && proof.compliance.unknown > 0 && (
                    <p className="mt-4 text-[8.5px] leading-[1.8] text-mist-500">
                      {proof.compliance.unknown} mirror
                      {proof.compliance.unknown === 1 ? '' : 's'} could not be read and{' '}
                      {proof.compliance.unknown === 1 ? 'is' : 'are'} counted as{' '}
                      <em className="text-mist-300">unknown</em>, not assumed to be compliant.
                    </p>
                  )}
                </div>
              </Reveal>

              {/* revenue — read off the fills, never estimated */}
              <Reveal delay={0.26}>
                <div className="mt-5 rounded-[18px] border border-white/[0.072] bg-white/[0.019] p-5">
                  <div className="flex items-start gap-2.5">
                    <Zap size={11} className="mt-0.5 shrink-0 text-ember-300" />
                    <p className="text-[11px] leading-[1.82] text-mist-500">
                      Revenue from this plan&apos;s execution:{' '}
                      <span className="num text-mint-300">
                        {proof ? microUsd(proof.revenue.integratorFeeMicro) : '—'}
                      </span>{' '}
                      integrator fee, read off {proof?.revenue.fills ?? 0} settled{' '}
                      {(proof?.revenue.fills ?? 0) === 1 ? 'fill' : 'fills'} — 60% of it is
                      credited to the plan author.
                    </p>
                  </div>
                </div>
              </Reveal>

              <Reveal delay={0.3}>
                <p className="mt-5 max-w-[46ch] text-[11px] leading-[1.8] text-mist-600">
                  This is a readout, not a control. Nothing forces a mirror to stay on the published
                  levels — a mirror that deviates is still that wallet&apos;s own position, and that
                  independence is the product rather than a flaw in it.
                </p>
              </Reveal>
            </div>

            {/* checks + per-mirror rows */}
            <Reveal delay={0.1}>
              <div className="overflow-hidden rounded-[20px] border border-white/[0.075] bg-white/[0.021]">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.062] px-6 py-5">
                  <div className="flex items-center gap-2.5">
                    <div className="flex gap-1.5">
                      {['#fb4d6d', '#ffcf70', '#34e0a0'].map(c => (
                        <span
                          key={c}
                          className="h-[8.5px] w-[8.5px] rounded-full"
                          style={{ background: c, opacity: 0.72 }}
                        />
                      ))}
                    </div>
                    <span className="num text-[8px] uppercase tracking-[0.2em] text-mist-500">
                      mirror verification · per funder
                    </span>
                  </div>

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-mint-400/22 bg-mint-400/[0.09] px-2.5 py-1">
                    {!proof && !proofFailed && (
                      <RefreshCw size={8} className="animate-spin text-mint-300" />
                    )}
                    {proofFailed && <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />}
                    {proof && <span className="h-1.5 w-1.5 rounded-full bg-mint-400 animate-blink" />}
                    <span className="num text-[7px] uppercase tracking-[0.16em] text-mint-300">
                      {proofFailed ? 'read failed' : proof ? 'live read' : 'reading…'}
                    </span>
                  </span>
                </div>

                {/* per-funder rows */}
                <div className="divide-y divide-white/[0.055]">
                  {complianceRows.length === 0 && (
                    <div className="px-6 py-8">
                      <p className="text-[12.5px] text-mist-400">
                        {proofFailed
                          ? 'The exchange read failed. This is reported rather than assumed — nothing here is scored as compliant or not.'
                          : 'No mirror has been recorded for this plan yet. Once someone runs it, their fills and protection appear here.'}
                      </p>
                    </div>
                  )}

                  {complianceRows.map(row => {
                    const status = row.compliance?.status ?? 'unknown';
                    const tone =
                      status === 'published'
                        ? { text: 'text-mint-300', bg: 'bg-mint-400/[0.09]', bd: 'border-mint-400/22' }
                        : status === 'deviated'
                          ? {
                              text: 'text-ember-300',
                              bg: 'bg-ember-400/[0.09]',
                              bd: 'border-ember-400/22',
                            }
                          : status === 'unprotected'
                            ? {
                                text: 'text-rose-300',
                                bg: 'bg-rose-500/[0.09]',
                                bd: 'border-rose-500/22',
                              }
                            : {
                                text: 'text-mist-300',
                                bg: 'bg-white/[0.05]',
                                bd: 'border-white/[0.11]',
                              };

                    return (
                      <div key={row.funder} className="px-6 py-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-ember-300/72 to-ember-600/72" />
                            <div>
                              <div className="num text-[11px] text-mist-100">
                                {shortAddress(row.funder)}
                              </div>
                              <div className="num mt-0.5 text-[7.5px] text-mist-600">
                                deployed {usdCompact(row.spendUsd)} · {relativeTime(row.createdAt)}
                              </div>
                            </div>
                          </div>

                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${tone.bg} ${tone.bd}`}
                          >
                            <span className={`num text-[7.5px] uppercase tracking-[0.15em] ${tone.text}`}>
                              {status}
                            </span>
                          </span>
                        </div>

                        {/* checks */}
                        <div className="mt-4 space-y-2">
                          {(row.compliance?.checks ?? []).map(check => (
                            <div
                              key={check.name}
                              className="flex items-start gap-3 rounded-xl border border-white/[0.055] bg-white/[0.016] px-3.5 py-2.5"
                            >
                              <span
                                className={`mt-[3px] inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border ${
                                  check.ok
                                    ? 'border-mint-400/35 bg-mint-400/[0.14]'
                                    : check.skipped
                                      ? 'border-white/[0.16] bg-white/[0.05]'
                                      : 'border-rose-500/35 bg-rose-500/[0.14]'
                                }`}
                              >
                                {check.ok && <Check size={8} strokeWidth={3.4} className="text-mint-300" />}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="num text-[9.5px] text-mist-200">{check.name}</div>
                                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[8.5px]">
                                  <span className="text-mist-500">wanted {check.expected}</span>
                                  <span className="text-mist-700">·</span>
                                  <span className={check.ok ? 'text-mint-300/90' : 'text-mist-400'}>
                                    got {check.actual}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* fills + hashes */}
                        {row.entry?.fills?.length ? (
                          <div className="mt-4 space-y-2">
                            {row.entry.fills.map(fill => (
                              <div
                                key={fill.txHash}
                                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.055] bg-ink-900/45 px-3.5 py-2.5"
                              >
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                                  <span className="num text-[9px] text-mist-300">
                                    {usd(Number(fill.fillPrice))}
                                  </span>
                                  <span className="num text-[8.5px] text-mist-600">
                                    {fill.venues?.join(', ') ?? 'flash venue'}
                                  </span>
                                  <span className="num text-[8.5px] text-mist-500">
                                    fee {microUsd(Math.round(Number(fill.integratorFee) * 1e6))}{' '}
                                    {fill.feeTicker}
                                  </span>
                                </div>
                                <a
                                  href={`https://basescan.org/tx/${fill.txHash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 num text-[8px] text-mist-500 transition-colors hover:text-ember-300"
                                >
                                  {fill.txHash.slice(0, 10)}…
                                  <ExternalLink size={9} />
                                </a>
                              </div>
                            ))}
                          </div>
                        ) : null}

                        {row.entry?.orderId && (
                          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 num text-[7.5px] text-mist-700">
                            <span>entry {row.entry.orderId.slice(0, 8)}…</span>
                            {row.bracket?.orderId && (
                              <span>bracket {row.bracket.orderId.slice(0, 8)}…</span>
                            )}
                            {row.entry.bracketStatus && <span>protection {row.entry.bracketStatus}</span>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ================= AUTHOR EARNINGS ================= */}
      <section className="relative pb-20">
        <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
          <Reveal>
            <Eyebrow>Creator economics</Eyebrow>
          </Reveal>
          <Reveal delay={0.07}>
            <h2 className="mt-5 max-w-[42ch] text-[30px] leading-[1.08] font-semibold tracking-[-0.034em] text-mist-50 sm:text-[38px]">
              What the author{' '}
              <span className="font-serif-it text-gradient-ember">actually earns</span>.
            </h2>
          </Reveal>
          <Reveal delay={0.13}>
            <p className="mt-5 max-w-[62ch] text-[13.5px] leading-[1.82] text-mist-400">
              A forecast is not money. The ledger distinguishes what has been collected from what has
              settled and what is withdrawable — the payout function cannot even see an estimate, so
              nothing here is payable until the fills behind it reconcile.
            </p>
          </Reveal>

          <Reveal delay={0.19}>
            <div className="mt-8">
              <EarningsPanel author={plan.a} />
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
