'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Quote,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet,
  Zap,
  Link2,
  BarChart3,
  Lock,
  Globe2,
  Clock,
  Plus,
} from 'lucide-react';
import { Reveal, RevealGroup, RevealItem, CountUp } from '@/components/design/Reveal';
import { SectionHeading, Eyebrow } from '@/components/design/Section';
import { Sparkline, Gauge } from '@/components/design/Charts';
import {
  ASSETS,
  PLANS,
  PRINCIPLES,
  STEPS,
  FAQ,
  STATS,
  assetByToken,
  LIVE_TP_PRICE,
  LIVE_SL_PRICE,
  LIVE_ENTRY_PRICE,
  LIVE_FEE_MICRO,
  AUTHOR_SHARE_PCT,
} from '@/lib/data';
import { PLAN_PATH, PLAN_KEY, REPO_URL, SUBMISSION_URL } from '@/lib/site';
import { useLiveAssets } from '@/lib/useLiveAssets';
import { usd, pct, usdCompact, relativeTime, microUsd as fmtMicro } from '@/lib/df-format';

/* ------------------------------------------------------------------ */
/* Hero plan card                                                      */
/* ------------------------------------------------------------------ */
function HeroPlanCard() {
  const reduce = useReducedMotion();
  const asset = assetByToken('NVDAc');
  // The seed price paints instantly; the live read replaces it a moment later.
  // Until then the badge says "last read" rather than implying a live quote.
  const live = useLiveAssets();
  const liveAsset = live?.[asset.token];
  const price = liveAsset?.price ?? asset.price;
  const change = liveAsset?.change24h ?? asset.change24h;
  const isLive = Boolean(liveAsset);

  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 34, rotateX: 7, scale: 0.965 }}
      animate={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
      transition={{ duration: 1.05, delay: 0.28, ease: [0.22, 0.68, 0.32, 1] }}
      className="relative"
      style={{ perspective: 1400 }}
    >
      {/* glow behind the card */}
      <div
        className="pointer-events-none absolute -inset-8 rounded-[34px] opacity-70"
        style={{
          background:
            'radial-gradient(ellipse 62% 58% at 50% 42%, rgba(255,143,66,0.2), transparent 72%)',
          filter: 'blur(26px)',
        }}
      />

      <div className="glass-deep glow-soft relative overflow-hidden rounded-[22px]">
        {/* card header */}
        <div className="flex items-start justify-between gap-4 px-6 pt-6">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-mint-400/25 bg-mint-400/10 px-2.5 py-1">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-mint-400 animate-pulse-ring" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-mint-400" />
                </span>
                <span className="num text-[8.5px] uppercase tracking-[0.19em] text-mint-300">
                  live
                </span>
              </span>
              <span className="num text-[9px] uppercase tracking-[0.22em] text-mist-500">
                plan · u8201h · live on Base
              </span>
            </div>

            <div className="mt-3.5 flex items-baseline gap-2.5">
              <span className="font-display text-[27px] font-semibold tracking-[-0.035em] text-mist-50">
                {asset.token}
              </span>
              <span className="text-[12.5px] text-mist-500">{asset.name}</span>
            </div>
          </div>

          <div className="text-right">
            <div className="num text-[23px] font-medium tracking-[-0.032em] text-mist-50">
              {usd(asset.price)}
            </div>
            <div className="mt-0.5 inline-flex items-center gap-1 rounded-full border border-mint-400/22 bg-mint-400/9 px-2 py-0.5">
              <TrendingUp size={10.5} className="text-mint-400" />
              <span className="num text-[10px] text-mint-300">{pct(asset.change24h, 2)}</span>
            </div>
          </div>
        </div>

        {/* chart */}
        <div className="mt-4 px-2">
          <Sparkline
            points={asset.spark}
            width={520}
            height={112}
            stroke="#ff9d4d"
            strokeWidth={2.1}
            className="w-full"
          />
        </div>

        {/* risk band */}
        <div className="px-6 pt-2">
          <div className="flex items-center justify-between num text-[8.5px] uppercase tracking-[0.2em] text-mist-500">
            <span className="text-rose-400/85">stop −8%</span>
            <span>entry</span>
            <span className="text-mint-400/85">target +20%</span>
          </div>

          <div className="relative mt-2 h-[7px] w-full overflow-hidden rounded-full bg-white/[0.055]">
            <div className="absolute inset-y-0 left-0 w-[61.3%] rounded-full bg-gradient-to-r from-rose-600/70 to-rose-500/25" />
            <div className="absolute inset-y-0 right-0 w-[38.7%] rounded-full bg-gradient-to-l from-mint-500/75 to-mint-400/18" />
            <div className="absolute left-[61.3%] top-1/2 h-[15px] w-[2.5px] -translate-y-1/2 rounded-full bg-ember-300 shadow-[0_0_12px_rgba(255,143,66,0.85)]" />
          </div>

          <div className="mt-2 flex items-center justify-between num text-[10px]">
            <span className="text-mist-400">{usd(LIVE_SL_PRICE)}</span>
            <span className="text-ember-300">{usd(LIVE_ENTRY_PRICE)}</span>
            <span className="text-mist-400">{usd(LIVE_TP_PRICE)}</span>
          </div>
        </div>

        {/* params grid */}
        <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden border-t border-white/[0.06] bg-white/[0.028]">
          {[
            { label: 'Size', value: '100%', sub: 'of wallet' },
            { label: 'Take-profit', value: '+20%', sub: usd(LIVE_TP_PRICE), tone: 'text-mint-300' },
            { label: 'Stop-loss', value: '−8%', sub: usd(LIVE_SL_PRICE), tone: 'text-rose-300' },
            { label: 'Mirrors', value: '1', sub: 'wallet' },
          ].map(cell => (
            <div key={cell.label} className="bg-ink-900/55 px-6 py-4">
              <div className="num text-[8.5px] uppercase tracking-[0.22em] text-mist-500">
                {cell.label}
              </div>
              <div className={`mt-1.5 num text-[17px] tracking-[-0.028em] ${cell.tone ?? 'text-mist-50'}`}>
                {cell.value}
              </div>
              <div className="mt-0.5 text-[10px] text-mist-500">{cell.sub}</div>
            </div>
          ))}
        </div>

        {/* footer CTA */}
        <div className="flex items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-2.5">
            <div className="flex -space-x-2">
              {[0].map(i => (
                <div
                  key={i}
                  className="h-7 w-7 rounded-full border-2 border-ink-900"
                  style={{
                    background: `linear-gradient(${135 + i * 42}deg, ${
                      ['#ff9d4d', '#7c66ff', '#34e0a0', '#ff7d95'][i]
                    }, ${['#f9731a', '#5a44d6', '#0aa873', '#e5304f'][i]})`,
                  }}
                />
              ))}
            </div>
            <div>
              <div className="num text-[10.5px] text-mist-200">1 wallet</div>
              <div className="num text-[8.5px] uppercase tracking-[0.16em] text-mist-500">
                ran this plan
              </div>
            </div>
          </div>

          <Link
            href={PLAN_PATH}
            className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-ember-300 to-ember-500 px-5 py-2.5 text-[12.5px] font-semibold text-ink-950 shadow-[0_12px_32px_-10px_rgba(255,143,66,0.6)] transition-transform duration-200 hover:-translate-y-0.5"
          >
            Mirror this plan
            <ArrowRight
              size={14}
              strokeWidth={2.4}
              className="transition-transform duration-200 group-hover:translate-x-0.5"
            />
          </Link>
        </div>
      </div>

      {/* floating chips */}
      <FloatingChip
        className="-left-6 top-[27%] sm:-left-12"
        delay={0.85}
        icon={<ShieldCheck size={13} className="text-mint-400" />}
        label="Bracket verified"
        value="onchain"
      />
      <FloatingChip
        className="-right-4 top-[9%] sm:-right-10"
        delay={1.02}
        icon={<Lock size={13} className="text-ember-300" />}
        label="Author fee"
        value="25 bps"
      />
      <FloatingChip
        className="-right-2 bottom-[13%] sm:-right-8"
        delay={1.18}
        icon={<Zap size={13} className="text-violet-300" />}
        label="Settled on"
        value="Base"
      />
    </motion.div>
  );
}

function FloatingChip({
  className,
  icon,
  label,
  value,
  delay,
}: {
  className: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.86, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.72, delay, ease: [0.22, 0.68, 0.32, 1] }}
      className={`absolute hidden items-center gap-2.5 rounded-2xl border border-white/[0.09] bg-ink-850/88 px-3.5 py-2.5 shadow-[0_18px_44px_-16px_rgba(0,0,0,0.8)] backdrop-blur-xl sm:flex ${className}`}
    >
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.055]">
        {icon}
      </span>
      <span>
        <span className="block num text-[7.5px] uppercase tracking-[0.2em] text-mist-500">
          {label}
        </span>
        <span className="block num text-[11px] text-mist-100">{value}</span>
      </span>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* FAQ accordion                                                       */
/* ------------------------------------------------------------------ */
function FaqItem({ item, index }: { item: (typeof FAQ)[number]; index: number }) {
  const [open, setOpen] = useState(index === 0);

  return (
    <div
      className={`overflow-hidden rounded-2xl border transition-colors duration-300 ${
        open
          ? 'border-ember-500/24 bg-ember-500/[0.05]'
          : 'border-white/[0.07] bg-white/[0.022] hover:border-white/[0.11]'
      }`}
    >
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-start justify-between gap-5 px-6 py-5 text-left"
        aria-expanded={open}
      >
        <span className="flex items-start gap-4">
          <span className="num mt-[3px] text-[10px] tracking-[0.18em] text-ember-400/70">
            {String(index + 1).padStart(2, '0')}
          </span>
          <span className="font-display text-[16.5px] font-medium leading-[1.42] tracking-[-0.018em] text-mist-50">
            {item.q}
          </span>
        </span>

        <span
          className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-all duration-300 ${
            open
              ? 'rotate-180 border-ember-400/35 bg-ember-400/12 text-ember-300'
              : 'border-white/[0.1] text-mist-400'
          }`}
        >
          <ChevronDown size={14} />
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.22, 0.68, 0.32, 1] }}
          >
            <p className="px-6 pb-6 pl-[62px] text-[14px] leading-[1.82] text-mist-400">
              {item.a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export default function Home() {
  return (
    <>
      {/* ================= HERO ================= */}
      <section className="relative overflow-hidden pt-14 pb-20 sm:pt-20 sm:pb-28">
        {/* hero image wash */}
        <div className="pointer-events-none absolute inset-0">
          <img
            src="/images/hero-bg.jpg"
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover opacity-[0.34]"
            style={{
              maskImage: 'radial-gradient(ellipse 88% 74% at 62% 32%, #000 12%, transparent 76%)',
              WebkitMaskImage:
                'radial-gradient(ellipse 88% 74% at 62% 32%, #000 12%, transparent 76%)',
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, rgba(4,6,12,0.28) 0%, rgba(4,6,12,0.06) 38%, rgba(4,6,12,0.92) 92%, #04060c 100%)',
            }}
          />
        </div>

        <div className="relative mx-auto max-w-[1240px] px-5 sm:px-8">
          <div className="grid items-center gap-14 lg:grid-cols-[1.06fr_0.94fr] lg:gap-10">
            {/* copy */}
            <div>
              <Reveal delay={0.04}>
                <div className="inline-flex items-center gap-2.5 rounded-full border border-white/[0.09] bg-white/[0.032] py-1.5 pl-1.5 pr-4 backdrop-blur-xl">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-ember-500/22 to-ember-400/10 px-2.5 py-1">
                    <Sparkles size={11} className="text-ember-300" />
                    <span className="num text-[8.5px] uppercase tracking-[0.19em] text-ember-200">
                      Runtime Agent Week
                    </span>
                  </span>
                  <span className="num text-[8.5px] uppercase tracking-[0.21em] text-mist-400">
                    Definitive Flash · Best Social Trading Build
                  </span>
                </div>
              </Reveal>

              <Reveal delay={0.12}>
                <h1 className="mt-7 text-[46px] leading-[0.99] font-semibold tracking-[-0.042em] text-mist-50 sm:text-[62px] sm:leading-[0.96] lg:text-[74px] lg:leading-[0.93]">
                  Publish a trade plan.
                  <br />
                  Anyone can mirror it&nbsp;—
                  <br />
                  <span className="font-serif-it text-gradient-ember">with their own stop-loss.</span>
                </h1>
              </Reveal>

              <Reveal delay={0.2}>
                <p className="mt-7 max-w-[54ch] text-[16.5px] leading-[1.76] text-mist-300 sm:text-[18.5px] sm:leading-[1.72]">
                  Night Desk turns a plan into a link. Someone opens it, and it is re-quoted
                  against <em className="font-serif-it text-mist-100 not-italic">their</em> wallet
                  and balance, with their own take-profit and stop-loss attached.
                  <span className="text-mist-100"> The author cannot exit you.</span>
                </p>
              </Reveal>

              <Reveal delay={0.28}>
                <div className="mt-9 flex flex-wrap items-center gap-3">
                  <Link
                    href="/create"
                    className="group inline-flex items-center gap-2.5 rounded-full bg-gradient-to-b from-ember-300 to-ember-500 px-7 py-4 text-[15px] font-semibold text-ink-950 shadow-[0_18px_48px_-12px_rgba(255,143,66,0.62)] transition-all duration-200 hover:-translate-y-[2px] hover:shadow-[0_24px_62px_-12px_rgba(255,143,66,0.8)]"
                  >
                    Compose a plan
                    <ArrowRight
                      size={17}
                      strokeWidth={2.4}
                      className="transition-transform duration-200 group-hover:translate-x-1"
                    />
                  </Link>

                  <Link
                    href="/board"
                    className="group inline-flex items-center gap-2.5 rounded-full border border-white/[0.11] bg-white/[0.035] px-7 py-4 text-[15px] font-medium text-mist-100 backdrop-blur-xl transition-all duration-200 hover:-translate-y-[2px] hover:border-white/[0.19] hover:bg-white/[0.07]"
                  >
                    See published plans
                    <ArrowUpRight
                      size={16}
                      className="text-mist-300 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                    />
                  </Link>
                </div>
              </Reveal>

              {/* trust row */}
              <Reveal delay={0.36}>
                <div className="mt-11 flex flex-wrap items-center gap-x-8 gap-y-4">
                  {[
                    { value: '100%', label: 'mirrors ran as published' },
                    { value: '5 / 5', label: 'compliance checks green' },
                    { value: '24/7', label: 'market hours' },
                  ].map(stat => (
                    <div key={stat.label} className="flex items-center gap-2.5">
                      <div className="h-8 w-[2.5px] rounded-full bg-gradient-to-b from-ember-400 to-ember-600/25" />
                      <div>
                        <div className="num text-[16px] font-medium tracking-[-0.028em] text-mist-50">
                          {stat.value}
                        </div>
                        <div className="num text-[8.5px] uppercase tracking-[0.19em] text-mist-500">
                          {stat.label}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>

            {/* plan card */}
            <div className="relative">
              <HeroPlanCard />
            </div>
          </div>
        </div>
      </section>

      {/* ================= STATS BAND ================= */}
      <section className="relative border-y border-white/[0.065] bg-gradient-to-b from-white/[0.022] to-transparent">
        <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
          <div className="grid grid-cols-2 divide-x divide-y divide-white/[0.06] sm:grid-cols-4 sm:divide-y-0">
            {STATS.map((stat, i) => (
              <Reveal key={stat.label} delay={i * 0.08} className="px-2 py-9 sm:px-7">
                <div className="num text-[30px] font-medium leading-none tracking-[-0.038em] text-mist-50 sm:text-[38px]">
                  {stat.value}
                </div>
                <div className="mt-2.5 text-[12.5px] font-medium text-mist-200">{stat.label}</div>
                <div className="mt-1 text-[10.5px] leading-[1.6] text-mist-500">{stat.sub}</div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ================= THE INVERSION ================= */}
      <section id="inversion" className="relative py-24 sm:py-32">
        <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
          <SectionHeading
            eyebrow="The inversion"
            title="Every copy-trading product copies the"
            accent="trade."
            description="You follow someone, and when they exit, you exit — on their schedule, at their size, in their risk. Night Desk copies the plan instead. Each person who opens the link runs it themselves."
            align="center"
          />

          <div className="mt-16 grid gap-6 lg:grid-cols-2">
            {/* old way */}
            <Reveal delay={0.05}>
              <div className="relative h-full overflow-hidden rounded-[22px] border border-white/[0.07] bg-white/[0.018] p-8 sm:p-10">
                <div className="absolute right-0 top-0 h-[220px] w-[220px] rounded-full bg-rose-500/[0.07] blur-[60px]" />

                <div className="flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-rose-400/18 bg-rose-400/[0.08]">
                    <BarChart3 size={17} className="text-rose-300" />
                  </span>
                  <div>
                    <div className="num text-[9px] uppercase tracking-[0.24em] text-rose-300/80">
                      The old way
                    </div>
                    <div className="font-display text-[17px] font-medium tracking-[-0.022em] text-mist-100">
                      Copy the trade
                    </div>
                  </div>
                </div>

                <ul className="mt-8 space-y-4">
                  {[
                    'You inherit their position size, not yours',
                    'When they exit, you exit — ready or not',
                    'Their risk tolerance becomes your risk tolerance',
                    'One shared order book entry, one shared fate',
                    'No way to verify what actually landed',
                  ].map(item => (
                    <li key={item} className="flex items-start gap-3">
                      <span className="mt-[7px] inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border border-rose-400/22 bg-rose-400/[0.08]">
                        <Plus size={10} className="rotate-45 text-rose-300" />
                      </span>
                      <span className="text-[14px] leading-[1.72] text-mist-400">{item}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-9 rounded-2xl border border-rose-400/12 bg-rose-400/[0.045] px-5 py-4">
                  <p className="text-[12px] leading-[1.72] text-mist-400">
                    The result: a signal you have to trust, and an exit you cannot control.
                  </p>
                </div>
              </div>
            </Reveal>

            {/* night desk */}
            <Reveal delay={0.14}>
              <div className="relative h-full overflow-hidden rounded-[22px] border border-ember-500/22 bg-gradient-to-b from-ember-500/[0.085] via-ember-500/[0.028] to-white/[0.014] p-8 sm:p-10">
                <div className="absolute -right-10 -top-10 h-[260px] w-[260px] rounded-full bg-ember-500/[0.16] blur-[70px]" />
                <div className="absolute inset-x-0 top-0 h-[2.5px] bg-gradient-to-r from-transparent via-ember-400/70 to-transparent" />

                <div className="flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-ember-400/25 bg-ember-400/[0.12]">
                    <Link2 size={17} className="text-ember-300" />
                  </span>
                  <div>
                    <div className="num text-[9px] uppercase tracking-[0.24em] text-ember-300">
                      The Night Desk way
                    </div>
                    <div className="font-display text-[17px] font-medium tracking-[-0.022em] text-mist-50">
                      Copy the plan
                    </div>
                  </div>
                </div>

                <ul className="mt-8 space-y-4">
                  {[
                    'Your wallet, your balance, your position size',
                    'Your own take-profit and stop-loss, signed by you',
                    'The author closing cannot exit your position',
                    'Every mirror is an independent, exchange-held order',
                    'Protection levels read back from the chain, verifiable',
                  ].map(item => (
                    <li key={item} className="flex items-start gap-3">
                      <span className="mt-[6px] inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border border-mint-400/28 bg-mint-400/[0.11]">
                        <Check size={10.5} strokeWidth={3} className="text-mint-300" />
                      </span>
                      <span className="text-[14px] leading-[1.72] text-mist-200">{item}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-9 rounded-2xl border border-ember-400/16 bg-ember-400/[0.07] px-5 py-4">
                  <p className="text-[12px] leading-[1.72] text-ember-100/85">
                    The result: a plan you can audit, and protection that is yours by construction.
                  </p>
                </div>
              </div>
            </Reveal>
          </div>

          {/* pull quote */}
          <Reveal delay={0.18}>
            <figure className="relative mt-16 overflow-hidden rounded-[24px] border border-white/[0.07] bg-gradient-to-br from-white/[0.045] via-white/[0.016] to-transparent px-8 py-12 sm:px-14 sm:py-16">
              <div className="absolute left-8 top-8 opacity-[0.09] sm:left-14">
                <Quote size={110} strokeWidth={1.1} className="text-ember-300" />
              </div>

              <blockquote className="relative max-w-[62ch]">
                <p className="font-serif-it text-[24px] leading-[1.42] tracking-[-0.018em] text-mist-50 sm:text-[32px] sm:leading-[1.36]">
                  “A plan never says <span className="text-ember-200">buy at $240, stop at $202.</span>{' '}
                  It says 20% of the wallet, +20% take-profit, −8% stop-loss. Nothing is absolute
                  until a wallet and a moment resolve it.”
                </p>
              </blockquote>

              <figcaption className="mt-9 flex items-center gap-4">
                <div className="h-11 w-11 rounded-full bg-gradient-to-br from-ember-300 to-ember-600 shadow-[0_10px_28px_-8px_rgba(255,143,66,0.6)]" />
                <div>
                  <div className="text-[13.5px] font-medium text-mist-100">Night Desk</div>
                  <div className="num text-[9px] uppercase tracking-[0.22em] text-mist-500">
                    Why parametric sizing matters
                  </div>
                </div>
              </figcaption>
            </figure>
          </Reveal>
        </div>
      </section>

      {/* ================= PRINCIPLES ================= */}
      <section id="principles" className="relative py-24 sm:py-28">
        <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
          <SectionHeading
            eyebrow="Built on three rules"
            title="Protection is not a feature."
            accent="It is the architecture."
            description="Every design decision in Night Desk traces back to one question: what happens when the author is wrong, unavailable, or acting in their own interest? The answer has to be nothing."
          />

          <RevealGroup className="mt-16 grid gap-6 md:grid-cols-3">
            {PRINCIPLES.map((p, i) => {
              const icons = {
                percent: <TrendingUp size={19} />,
                shield: <ShieldCheck size={19} />,
                chart: <BarChart3 size={19} />,
              } as const;
              const key = p.icon as keyof typeof icons;

              return (
                <RevealItem key={p.kicker}>
                  <div className="group relative h-full overflow-hidden rounded-[20px] border border-white/[0.07] bg-white/[0.022] p-8 transition-all duration-400 hover:-translate-y-1.5 hover:border-ember-500/24 hover:bg-white/[0.038]">
                    {/* hover glow */}
                    <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-ember-500/[0.13] opacity-0 blur-[52px] transition-opacity duration-500 group-hover:opacity-100" />

                    <div className="flex items-start justify-between">
                      <span className="inline-flex h-12 w-12 items-center justify-center rounded-[14px] border border-ember-400/22 bg-gradient-to-br from-ember-400/[0.16] to-ember-600/[0.05] text-ember-300">
                        {icons[key]}
                      </span>
                      <span className="num text-[34px] font-medium leading-none tracking-[-0.045em] text-white/[0.055]">
                        {p.kicker}
                      </span>
                    </div>

                    <h3 className="mt-7 text-[19px] font-semibold leading-[1.32] tracking-[-0.026em] text-mist-50">
                      {p.title}
                    </h3>

                    <p className="mt-4 text-[13.5px] leading-[1.82] text-mist-400">{p.body}</p>

                    <div className="mt-7 h-[2px] w-0 rounded-full bg-gradient-to-r from-ember-400 to-ember-600/0 transition-all duration-500 group-hover:w-full" />

                    <div className="mt-5 flex items-center gap-2 text-[11px] font-medium text-ember-300 opacity-0 transition-opacity duration-400 group-hover:opacity-100">
                      <span className="num uppercase tracking-[0.19em]">Verified in build</span>
                      <ArrowRight size={12} />
                    </div>

                    <div className="sr-only">{i}</div>
                  </div>
                </RevealItem>
              );
            })}
          </RevealGroup>
        </div>
      </section>

      {/* ================= HOW IT WORKS ================= */}
      <section id="how" className="relative overflow-hidden py-24 sm:py-32">
        {/* texture */}
        <div className="pointer-events-none absolute inset-0">
          <img
            src="/images/grid-texture.jpg"
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover opacity-[0.24]"
            style={{
              maskImage: 'radial-gradient(ellipse 76% 62% at 50% 46%, #000 8%, transparent 78%)',
              WebkitMaskImage:
                'radial-gradient(ellipse 76% 62% at 50% 46%, #000 8%, transparent 78%)',
            }}
          />
        </div>

        <div className="relative mx-auto max-w-[1240px] px-5 sm:px-8">
          <SectionHeading
            eyebrow="The flow"
            title="Four steps from an idea to"
            accent="someone else's position."
            description="Publishing costs nothing beyond the trade itself. The platform charges a flat fee on execution, surfaced in the preview before anything is signed."
            align="center"
          />

          <div className="relative mt-20">
            {/* connecting line */}
            <div className="pointer-events-none absolute left-[13%] right-[13%] top-[46px] hidden h-[2px] lg:block">
              <div className="h-full w-full bg-gradient-to-r from-transparent via-white/[0.1] to-transparent" />
              <motion.div
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1.5, delay: 0.35, ease: [0.22, 0.68, 0.32, 1] }}
                className="absolute inset-0 origin-left bg-gradient-to-r from-ember-400/0 via-ember-400/65 to-ember-400/0"
              />
            </div>

            <RevealGroup className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4" stagger={0.13}>
              {STEPS.map(step => (
                <RevealItem key={step.n}>
                  <div className="group relative flex h-full flex-col items-center text-center">
                    {/* node */}
                    <div className="relative">
                      <div className="absolute inset-0 rounded-full bg-ember-400/25 blur-[14px] transition-opacity duration-400 group-hover:opacity-100 lg:opacity-0" />
                      <div className="relative flex h-[92px] w-[92px] items-center justify-center rounded-full border border-white/[0.1] bg-ink-900 shadow-[0_18px_46px_-16px_rgba(0,0,0,0.85)] transition-all duration-400 group-hover:border-ember-400/42 group-hover:scale-[1.06]">
                        <div className="flex h-[70px] w-[70px] items-center justify-center rounded-full border border-ember-400/22 bg-gradient-to-br from-ember-400/[0.16] to-transparent">
                          <span className="num text-[19px] font-medium tracking-[-0.035em] text-ember-200">
                            {step.n}
                          </span>
                        </div>
                      </div>
                    </div>

                    <h3 className="mt-7 text-[19px] font-semibold tracking-[-0.026em] text-mist-50">
                      {step.title}
                    </h3>

                    <p className="mt-3.5 max-w-[30ch] text-[13px] leading-[1.82] text-mist-400">
                      {step.body}
                    </p>

                    <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/[0.075] bg-white/[0.028] px-3.5 py-1.5">
                      <span className="h-1 w-1 rounded-full bg-ember-400/70" />
                      <span className="num text-[8.5px] uppercase tracking-[0.17em] text-mist-500">
                        {step.detail}
                      </span>
                    </div>
                  </div>
                </RevealItem>
              ))}
            </RevealGroup>
          </div>

          <Reveal delay={0.2}>
            <div className="mt-16 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/create"
                className="group inline-flex items-center gap-2.5 rounded-full bg-gradient-to-b from-ember-300 to-ember-500 px-7 py-4 text-[14.5px] font-semibold text-ink-950 shadow-[0_18px_46px_-12px_rgba(255,143,66,0.58)] transition-all duration-200 hover:-translate-y-[2px]"
              >
                Start with step one
                <ArrowRight size={16} strokeWidth={2.4} className="transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
              <Link
                href={PLAN_PATH}
                className="inline-flex items-center gap-2.5 rounded-full border border-white/[0.11] bg-white/[0.032] px-7 py-4 text-[14.5px] font-medium text-mist-100 transition-all duration-200 hover:-translate-y-[2px] hover:border-white/[0.18] hover:bg-white/[0.062]"
              >
                Open a live plan link
                <ArrowUpRight size={15} />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ================= 24/7 MARKET ================= */}
      <section id="network" className="relative py-24 sm:py-28">
        <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
          <div className="grid items-center gap-14 lg:grid-cols-2">
            <div>
              <Reveal>
                <Eyebrow tone="violet">Tokenized equities · Base</Eyebrow>
              </Reveal>

              <Reveal delay={0.08}>
                <h2 className="mt-6 text-[34px] leading-[1.06] font-semibold tracking-[-0.036em] text-mist-50 sm:text-[46px] sm:leading-[1.03]">
                  The NYSE closes at 4pm.
                  <br />
                  <span className="font-serif-it text-gradient-mint">
                    Your stop-loss does not.
                  </span>
                </h2>
              </Reveal>

              <Reveal delay={0.15}>
                <p className="mt-7 max-w-[52ch] text-[15.5px] leading-[1.82] text-mist-400 sm:text-[16.5px]">
                  A plan published at midnight can still be entered, and a stop-loss can still
                  fire, while every traditional broker is dark. It is a twenty-four hour market
                  where the protection matters more, not less — which is exactly why every Night
                  Desk mirror ships with its bracket already attached.
                </p>
              </Reveal>

              <RevealGroup className="mt-9 space-y-4">
                {[
                  {
                    icon: <Globe2 size={16} />,
                    title: 'Seven tokenized equities',
                    body: 'NVDAc, TSLAc, AAPLc, MSFTc, METAc, GOOGLc and AMZNc — quoted in USDC, settled on Base.',
                  },
                  {
                    icon: <Clock size={16} />,
                    title: 'Always-on execution',
                    body: 'Definitive Flash routes around the clock. No session gaps, no overnight exposure you cannot manage.',
                  },
                  {
                    icon: <Lock size={16} />,
                    title: 'Keys never leave the browser',
                    body: 'Signing happens locally with EIP-712. The API key never reaches the client, and the client key never reaches the server.',
                  },
                ].map(item => (
                  <RevealItem key={item.title}>
                    <div className="group flex items-start gap-4 rounded-2xl border border-white/[0.065] bg-white/[0.02] p-5 transition-colors duration-300 hover:border-violet-400/22 hover:bg-violet-400/[0.045]">
                      <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-violet-400/22 bg-violet-400/[0.1] text-violet-300">
                        {item.icon}
                      </span>
                      <div>
                        <h4 className="text-[14.5px] font-medium tracking-[-0.018em] text-mist-100">
                          {item.title}
                        </h4>
                        <p className="mt-1.5 text-[12.5px] leading-[1.78] text-mist-400">
                          {item.body}
                        </p>
                      </div>
                    </div>
                  </RevealItem>
                ))}
              </RevealGroup>
            </div>

            {/* image + overlay stats */}
            <Reveal delay={0.12}>
              <div className="relative">
                <div
                  className="pointer-events-none absolute -inset-6 rounded-[30px]"
                  style={{
                    background:
                      'radial-gradient(ellipse 60% 56% at 50% 50%, rgba(124,102,255,0.2), transparent 72%)',
                    filter: 'blur(28px)',
                  }}
                />

                <div className="relative overflow-hidden rounded-[22px] border border-white/[0.085]">
                  <img
                    src="/images/desk-night.jpg"
                    alt="A trading desk at night, lit by a warm lamp with charts on screen"
                    className="h-[420px] w-full object-cover sm:h-[520px]"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/22 to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-br from-violet-500/[0.14] via-transparent to-ember-500/[0.12]" />

                  {/* floating stat panel */}
                  <div className="absolute inset-x-5 bottom-5">
                    <div className="glass-deep rounded-2xl p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="num text-[8.5px] uppercase tracking-[0.22em] text-mist-500">
                            Session coverage
                          </div>
                          <div className="mt-1.5 num text-[24px] font-medium tracking-[-0.035em] text-mist-50">
                            168 hrs<span className="text-mist-500"> / week</span>
                          </div>
                        </div>

                        <Gauge value={100} size={72} stroke={7} color="#7c66ff">
                          <div className="text-center">
                            <div className="num text-[13px] font-medium text-violet-200">24/7</div>
                          </div>
                        </Gauge>
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.022]">
                        {[
                          { k: 'NYSE', v: '6.5 hrs', sub: 'per day' },
                          { k: 'Crypto', v: '24 hrs', sub: 'per day' },
                          { k: 'Night Desk', v: '24 hrs', sub: 'per day' },
                        ].map(cell => (
                          <div key={cell.k} className="bg-ink-900/72 px-3 py-3">
                            <div className="num text-[7.5px] uppercase tracking-[0.2em] text-mist-500">
                              {cell.k}
                            </div>
                            <div className="mt-1 num text-[12px] text-mist-100">{cell.v}</div>
                            <div className="text-[8px] text-mist-600">{cell.sub}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* asset chips */}
                <div className="mt-5 flex flex-wrap gap-2">
                  {ASSETS.slice(0, 6).map(a => (
                    <div
                      key={a.token}
                      className="inline-flex items-center gap-2 rounded-full border border-white/[0.075] bg-white/[0.026] px-3.5 py-2"
                    >
                      <span className="num text-[10px] text-mist-200">{a.token}</span>
                      <span
                        className={`num text-[9px] ${
                          a.change24h >= 0 ? 'text-mint-400' : 'text-rose-400'
                        }`}
                      >
                        {pct(a.change24h, 2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ================= BOARD PREVIEW ================= */}
      <section id="board" className="relative py-24 sm:py-28">
        <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <SectionHeading
              eyebrow="The board"
              title="Ranked by the money their mirrors"
              accent="actually booked."
              description="Realised profit is what settled, not what was quoted. A plan whose fills cannot be read back is reported as unreadable rather than quietly ranked at zero."
            />

            <Reveal delay={0.16}>
              <Link
                href="/board"
                className="group inline-flex items-center gap-2.5 rounded-full border border-white/[0.11] bg-white/[0.032] px-6 py-3.5 text-[13.5px] font-medium text-mist-100 transition-all duration-200 hover:-translate-y-1 hover:border-ember-400/32 hover:bg-ember-400/[0.08]"
              >
                View the full board
                <ArrowUpRight
                  size={15}
                  className="transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                />
              </Link>
            </Reveal>
          </div>

          <RevealGroup className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3" stagger={0.08}>
            {PLANS.slice(0, 6).map((plan, index) => {
              const asset = assetByToken(plan.symbol);
              const positive = (plan.returnPct ?? 0) >= 0;

              return (
                <RevealItem key={plan.id}>
                  <Link
                    href={`/p/${plan.id}`}
                    className="group block h-full overflow-hidden rounded-[18px] border border-white/[0.072] bg-white/[0.021] transition-all duration-350 hover:-translate-y-1.5 hover:border-ember-500/26 hover:bg-white/[0.038] hover:shadow-[0_28px_66px_-24px_rgba(255,143,66,0.32)]"
                  >
                    {/* rank ribbon */}
                    {index === 0 && (
                      <div className="h-[2.5px] w-full bg-gradient-to-r from-ember-300 via-ember-500 to-ember-600" />
                    )}

                    <div className="p-6">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="flex h-11 w-11 items-center justify-center rounded-[13px] border border-white/[0.09] bg-gradient-to-br from-white/[0.075] to-white/[0.012]">
                              <span className="num text-[11px] font-medium text-mist-100">
                                {asset.ticker.slice(0, 2)}
                              </span>
                            </div>
                            {index === 0 && (
                              <div className="absolute -right-1.5 -top-1.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-gradient-to-b from-gold-300 to-ember-500 shadow-[0_6px_16px_-4px_rgba(255,180,90,0.7)]">
                                <span className="num text-[8px] font-semibold text-ink-950">1</span>
                              </div>
                            )}
                          </div>

                          <div>
                            <div className="num text-[13px] font-medium text-mist-50">
                              {plan.symbol}
                            </div>
                            <div className="mt-0.5 text-[10px] text-mist-500">
                              @{plan.authorHandle}
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div
                            className={`num text-[17px] font-medium tracking-[-0.032em] ${
                              positive ? 'text-mint-300' : 'text-rose-300'
                            }`}
                          >
                            {pct(plan.returnPct, 2)}
                          </div>
                          <div className="num text-[8px] uppercase tracking-[0.18em] text-mist-500">
                            return
                          </div>
                        </div>
                      </div>

                      {/* sparkline */}
                      <div className="mt-4">
                        <Sparkline
                          points={asset.spark}
                          width={320}
                          height={52}
                          stroke={positive ? '#34e0a0' : '#fb4d6d'}
                          strokeWidth={1.8}
                          className="w-full"
                          animate={false}
                        />
                      </div>

                      {/* params */}
                      <div className="mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-white/[0.058] bg-white/[0.018]">
                        {[
                          { k: 'Size', v: `${plan.sizePct}%` },
                          {
                            k: 'Target',
                            v: `+${plan.tpPct}%`,
                            tone: 'text-mint-300',
                          },
                          {
                            k: 'Stop',
                            v: `−${plan.slPct}%`,
                            tone: 'text-rose-300',
                          },
                        ].map(cell => (
                          <div key={cell.k} className="bg-ink-900/62 px-3 py-2.5">
                            <div className="num text-[7px] uppercase tracking-[0.19em] text-mist-500">
                              {cell.k}
                            </div>
                            <div
                              className={`mt-1 num text-[11px] ${cell.tone ?? 'text-mist-100'}`}
                            >
                              {cell.v}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* footer */}
                      <div className="mt-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <div className="h-[5px] w-[5px] rounded-full bg-ember-400/80" />
                            <span className="num text-[9px] text-mist-500">
                              {plan.mirrors} mirrors
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="h-[5px] w-[5px] rounded-full bg-violet-400/70" />
                            <span className="num text-[9px] text-mist-500">
                              {usdCompact(plan.notional)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 rounded-full border border-white/[0.075] bg-white/[0.026] px-2.5 py-1">
                          <ShieldCheck size={9.5} className="text-mint-400" />
                          <span className="num text-[8px] text-mist-400">
                            {plan.compliancePct}% verified
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center gap-1.5 text-[9px] text-mist-600">
                        <Clock size={9} />
                        <span>published {relativeTime(plan.createdAt)}</span>
                        <span className="mx-1 h-[3px] w-[3px] rounded-full bg-mist-700" />
                        <span>{usdCompact(plan.realisedUsd)} realised</span>
                      </div>
                    </div>

                    {/* hover bar */}
                    <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-ember-400/0 to-transparent transition-all duration-400 group-hover:via-ember-400/65" />
                  </Link>
                </RevealItem>
              );
            })}
          </RevealGroup>

          <Reveal delay={0.14}>
            <div className="mt-10 rounded-2xl border border-white/[0.07] bg-white/[0.022] px-6 py-5">
              <div className="flex items-start gap-3.5">
                <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-ember-400/22 bg-ember-400/[0.1]">
                  <Sparkles size={13} className="text-ember-300" />
                </span>
                <p className="text-[11.5px] leading-[1.8] text-mist-400">
                  <strong className="font-medium text-mist-200">
                    Unpriced is not the same as flat.
                  </strong>{' '}
                  A plan whose fills have not been read back yet has no score at all, so it sinks
                  to the bottom of the board rather than being ranked as a zero. Before anything
                  has closed, every plan books $0.00 realised and the ordering falls through to
                  open performance — the page says so, in words, instead of presenting a column of
                  zeros as a result.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ================= PROOF / COMPLIANCE ================= */}
      <section className="relative py-24 sm:py-28">
        <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
          <div className="grid items-start gap-12 lg:grid-cols-[0.92fr_1.08fr]">
            <div className="lg:sticky lg:top-28">
              <Reveal>
                <Eyebrow tone="mint">Did they actually run it?</Eyebrow>
              </Reveal>

              <Reveal delay={0.08}>
                <h2 className="mt-6 text-[32px] leading-[1.08] font-semibold tracking-[-0.034em] text-mist-50 sm:text-[42px] sm:leading-[1.05]">
                  A claim is the first thing
                  <br />
                  <span className="font-serif-it text-gradient-mint">a sharp reviewer pokes at.</span>
                </h2>
              </Reveal>

              <Reveal delay={0.14}>
                <p className="mt-6 max-w-[48ch] text-[15px] leading-[1.82] text-mist-400">
                  So it does not have to be a claim. Every mirror is an order on the exchange with
                  its bracket levels in the fill data, and the proof endpoint already reads that
                  back. The plan page compares the protection that actually landed against the
                  levels the plan asked for.
                </p>
              </Reveal>

              <Reveal delay={0.2}>
                <div className="mt-8 rounded-2xl border border-mint-400/16 bg-mint-400/[0.05] p-6">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-mint-400/26 bg-mint-400/[0.12]">
                      <ShieldCheck size={17} className="text-mint-300" />
                    </span>
                    <div>
                      <div className="num text-[22px] font-medium tracking-[-0.032em] text-mint-200">
                        100%
                      </div>
                      <div className="num text-[8px] uppercase tracking-[0.21em] text-mint-400/70">
                        of mirrors ran as published
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 h-[6px] w-full overflow-hidden rounded-full bg-white/[0.07]">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: '100%' }}
                      viewport={{ once: true }}
                      transition={{ duration: 1.35, ease: [0.22, 0.68, 0.32, 1] }}
                      className="h-full rounded-full bg-gradient-to-r from-mint-500 to-mint-300"
                    />
                  </div>

                  <div className="mt-3 flex items-center justify-between num text-[8.5px] uppercase tracking-[0.17em] text-mist-500">
                    <span>1 verified read</span>
                    <span>0 deviated · 0 unprotected</span>
                  </div>
                </div>
              </Reveal>
            </div>

            {/* checks list */}
            <Reveal delay={0.1}>
              <div className="overflow-hidden rounded-[22px] border border-white/[0.078] bg-white/[0.022]">
                <div className="flex items-center justify-between border-b border-white/[0.068] px-7 py-5">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                      {['#fb4d6d', '#ffcf70', '#34e0a0'].map(c => (
                        <span key={c} className="h-[9px] w-[9px] rounded-full" style={{ background: c, opacity: 0.72 }} />
                      ))}
                    </div>
                    <span className="num text-[9px] uppercase tracking-[0.21em] text-mist-500">
                      /api/proof · plan compliance readout
                    </span>
                  </div>

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-mint-400/22 bg-mint-400/[0.09] px-2.5 py-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-mint-400 animate-blink" />
                    <span className="num text-[8px] uppercase tracking-[0.16em] text-mint-300">
                      live read
                    </span>
                  </span>
                </div>

                <div className="px-7 py-6">
                  <div className="space-y-3.5">
                    {[
                      {
                        ok: true,
                        label: 'protection attached',
                        detail: 'wanted a take-profit / stop-loss pair',
                      },
                      {
                        ok: true,
                        label: 'protection still live',
                        detail: 'got active',
                      },
                      {
                        ok: true,
                        label: 'take-profit at +20%',
                        detail: `wanted ${usd(LIVE_TP_PRICE)} · got ${usd(LIVE_TP_PRICE)}`,
                      },
                      {
                        ok: true,
                        label: 'stop-loss at −8%',
                        detail: `wanted ${usd(LIVE_SL_PRICE)} · got ${usd(LIVE_SL_PRICE)}`,
                      },
                      {
                        ok: true,
                        label: 'levels sit on the correct side of the entry',
                        detail: 'got correct',
                      },
                    ].map((row, i) => (
                      <motion.div
                        key={row.label}
                        initial={{ opacity: 0, x: -14 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.55, delay: 0.16 + i * 0.1 }}
                        className="group flex items-center justify-between gap-4 rounded-xl border border-white/[0.058] bg-white/[0.018] px-5 py-3.5 transition-colors duration-300 hover:border-mint-400/22 hover:bg-mint-400/[0.038]"
                      >
                        <div className="flex items-center gap-3.5">
                          <span
                            className={`inline-flex h-[22px] w-[22px] items-center justify-center rounded-full border ${
                              row.ok
                                ? 'border-mint-400/32 bg-mint-400/[0.13] text-mint-300'
                                : 'border-rose-400/32 bg-rose-400/[0.13] text-rose-300'
                            }`}
                          >
                            <Check size={11.5} strokeWidth={3} />
                          </span>

                          <div>
                            <div className="text-[12.5px] font-medium text-mist-100">
                              {row.label}
                            </div>
                            <div className="mt-0.5 num text-[8.5px] uppercase tracking-[0.15em] text-mist-500">
                              {row.detail}
                            </div>
                          </div>
                        </div>

                        <ArrowUpRight
                          size={14}
                          className="text-mist-600 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                        />
                      </motion.div>
                    ))}
                  </div>

                  <div className="mt-6 rounded-xl border border-white/[0.062] bg-white/[0.016] px-5 py-4">
                    <p className="text-[10.5px] leading-[1.82] text-mist-500">
                      Every row is read back from the exchange by funder and order id. Nothing here
                      is self-reported. This is a{' '}
                      <span className="text-mist-300">readout, not a control</span> — nothing makes
                      anyone follow a plan, and a mirror that deviates is still their own position.
                      That independence is the product, not a flaw in it.
                    </p>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ================= EARNINGS ================= */}
      <section className="relative py-24 sm:py-28">
        <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
          <div className="relative overflow-hidden rounded-[26px] border border-white/[0.078]">
            <div className="absolute inset-0">
              <img
                src="/images/grid-texture.jpg"
                alt=""
                aria-hidden="true"
                className="h-full w-full object-cover opacity-[0.3]"
              />
              <div className="absolute inset-0 bg-gradient-to-br from-ink-950/94 via-ink-950/86 to-ember-950/60" />
              <div
                className="absolute -right-24 -top-24 h-[420px] w-[420px] rounded-full"
                style={{
                  background:
                    'radial-gradient(circle, rgba(255,143,66,0.22), transparent 68%)',
                  filter: 'blur(46px)',
                }}
              />
            </div>

            <div className="relative grid gap-12 px-8 py-16 sm:px-12 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
              <div>
                <Reveal>
                  <Eyebrow>Creator economics</Eyebrow>
                </Reveal>

                <Reveal delay={0.08}>
                  <h2 className="mt-6 text-[32px] leading-[1.07] font-semibold tracking-[-0.035em] text-mist-50 sm:text-[44px] sm:leading-[1.04]">
                    A plan that gets mirrored
                    <br />
                    <span className="font-serif-it text-gradient-ember">pays the person who wrote it.</span>
                  </h2>
                </Reveal>

                <Reveal delay={0.14}>
                  <p className="mt-6 max-w-[50ch] text-[15px] leading-[1.82] text-mist-300">
                    A flat 25 bps is charged on execution and surfaced in the preview before anyone
                    signs. Of the integrator fee generated by each mirror,{' '}
                    <span className="text-ember-200">60% is credited to the plan author</span> —
                    settled in USDC, from fills that actually reconciled.
                  </p>
                </Reveal>

                <RevealGroup className="mt-9 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {[
                    { k: 'Fee', v: '25', u: 'bps', sub: 'flat, on execution' },
                    { k: 'Author share', v: '60', u: '%', sub: 'of integrator fee' },
                    { k: 'Settlement', v: 'USDC', u: '', sub: 'on Base' },
                    { k: 'Payout step', v: '2', u: '-click', sub: 'prepare → settle' },
                  ].map((cell, i) => (
                    <RevealItem key={cell.k}>
                      <div className="rounded-2xl border border-white/[0.072] bg-white/[0.028] px-5 py-5">
                        <div className="num text-[8px] uppercase tracking-[0.21em] text-mist-500">
                          {cell.k}
                        </div>
                        <div className="mt-2 flex items-baseline gap-1">
                          <span className="num text-[26px] font-medium tracking-[-0.038em] text-mist-50">
                            {cell.v}
                          </span>
                          <span className="num text-[11px] text-ember-300">{cell.u}</span>
                        </div>
                        <div className="mt-1 text-[9px] text-mist-500">{cell.sub}</div>
                        <div className="sr-only">{i}</div>
                      </div>
                    </RevealItem>
                  ))}
                </RevealGroup>

                <Reveal delay={0.2}>
                  <Link
                    href="/payouts"
                    className="group mt-9 inline-flex items-center gap-2.5 rounded-full bg-gradient-to-b from-ember-300 to-ember-500 px-7 py-4 text-[14.5px] font-semibold text-ink-950 shadow-[0_18px_46px_-12px_rgba(255,143,66,0.58)] transition-all duration-200 hover:-translate-y-[2px]"
                  >
                    See the payout queue
                    <ArrowRight size={16} strokeWidth={2.4} className="transition-transform duration-200 group-hover:translate-x-1" />
                  </Link>
                </Reveal>
              </div>

              {/* earnings card */}
              <Reveal delay={0.16}>
                <div className="glass-deep glow-soft rounded-[20px] p-7">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="num text-[8px] uppercase tracking-[0.23em] text-mist-500">
                        Author ledger
                      </div>
                      <div className="mt-1.5 num text-[11px] text-mist-300">
                        0x7a3f…2f09
                      </div>
                    </div>

                    <span className="inline-flex items-center gap-1.5 rounded-full border border-mint-400/22 bg-mint-400/[0.09] px-2.5 py-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-mint-400" />
                      <span className="num text-[7.5px] uppercase tracking-[0.17em] text-mint-300">
                        reconciled
                      </span>
                    </span>
                  </div>

                  <div className="mt-7">
                    <div className="num text-[8px] uppercase tracking-[0.23em] text-mist-500">
                      Withdrawable
                    </div>
                    <div className="mt-2 flex items-baseline gap-2.5">
                      <CountUp
                        to={0}
                        prefix="$"
                        decimals={2}
                        duration={1.7}
                        className="num text-[42px] font-medium leading-none tracking-[-0.042em] text-mint-300"
                      />
                      <span className="num text-[10px] text-mist-500">USDC</span>
                    </div>
                  </div>

                  <div className="mt-7 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-white/[0.062] bg-white/[0.022]">
                    {[
                      { k: 'Collected', v: fmtMicro(LIVE_FEE_MICRO), sub: 'integrator fee, off the fill' },
                      { k: 'Payable', v: '$0.00', sub: 'nothing settled to authors' },
                      { k: 'Paid', v: '$0.00', sub: '0 plans' },
                    ].map(cell => (
                      <div key={cell.k} className="bg-ink-900/68 px-3.5 py-3.5">
                        <div className="num text-[7px] uppercase tracking-[0.19em] text-mist-500">
                          {cell.k}
                        </div>
                        <div className="mt-1.5 num text-[11px] text-mist-100">{cell.v}</div>
                        <div className="mt-0.5 text-[7.5px] text-mist-600">{cell.sub}</div>
                      </div>
                    ))}
                  </div>

                  {/* mini ledger */}
                  <div className="mt-6 space-y-2.5">
                    {[
                      {
                          sym: 'NVDAc',
                          amt: fmtMicro(LIVE_FEE_MICRO),
                          state: 'collected',
                          tone: 'ember',
                        },
                        {
                          sym: 'NVDAc',
                          amt: `${AUTHOR_SHARE_PCT}% = ${fmtMicro(
                            Math.floor((LIVE_FEE_MICRO * AUTHOR_SHARE_PCT) / 100),
                          )}`,
                          state: 'forecast',
                          tone: 'mist',
                        },
                    ].map((row, i) => (
                      <motion.div
                        key={`${row.sym}-${i}`}
                        initial={{ opacity: 0, y: 9 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5, delay: 0.22 + i * 0.08 }}
                        className="flex items-center justify-between rounded-xl border border-white/[0.058] bg-white/[0.018] px-4 py-2.5"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="h-[22px] w-[22px] rounded-md border border-white/[0.08] bg-white/[0.04]" />
                          <span className="num text-[9.5px] text-mist-200">{row.sym}</span>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="num text-[9.5px] text-mist-100">{row.amt}</span>
                          <span
                            className={`rounded-full border px-2 py-[3px] num text-[7px] uppercase tracking-[0.15em] ${
                              row.tone === 'mint'
                                ? 'border-mint-400/24 bg-mint-400/[0.1] text-mint-300'
                                : row.tone === 'ember'
                                  ? 'border-ember-400/24 bg-ember-400/[0.1] text-ember-300'
                                  : 'border-white/[0.09] bg-white/[0.03] text-mist-400'
                            }`}
                          >
                            {row.state}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  <p className="mt-6 text-[8.5px] leading-[1.82] text-mist-600">
                    A forecast is not money: it becomes withdrawable only once the fills settle and
                    the ledger can read what was actually charged.
                  </p>
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ================= FAQ ================= */}
      <section id="faq" className="relative py-24 sm:py-28">
        <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
          <div className="grid gap-14 lg:grid-cols-[0.82fr_1.18fr]">
            <div>
              <Reveal>
                <Eyebrow>Straight answers</Eyebrow>
              </Reveal>

              <Reveal delay={0.08}>
                <h2 className="mt-6 text-[32px] leading-[1.08] font-semibold tracking-[-0.034em] text-mist-50 sm:text-[42px] sm:leading-[1.05]">
                  The questions a
                  <br />
                  <span className="font-serif-it text-gradient-ember">skeptic asks first.</span>
                </h2>
              </Reveal>

              <Reveal delay={0.14}>
                <p className="mt-6 max-w-[42ch] text-[14.5px] leading-[1.82] text-mist-400">
                  Night Desk is deliberately careful about what it claims. If something here reads
                  like an overstatement, it probably is — tell us and it gets fixed.
                </p>
              </Reveal>

              <Reveal delay={0.2}>
                <Link
                  href="/create"
                  className="group mt-8 inline-flex items-center gap-2.5 rounded-full border border-white/[0.11] bg-white/[0.032] px-6 py-3.5 text-[13px] font-medium text-mist-100 transition-all duration-200 hover:-translate-y-1 hover:border-ember-400/32 hover:bg-ember-400/[0.08]"
                >
                  Try it yourself
                  <ArrowRight size={14} className="transition-transform duration-200 group-hover:translate-x-1" />
                </Link>
              </Reveal>
            </div>

            <div className="space-y-3.5">
              {FAQ.map((item, i) => (
                <Reveal key={item.q} delay={0.06 + i * 0.07}>
                  <FaqItem item={item} index={i} />
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ================= FINAL CTA ================= */}
      <section className="relative pb-24 pt-8 sm:pb-32">
        <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
          <Reveal>
            <div className="relative overflow-hidden rounded-[28px]">
              {/* background */}
              <div className="absolute inset-0">
                <img
                  src="/images/hero-bg.jpg"
                  alt=""
                  aria-hidden="true"
                  className="h-full w-full object-cover opacity-60"
                />
                <div className="absolute inset-0 bg-gradient-to-br from-ember-600/22 via-ink-950/72 to-ink-950/92" />
                <div
                  className="absolute left-1/2 top-0 h-[320px] w-[720px] -translate-x-1/2 rounded-full"
                  style={{
                    background:
                      'radial-gradient(ellipse, rgba(255,180,110,0.34), transparent 68%)',
                    filter: 'blur(52px)',
                  }}
                />
              </div>

              {/* border */}
              <div className="absolute inset-0 rounded-[28px] border border-ember-300/16" />
              <div className="absolute inset-x-0 top-0 h-[2.5px] bg-gradient-to-r from-transparent via-ember-300/62 to-transparent" />

              <div className="relative px-8 py-20 text-center sm:px-12 sm:py-24">
                <Reveal delay={0.05}>
                  <div className="mx-auto inline-flex items-center gap-2.5 rounded-full border border-white/[0.12] bg-white/[0.055] px-4 py-2 backdrop-blur-xl">
                    <Wallet size={13} className="text-ember-200" />
                    <span className="num text-[8.5px] uppercase tracking-[0.22em] text-ember-100">
                      Free to publish · only pay execution
                    </span>
                  </div>
                </Reveal>

                <Reveal delay={0.12}>
                  <h2 className="mx-auto mt-8 max-w-[17ch] text-[38px] leading-[1.0] font-semibold tracking-[-0.042em] text-white sm:text-[58px] sm:leading-[0.97] lg:text-[70px]">
                    Your next trade plan
                    <br />
                    <span className="font-serif-it text-gradient-ember">should be a link.</span>
                  </h2>
                </Reveal>

                <Reveal delay={0.19}>
                  <p className="mx-auto mt-7 max-w-[52ch] text-[15.5px] leading-[1.78] text-white/72 sm:text-[17.5px]">
                    Compose it in under a minute. Share it anywhere. Let the people who trust your
                    thinking run it at their own size — with protection you never have to manage
                    for them.
                  </p>
                </Reveal>

                <Reveal delay={0.26}>
                  <div className="mt-11 flex flex-wrap items-center justify-center gap-3.5">
                    <Link
                      href="/create"
                      className="group inline-flex items-center gap-2.5 rounded-full bg-gradient-to-b from-ember-200 to-ember-500 px-9 py-[18px] text-[16px] font-semibold text-ink-950 shadow-[0_22px_58px_-12px_rgba(255,160,80,0.72)] transition-all duration-200 hover:-translate-y-[3px] hover:shadow-[0_30px_76px_-12px_rgba(255,160,80,0.92)]"
                    >
                      Compose a plan
                      <ArrowRight
                        size={18}
                        strokeWidth={2.4}
                        className="transition-transform duration-200 group-hover:translate-x-1.5"
                      />
                    </Link>

                    <Link
                      href="/board"
                      className="inline-flex items-center gap-2.5 rounded-full border border-white/[0.16] bg-white/[0.07] px-9 py-[18px] text-[16px] font-medium text-white backdrop-blur-xl transition-all duration-200 hover:-translate-y-[3px] hover:border-white/[0.26] hover:bg-white/[0.12]"
                    >
                      Explore the board
                      <ArrowUpRight size={17} />
                    </Link>
                  </div>
                </Reveal>

                <Reveal delay={0.33}>
                  <div className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
                    {[
                      'No custody',
                      'No hidden fees',
                      'Keys stay in your browser',
                      'Open source',
                    ].map(item => (
                      <div key={item} className="flex items-center gap-2">
                        <Check size={13} strokeWidth={2.8} className="text-ember-200" />
                        <span className="num text-[9px] uppercase tracking-[0.19em] text-white/58">
                          {item}
                        </span>
                      </div>
                    ))}
                  </div>
                </Reveal>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
