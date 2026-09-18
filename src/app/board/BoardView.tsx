'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Clock,
  Crown,
  ExternalLink,
  Filter,
  Info,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  RefreshCw,
} from 'lucide-react';
import { Reveal, RevealGroup, RevealItem } from '@/components/design/Reveal';
import { SectionHeading, Eyebrow } from '@/components/design/Section';
import { Sparkline } from '@/components/design/Charts';
import { assetByToken } from '@/lib/data';
import type { BoardPlan, ProofSummary } from '@/lib/boardPlan';
import { usd, pct, usdCompact, relativeTime } from '@/lib/df-format';


type SortKey = 'realised' | 'return' | 'wallets' | 'recent';

const SORTS: { key: SortKey; label: string; description: string }[] = [
  {
    key: 'realised',
    label: 'Realised P&L',
    description:
      'Dollars that actually settled from fills read back off the exchange — not what was quoted.',
  },
  {
    key: 'return',
    label: 'Return %',
    description:
      'The fairer comparison when each mirror chooses its own size independently.',
  },
  {
    key: 'wallets',
    label: 'Wallets',
    description:
      'Ignores performance entirely and ranks by how many independent wallets ran the plan.',
  },
  {
    key: 'recent',
    label: 'Most recent',
    description: 'Newest plans first — useful for finding ideas before they have a track record.',
  },
];

/**
 * Real rows arrive from the server, so the table is content at first paint.
 * The performance numbers cost an exchange round trip each, so they are read
 * afterwards — a row that has not priced yet is *unpriced*, which the UI says
 * in words rather than rendering as a zero.
 */
export function BoardView({ rows: initial }: { rows: BoardPlan[] }) {
  const [sort, setSort] = useState<SortKey>('realised');
  const [query, setQuery] = useState('');
  const [minCompliance, setMinCompliance] = useState(0);
  const [rows, setRows] = useState<BoardPlan[]>(initial);

  /**
   * Read the fills back, one plan at a time.
   *
   * Sequential on purpose: Flash scopes order reads to a funder address and
   * throttles per key, so a burst across many plans is the fastest way to get
   * rate-limited on stage. Each response either prices the row or marks it
   * unreadable — never silently leaves it at zero.
   */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      for (const row of initial) {
        if (cancelled) return;
        try {
          const res = await fetch(`/api/proof?planKey=${encodeURIComponent(row.planKey)}`);
          if (!res.ok) throw new Error(String(res.status));
          const proof = (await res.json()) as ProofSummary;
          if (cancelled) return;

          setRows(prev =>
            prev.map(r =>
              r.planKey !== row.planKey
                ? r
                : {
                    ...r,
                    priced: true,
                    unreadable: false,
                    mirrors: proof.mirrors ?? r.mirrors,
                    realisedUsd: proof.pnl?.realisedUsd ?? 0,
                    unrealisedUsd: proof.pnl?.unrealisedUsd ?? 0,
                    // Return is on what was deployed, so a plan whose mirrors
                    // cannot be priced has no return at all rather than 0%.
                    returnPct:
                      proof.pnl?.investedUsd && proof.pnl.investedUsd > 0
                        ? (proof.pnl.totalUsd / proof.pnl.investedUsd) * 100
                        : null,
                    compliancePct: proof.compliance?.ratePct ?? 0,
                  },
            ),
          );
        } catch {
          if (cancelled) return;
          setRows(prev =>
            prev.map(r =>
              r.planKey === row.planKey ? { ...r, unreadable: true, priced: false } : r,
            ),
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initial]);

  const sorted = useMemo(() => {
    const filtered = rows.filter(p => {
      const q = query.trim().toLowerCase();
      const matchesQuery =
        !q ||
        p.symbol.toLowerCase().includes(q) ||
        p.authorHandle.toLowerCase().includes(q) ||
        p.note.toLowerCase().includes(q);

      return matchesQuery && p.compliancePct >= minCompliance;
    });

    return [...filtered].sort((a, b) => {
      switch (sort) {
        case 'realised':
          return b.realisedUsd - a.realisedUsd;
        case 'return':
          return (b.returnPct ?? -Infinity) - (a.returnPct ?? -Infinity);
        case 'wallets':
          return b.mirrors - a.mirrors;
        case 'recent':
          return b.createdAt - a.createdAt;
        default:
          return 0;
      }
    });
  }, [rows, sort, query, minCompliance]);

  const podium = sorted.slice(0, 3);
  const activeSort = SORTS.find(s => s.key === sort)!;

  return (
    <>
      {/* ================= HEADER ================= */}
      <section className="relative overflow-hidden pb-12 pt-12 sm:pt-16">
        <div className="pointer-events-none absolute inset-0">
          <img
            src="/images/grid-texture.jpg"
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover opacity-[0.3]"
            style={{
              maskImage:
                'radial-gradient(ellipse 80% 62% at 50% 22%, #000 12%, transparent 78%)',
              WebkitMaskImage:
                'radial-gradient(ellipse 80% 62% at 50% 22%, #000 12%, transparent 78%)',
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, rgba(4,6,12,0.32) 0%, rgba(4,6,12,0.72) 58%, #04060c 100%)',
            }}
          />
        </div>

        <div className="relative mx-auto max-w-[1240px] px-5 sm:px-8">
          <Reveal>
            <div className="flex flex-wrap items-center gap-2.5">
              <Link
                href="/"
                className="num text-[9px] uppercase tracking-[0.21em] text-mist-500 transition-colors hover:text-mist-300"
              >
                Home
              </Link>
              <span className="h-[3px] w-[3px] rounded-full bg-mist-700" />
              <span className="num text-[9px] uppercase tracking-[0.21em] text-ember-400">
                Board
              </span>
            </div>
          </Reveal>

          <div className="mt-6 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Reveal delay={0.05}>
                <Eyebrow>Performance leaderboard</Eyebrow>
              </Reveal>

              <Reveal delay={0.12}>
                <h1 className="mt-5 max-w-[20ch] text-[38px] leading-[1.01] font-semibold tracking-[-0.041em] text-mist-50 sm:text-[54px] sm:leading-[0.97]">
                  Plans, ranked by the money their mirrors
                  <span className="font-serif-it text-gradient-ember"> actually booked.</span>
                </h1>
              </Reveal>

              <Reveal delay={0.18}>
                <p className="mt-6 max-w-[62ch] text-[15px] leading-[1.8] text-mist-400 sm:text-[16.5px]">
                  Ranking reads the fills back from the exchange — realised profit is what settled,
                  not what was quoted. A plan has to be published to be shareable, which makes this
                  the only honest version of this number.
                </p>
              </Reveal>
            </div>

            {/* summary panel */}
            <Reveal delay={0.24}>
              <div className="glass-deep rounded-[18px] p-6 lg:min-w-[290px]">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-mint-400 animate-blink" />
                  <span className="num text-[8px] uppercase tracking-[0.21em] text-mint-300">
                    board snapshot
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-4">
                  {[
                    { k: 'plans tracked', v: String(rows.length) },
                    {
                      k: 'total mirrors',
                      v: String(rows.reduce((s, p) => s + p.mirrors, 0)),
                    },
                    {
                      k: 'total notional',
                      v: usdCompact(rows.reduce((s, p) => s + p.notional, 0)),
                    },
                    {
                      k: 'realised',
                      v: usdCompact(rows.filter(p => p.priced).reduce((s, p) => s + p.realisedUsd, 0)),
                    },
                  ].map(cell => (
                    <div key={cell.k}>
                      <div className="num text-[7px] uppercase tracking-[0.19em] text-mist-500">
                        {cell.k}
                      </div>
                      <div className="mt-1.5 num text-[17px] font-medium tracking-[-0.032em] text-mist-50">
                        {cell.v}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-xl border border-white/[0.062] bg-white/[0.018] px-4 py-3">
                  <div className="flex items-start gap-2">
                    <Info size={9.5} className="mt-0.5 shrink-0 text-mist-500" />
                    <p className="text-[7px] leading-[1.82] text-mist-500">
                      The exchange scopes order reads to a funder address, so there is no global
                      feed of Flash trades to index. Every number here comes from a plan that was
                      deliberately published.
                    </p>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ================= SORT + FILTERS ================= */}
      <section className="relative pb-10">
        <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
          <Reveal>
            <div className="flex flex-col gap-5 rounded-[18px] border border-white/[0.072] bg-white/[0.021] p-5 lg:flex-row lg:items-center lg:justify-between">
              {/* sort tabs */}
              <div className="flex flex-wrap gap-1.5">
                {SORTS.map(s => (
                  <button
                    key={s.key}
                    onClick={() => setSort(s.key)}
                    className={`relative rounded-full border px-4 py-2.3 text-[9.5px] font-medium transition-all duration-220 ${
                      sort === s.key
                        ? 'border-transparent text-ink-950'
                        : 'border-white/[0.082] text-mist-400 hover:border-white/[0.15] hover:text-mist-200'
                    }`}
                  >
                    {sort === s.key && (
                      <motion.span
                        layoutId="sort-pill"
                        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                        className="absolute inset-0 rounded-full bg-gradient-to-b from-ember-300 to-ember-500"
                      />
                    )}
                    <span className="relative z-10">{s.label}</span>
                  </button>
                ))}
              </div>

              {/* search + filter */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex items-center gap-2 rounded-full border border-white/[0.082] bg-white/[0.022] px-3.5 py-2">
                  <Search size={11} className="text-mist-500" />

                  <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Search symbol, author, thesis…"
                    className="w-[190px] bg-transparent text-[9.5px] text-mist-100 outline-none placeholder:text-mist-600"
                  />

                  {query && (
                    <button
                      onClick={() => setQuery('')}
                      className="text-mist-500 transition-colors hover:text-mist-200"
                    >
                      ×
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 rounded-full border border-white/[0.082] bg-white/[0.022] px-3.5 py-2">
                  <Filter size={11} className="text-mist-500" />

                  <span className="num whitespace-nowrap text-[8px] text-mist-400">
                    compliance ≥
                  </span>

                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={10}
                    value={minCompliance}
                    onChange={e => setMinCompliance(Number(e.target.value))}
                    className="w-[72px]"
                    aria-label="Minimum compliance"
                  />

                  <span className="num text-[8px] text-ember-200">{minCompliance}%</span>
                </div>
              </div>
            </div>
          </Reveal>

          {/* active sort description */}
          <Reveal delay={0.08}>
            <div className="mt-4 flex items-start gap-2.5 px-1">
              <Sparkles size={11} className="mt-0.5 shrink-0 text-ember-300" />

              <p className="text-[9px] leading-[1.82] text-mist-500">
                <span className="text-mist-300">Currently sorting by {activeSort.label}.</span>{' '}
                {activeSort.description}
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ================= PODIUM ================= */}
      {podium.length >= 3 && (
        <section className="relative pb-14">
          <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
            <div className="grid gap-5 lg:grid-cols-3">
              {[podium[1], podium[0], podium[2]].map((plan, index) => {
                const asset = assetByToken(plan.symbol);
                const positive = (plan.returnPct ?? 0) >= 0;
                const rank = index === 0 ? 2 : index === 1 ? 1 : 3;
                const isWinner = rank === 1;

                return (
                  <Reveal key={plan.id} delay={index * 0.09}>
                    <Link
                      href={`/p/${plan.id}`}
                      className={`group relative block h-full overflow-hidden rounded-[20px] border transition-all duration-380 hover:-translate-y-2 ${
                        isWinner
                          ? 'border-ember-400/32 bg-gradient-to-b from-ember-500/[0.11] via-white/[0.028] to-white/[0.019] shadow-[0_32px_78px_-28px_rgba(255,143,66,0.44)] lg:-mt-5'
                          : 'border-white/[0.078] bg-white/[0.021] hover:border-white/[0.132]'
                      }`}
                    >
                      {/* winner top bar */}
                      {isWinner && (
                        <div className="h-[3px] w-full bg-gradient-to-r from-transparent via-ember-300/82 to-transparent" />
                      )}

                      <div className="p-7">
                        {/* rank badge */}
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3.5">
                            <div
                              className={`relative inline-flex items-center justify-center rounded-[15px] border ${
                                isWinner
                                  ? 'h-[52px] w-[52px] border-ember-300/36 bg-gradient-to-br from-ember-300 to-ember-600 shadow-[0_16px_42px_-12px_rgba(255,143,66,0.7)]'
                                  : 'h-[46px] w-[46px] border-white/[0.092] bg-white/[0.032]'
                              }`}
                            >
                              {rank === 1 ? (
                                <Crown size={19} className="text-ink-950" />
                              ) : (
                                <span
                                  className={`num text-[16px] font-medium tracking-[-0.035em] ${
                                    isWinner ? 'text-ink-950' : 'text-mist-200'
                                  }`}
                                >
                                  {rank}
                                </span>
                              )}
                            </div>

                            <div>
                              <div className="num text-[13px] font-medium text-mist-50">
                                {plan.symbol}
                              </div>

                              <div className="mt-1 flex items-center gap-1.5">
                                <div className="h-[17px] w-[17px] rounded-full bg-gradient-to-br from-ember-300/72 to-ember-600/72" />

                                <span className="text-[8.5px] text-mist-500">
                                  @{plan.authorHandle}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            <div
                              className={`num text-[24px] font-medium leading-none tracking-[-0.038em] ${
                                positive ? 'text-mint-200' : 'text-rose-200'
                              }`}
                            >
                              {pct(plan.returnPct, 2)}
                            </div>

                            <div className="mt-1.5 num text-[7px] uppercase tracking-[0.19em] text-mist-500">
                              total return
                            </div>
                          </div>
                        </div>

                        {/* note */}
                        <p className="mt-6 line-clamp-2 text-[10.5px] leading-[1.82] text-mist-400">
                          {plan.note}
                        </p>

                        {/* sparkline */}
                        <div className="mt-5">
                          <Sparkline
                            points={asset.spark}
                            width={320}
                            height={58}
                            stroke={positive ? '#34e0a0' : '#fb4d6d'}
                            strokeWidth={1.85}
                            className="w-full"
                          />
                        </div>

                        {/* params */}
                        <div className="mt-5 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-white/[0.058]">
                          {[
                            {
                              k: 'size',
                              v: `${plan.sizePct}%`,
                              tone: 'text-ember-200',
                            },
                            {
                              k: 'target',
                              v: `+${plan.tpPct}%`,
                              tone: 'text-mint-200',
                            },
                            {
                              k: 'stop',
                              v: `−${plan.slPct}%`,
                              tone: 'text-rose-200',
                            },
                          ].map(cell => (
                            <div
                              key={cell.k}
                              className="bg-white/[0.018] px-3.5 py-2.8"
                            >
                              <div className="num text-[6.5px] uppercase tracking-[0.19em] text-mist-500">
                                {cell.k}
                              </div>

                              <div
                                className={`mt-1.2 num text-[11px] ${cell.tone}`}
                              >
                                {cell.v}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* footer */}
                        <div className="mt-5 flex items-center justify-between">
                          <div className="flex items-center gap-3.5">
                            <div className="flex items-center gap-1.5">
                              <Users size={9} className="text-mist-500" />

                              <span className="num text-[8px] text-mist-400">
                                {plan.mirrors} mirrors
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <TrendingUp size={9} className="text-mist-500" />

                              <span className="num text-[8px] text-mist-400">
                                  {plan.priced
                                    ? `${usdCompact(plan.realisedUsd)} realised`
                                    : plan.unreadable
                                      ? 'unreadable'
                                      : 'reading…'}
                                </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.2 rounded-full border border-mint-400/18 bg-mint-400/[0.072] px-2.5 py-1">
                            <ShieldCheck size={8.5} className="text-mint-300" />

                            <span className="num text-[7px] text-mint-200">
                                {plan.priced ? `${plan.compliancePct}%` : "—"}
                              </span>
                          </div>
                        </div>

                        <div className="mt-4 flex items-center gap-1.5 text-[7.5px] text-mist-600">
                          <Clock size={8} />

                          <span>published {relativeTime(plan.createdAt)}</span>

                          <span className="mx-1 h-[3px] w-[3px] rounded-full bg-mist-700" />

                          <span>{usdCompact(plan.notional)} mirrored</span>
                        </div>
                      </div>

                      {/* hover indicator */}
                      <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-ember-400/0 to-transparent transition-all duration-420 group-hover:via-ember-400/62" />
                    </Link>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ================= FULL TABLE ================= */}
      <section className="relative pb-20">
        <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <Eyebrow tone="mist">Complete ranking</Eyebrow>

              <h2 className="mt-4 text-[24px] leading-[1.12] font-semibold tracking-[-0.031em] text-mist-50 sm:text-[30px]">
                Every published plan,
                <span className="font-serif-it text-gradient-mist"> nothing hidden.</span>
              </h2>
            </div>

            <div className="flex items-center gap-2.5">
              <span className="num text-[8px] uppercase tracking-[0.19em] text-mist-500">
                {sorted.length} of {rows.length} plans
              </span>

              <Link
                href="/create"
                className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-ember-300 to-ember-500 px-5 py-2.8 text-[9.5px] font-semibold text-ink-950 shadow-[0_14px_38px_-10px_rgba(255,143,66,0.56)] transition-all duration-200 hover:-translate-y-1"
              >
                Publish yours
                <ArrowRight size={11} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>

          {/* table */}
          <Reveal delay={0.1}>
            <div className="mt-8 overflow-hidden rounded-[18px] border border-white/[0.072]">
              {/* header */}
              <div className="hidden grid-cols-[2.6fr_1.15fr_1.15fr_1.1fr_1.15fr_1.1fr_0.95fr] gap-4 border-b border-white/[0.062] bg-white/[0.018] px-6 py-4 lg:grid">
                {[
                  'Plan',
                  'Size / levels',
                  'Mirrors',
                  'Notional',
                  'Realised P&L',
                  'Return',
                  'Compliance',
                ].map(h => (
                  <div
                    key={h}
                    className="num text-[6.8px] uppercase tracking-[0.21em] text-mist-500"
                  >
                    {h}
                  </div>
                ))}
              </div>

              {/* rows */}
              <AnimatePresence mode="popLayout">
                {sorted.map((plan, i) => {
                  const asset = assetByToken(plan.symbol);
                  const positive = (plan.returnPct ?? 0) >= 0;

                  return (
                    <motion.div
                      key={plan.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.38, delay: i * 0.04 }}
                    >
                      <Link
                        href={`/p/${plan.id}`}
                        className="grid grid-cols-1 gap-4 border-b border-white/[0.048] px-6 py-5 transition-colors duration-220 last:border-b-0 hover:bg-white/[0.022] lg:grid-cols-[2.6fr_1.15fr_1.15fr_1.1fr_1.15fr_1.1fr_0.95fr] lg:items-center"
                      >
                        {/* plan */}
                        <div className="flex items-center gap-3.5">
                          <div className="flex h-11 w-11 items-center justify-center rounded-[13px] border border-white/[0.088] bg-gradient-to-br from-white/[0.078] to-white/[0.012]">
                            <span className="num text-[10px] text-mist-100">
                              {asset.ticker.slice(0, 2)}
                            </span>
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="num text-[11px] font-medium text-mist-50">
                                {plan.symbol}
                              </span>

                              {i === 0 && sort === 'realised' && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-ember-400/26 bg-ember-400/[0.11] px-2 py-[2.5px]">
                                  <Crown size={7} className="text-ember-300" />

                                  <span className="num text-[6px] uppercase tracking-[0.14em] text-ember-200">
                                    top
                                  </span>
                                </span>
                              )}
                            </div>

                            <div className="mt-1 truncate text-[8.5px] text-mist-500">
                              @{plan.authorHandle} · {relativeTime(plan.createdAt)}
                            </div>

                            <div className="mt-1.5">
                              <Sparkline
                                points={asset.spark.slice(-16)}
                                width={120}
                                height={17}
                                stroke={positive ? '#34e0a0' : '#fb4d6d'}
                                strokeWidth={1.4}
                                animate={false}
                                className="w-[120px]"
                              />
                            </div>
                          </div>
                        </div>

                        {/* levels */}
                        <div>
                          <div className="num text-[7px] uppercase tracking-[0.18em] text-mist-500 lg:hidden">
                            Size / levels
                          </div>

                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 lg:mt-0">
                            <span className="num rounded-full border border-ember-400/18 bg-ember-400/[0.072] px-2 py-[3px] text-[7px] text-ember-200">
                              {plan.sizePct}% size
                            </span>

                            <span className="num rounded-full border border-mint-400/18 bg-mint-400/[0.072] px-2 py-[3px] text-[7px] text-mint-200">
                              +{plan.tpPct}%
                            </span>

                            <span className="num rounded-full border border-rose-400/18 bg-rose-400/[0.072] px-2 py-[3px] text-[7px] text-rose-200">
                              −{plan.slPct}%
                            </span>
                          </div>
                        </div>

                        {/* mirrors */}
                        <div>
                          <div className="num text-[7px] uppercase tracking-[0.18em] text-mist-500 lg:hidden">
                            Mirrors
                          </div>

                          <div className="mt-1.5 flex items-center gap-2 lg:mt-0">
                            <Users size={9} className="text-mist-500" />

                            <span className="num text-[10px] text-mist-100">
                              {plan.mirrors}
                            </span>

                            <div className="h-[3.5px] w-[42px] overflow-hidden rounded-full bg-white/[0.07]">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-ember-500 to-ember-300"
                                style={{
                                  width: `${Math.min(100, (plan.mirrors / 50) * 100)}%`,
                                }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* notional */}
                        <div>
                          <div className="num text-[7px] uppercase tracking-[0.18em] text-mist-500 lg:hidden">
                            Notional
                          </div>

                          <div className="mt-1.5 num text-[10px] text-mist-100 lg:mt-0">
                            {usdCompact(plan.notional)}
                          </div>
                        </div>

                        {/* realised */}
                          <div>
                            <div className="num text-[7px] uppercase tracking-[0.18em] text-mist-500 lg:hidden">
                              Realised P&amp;L
                            </div>

                            {plan.priced ? (
                              <div
                                className={`mt-1.5 num text-[11px] font-medium lg:mt-0 ${
                                  plan.realisedUsd > 0
                                    ? 'text-mint-200'
                                    : plan.realisedUsd < 0
                                      ? 'text-rose-200'
                                      : 'text-mist-400'
                                }`}
                              >
                                {plan.realisedUsd > 0 ? '+' : plan.realisedUsd < 0 ? '−' : ''}
                                {usd(Math.abs(plan.realisedUsd))}
                              </div>
                            ) : (
                              /* Unpriced is not flat. Rendering $0.00 here would
                                 rank a row nobody has read as a row that broke even. */
                              <div className="mt-1.5 flex items-center gap-1.5 lg:mt-0">
                                <RefreshCw
                                  size={9}
                                  className={
                                    plan.unreadable ? 'text-rose-400/70' : 'text-mist-600 animate-spin'
                                  }
                                />
                                <span className="num text-[9px] text-mist-500">
                                  {plan.unreadable ? 'unreadable' : 'reading…'}
                                </span>
                              </div>
                            )}

                            <div className="mt-1 num text-[6.5px] text-mist-600">
                              {plan.mirrors} {plan.mirrors === 1 ? 'mirror' : 'mirrors'} ·{' '}
                              {usdCompact(plan.notional)} deployed
                            </div>
                          </div>

                          {/* return */}
                          <div>
                            <div className="num text-[7px] uppercase tracking-[0.18em] text-mist-500 lg:hidden">
                              Return
                            </div>

                            <div className="mt-1.5 flex items-center gap-1.8 lg:mt-0">
                              {plan.priced && plan.returnPct !== null ? (
                                <>
                                  {positive ? (
                                    <TrendingUp size={9} className="text-mint-400" />
                                  ) : (
                                    <TrendingDown size={9} className="text-rose-400" />
                                  )}
                                  <span
                                    className={`num text-[11px] font-medium ${
                                      positive ? 'text-mint-200' : 'text-rose-200'
                                    }`}
                                  >
                                    {pct(plan.returnPct, 2)}
                                  </span>
                                </>
                              ) : (
                                <span className="num text-[11px] text-mist-600">—</span>
                              )}
                            </div>
                          </div>

                          {/* compliance */}
                        <div>
                          <div className="num text-[7px] uppercase tracking-[0.18em] text-mist-500 lg:hidden">
                            Compliance
                          </div>

                          <div className="mt-1.5 flex items-center gap-2 lg:mt-0">
                              {plan.priced ? (
                                <>
                                  <div className="h-[4px] w-[38px] overflow-hidden rounded-full bg-white/[0.07]">
                                    <div
                                      className={`h-full rounded-full $
                                  plan.compliancePct >= 95
                                    ? 'bg-mint-400'
                                    : plan.compliancePct >= 85
                                      ? 'bg-ember-400'
                                      : 'bg-rose-400'
                                }`}
                                      style={{ width: `${plan.compliancePct}%` }}
                                    />
                                  </div>
                                  <span className="num text-[8px] text-mist-300">
                                    {plan.compliancePct}%
                                  </span>
                                </>
                              ) : (
                                <span className="num text-[8px] text-mist-600">
                                  not read yet
                                </span>
                              )}
                            </div>

                          <div className="mt-1.5 flex items-center gap-1">
                            <Check size={7} className="text-mint-400" />

                            <span className="num text-[6px] text-mist-600">
                              read back from chain
                            </span>
                          </div>
                        </div>

                        <div className="flex justify-start lg:hidden">
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.09] px-3 py-1.8 text-[7.5px] text-mist-300">
                            View plan
                            <ArrowUpRight size={8} />
                          </span>
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {sorted.length === 0 && (
                <div className="px-8 py-16 text-center">
                  <div className="mx-auto inline-flex h-13 w-13 items-center justify-center rounded-full border border-white/[0.09] bg-white/[0.028]">
                    <Search size={18} className="text-mist-500" />
                  </div>

                  <h3 className="mt-5 text-[15px] font-medium text-mist-100">
                    No plans match your filters
                  </h3>

                  <p className="mx-auto mt-2.5 max-w-[36ch] text-[10px] leading-[1.82] text-mist-500">
                    Try a different search term or lower the compliance threshold.
                  </p>

                  <button
                    onClick={() => {
                      setQuery('');
                      setMinCompliance(0);
                    }}
                    className="mt-6 rounded-full border border-white/[0.1] px-5 py-2.5 text-[9.5px] text-mist-200 transition-colors hover:border-white/[0.18]"
                  >
                    Reset filters
                  </button>
                </div>
              )}
            </div>
          </Reveal>

          {/* footnote */}
          <Reveal delay={0.12}>
            <div className="mt-8 rounded-[18px] border border-white/[0.072] bg-white/[0.019] p-7">
              <div className="flex items-start gap-3.5">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ember-400/22 bg-ember-400/[0.1]">
                  <Info size={13} className="text-ember-300" />
                </span>

                <div>
                  <h4 className="text-[11.5px] font-medium text-mist-200">
                    How to read this board honestly
                  </h4>

                  <div className="mt-3.5 grid gap-4 sm:grid-cols-2">
                    {[
                      {
                        t: 'Unpriced is not the same as flat',
                        b: 'A plan whose fills have not been read back yet has no score at all, so it sinks to the bottom rather than being ranked as a zero.',
                      },
                      {
                        t: 'Realised means settled',
                        b: 'Only fills that actually settled count toward realised P&L. Unrealised is the part still held, marked at the current market.',
                      },
                      {
                        t: 'Unreadable keeps its retry',
                        b: 'If the read fails outright the row says so and keeps a retry button, instead of quietly presenting a guess.',
                      },
                      {
                        t: 'Most-copied does not mean best',
                        b: 'The ordering rule includes an assertion that the most-copied plan does not automatically lead the board.',
                      },
                    ].map(item => (
                      <div key={item.t} className="flex items-start gap-2.5">
                        <span className="mt-[6px] h-[4.5px] w-[4.5px] shrink-0 rounded-full bg-ember-400/72" />

                        <div>
                          <div className="text-[9px] font-medium text-mist-300">
                            {item.t}
                          </div>

                          <div className="mt-1 text-[8px] leading-[1.82] text-mist-500">
                            {item.b}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 flex flex-wrap items-center gap-2.5">
                    <a
                      href="https://github.com/Arinzaay007/night-desk"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.8 rounded-full border border-white/[0.092] px-3.8 py-2 text-[8px] text-mist-300 transition-colors hover:border-ember-400/32 hover:text-ember-200"
                    >
                      <ExternalLink size={9} />
                      See src/lib/rank.ts — 24 assertions behind this ordering
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
