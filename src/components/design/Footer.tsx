'use client';

import Link from 'next/link';
import { LogoMark } from './Brand';
import { Code2, ArrowUpRight, Globe, ShieldCheck, Link2 } from 'lucide-react';
import { REPO_URL, PLAN_PATH, PLAN_KEY, SOCIAL_URL } from '@/lib/site';

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'Compose a plan', href: '/create' },
      { label: 'My desk', href: '/desk' },
      { label: 'The board', href: '/board' },
      { label: 'Author payouts', href: '/payouts' },
      { label: 'The live plan link', href: PLAN_PATH },
    ],
  },
  {
    title: 'How it works',
    links: [
      { label: 'Parametric sizing', href: '/#principles' },
      { label: 'Independent brackets', href: '/#principles' },
      { label: 'Realised P&L ranking', href: '/#board' },
      { label: 'Compliance readout', href: PLAN_PATH },
      { label: 'Fee structure', href: '/#faq' },
    ],
  },
  {
    title: 'Verify it yourself',
    links: [
      { label: 'Compliance readout (JSON)', href: `/api/proof?planKey=${PLAN_KEY}`, external: true },
      { label: 'Deployment health', href: '/api/health', external: true },
      { label: 'Source on GitHub', href: REPO_URL, external: true },
      { label: 'Runtime Agent Week', href: 'https://runtime.nyc', external: true },
      { label: 'Definitive Flash docs', href: 'https://flash.definitive.fi/docs', external: true },
    ],
  },
];

export function Footer() {
  return (
    <footer className="relative mt-24 border-t border-white/[0.07] bg-ink-950">
      <div
        className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[880px] -translate-x-1/2 rounded-full opacity-[0.16]"
        style={{
          background: 'radial-gradient(closest-side, rgba(255,143,66,0.7), rgba(255,143,66,0))',
          filter: 'blur(50px)',
        }}
      />

      <div className="relative mx-auto max-w-[1240px] px-5 sm:px-8">
        <div className="grid gap-12 py-16 lg:grid-cols-[1.45fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-3">
              <LogoMark size={42} />
              <div>
                <div className="font-display text-[19px] font-semibold tracking-[-0.03em] text-mist-50">
                  Night Desk
                </div>
                <div className="num text-[9px] uppercase tracking-[0.3em] text-mist-500">
                  plans, not signals
                </div>
              </div>
            </div>

            <p className="mt-5 max-w-[38ch] text-[14px] leading-[1.72] text-mist-400">
              Publish a trade plan as a link. Anyone who opens it executes it at their own size,
              with their own take-profit and stop-loss, on Base.{' '}
              <span className="text-mist-200">The author cannot exit you.</span>
            </p>

            <div className="mt-6 flex flex-wrap gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5">
                <ShieldCheck size={12.5} className="text-mint-400" />
                <span className="num text-[9.5px] uppercase tracking-[0.15em] text-mist-400">
                  Non-custodial
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5">
                <Globe size={12.5} className="text-violet-400" />
                <span className="num text-[9.5px] uppercase tracking-[0.15em] text-mist-400">
                  Base · Chain 8453
                </span>
              </span>
            </div>

            <div className="mt-6 flex gap-2.5">
              {[
                // lucide dropped its brand glyphs (Github/Twitter) in this
                // version, so these are generic marks rather than fake logos.
                { Icon: Link2, label: 'X / Twitter — @DefinitiveFi', href: SOCIAL_URL },
                { Icon: Code2, label: 'Source on GitHub', href: REPO_URL },
                { Icon: ArrowUpRight, label: 'Runtime Agent Week', href: 'https://runtime.nyc' },
              ].map(({ Icon, label, href }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.028] text-mist-400 transition-all duration-200 hover:-translate-y-0.5 hover:border-ember-500/35 hover:bg-ember-500/10 hover:text-ember-300"
                >
                  <Icon size={16} />
                </a>
              ))}
            </div>
          </div>

          {COLUMNS.map(col => (
            <div key={col.title}>
              <h4 className="num text-[9.5px] uppercase tracking-[0.28em] text-mist-500">
                {col.title}
              </h4>
              <ul className="mt-5 space-y-3">
                {col.links.map(link => {
                  const cls =
                    'group inline-flex items-center gap-1.5 text-[13.5px] text-mist-400 transition-colors duration-200 hover:text-ember-300';
                  const inner = (
                    <>
                      <span className="h-px w-0 bg-ember-400 transition-all duration-200 group-hover:w-3.5" />
                      {link.label}
                    </>
                  );
                  return (
                    <li key={link.label}>
                      {'external' in link && link.external ? (
                        <a href={link.href} target="_blank" rel="noopener noreferrer" className={cls}>
                          {inner}
                        </a>
                      ) : (
                        <Link href={link.href} className={cls}>
                          {inner}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-ember-500/15 bg-ember-500/[0.045] px-6 py-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-ember-400/70" />
              <p className="max-w-[74ch] text-[12px] leading-[1.75] text-mist-400">
                <strong className="font-semibold text-ember-200">Demo software.</strong> Night Desk
                is a reference build for Runtime Agent Week. Nothing here is financial advice, and
                no displayed figure represents an offer, a solicitation, or a guarantee of future
                results. A plan is not enforced — a mirror is guided execution, and compliance is
                measured after the fact rather than mandated. Digital assets are volatile — only
                ever use throwaway keys with funds you can afford to lose.
              </p>
            </div>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/[0.1] px-4 py-2 text-[11.5px] font-medium text-mist-300 transition-colors hover:border-ember-500/40 hover:text-ember-300"
            >
              View source
              <ArrowUpRight size={13} />
            </a>
          </div>
        </div>

        <div className="flex flex-col gap-4 py-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="num text-[10px] uppercase tracking-[0.19em] text-mist-600">
            © 2026 Night Desk · Built for Runtime Agent Week · Definitive Flash track
          </p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {[
              { label: 'Source', href: REPO_URL },
              { label: 'Plan proof', href: `/api/proof?planKey=${PLAN_KEY}` },
              { label: 'Health', href: '/api/health' },
              { label: 'Runtime', href: 'https://runtime.nyc' },
            ].map(item => (
              <a
                key={item.label}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="num text-[10px] uppercase tracking-[0.19em] text-mist-600 transition-colors hover:text-mist-300"
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
