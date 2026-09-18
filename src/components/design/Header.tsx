'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Wallet, ChevronRight } from 'lucide-react';
import { Wordmark, LogoMark } from './Brand';

const LINKS = [
  { href: '/create', label: 'Compose' },
  { href: '/desk', label: 'My desk' },
  { href: '/board', label: 'Board' },
  { href: '/payouts', label: 'Payouts' },
];

/**
 * The header status pill reports what `/api/health` actually says.
 *
 * The design shows a hardcoded "Flash API · live" badge. That is a claim about
 * the outside world rendered as decoration, and it would keep saying "live"
 * while the deployment was misconfigured or in dry-run. It now probes the
 * deployment's own health endpoint and says what it finds — including "dry run"
 * when the app is not armed, which is exactly when a viewer most needs to know.
 */
function StatusPill() {
  const [state, setState] = useState<'checking' | 'live' | 'dry' | 'down'>('checking');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/health')
      .then(r => r.json())
      .then((h: { ok?: boolean; dryRun?: boolean; store?: { durable?: boolean } }) => {
        if (cancelled) return;
        if (!h?.ok) setState('down');
        else if (h.dryRun) setState('dry');
        else setState('live');
      })
      .catch(() => {
        if (!cancelled) setState('down');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const map = {
    checking: { text: 'checking…', cls: 'border-white/[0.09] bg-white/[0.03] text-mist-500', dot: 'bg-mist-500' },
    live: { text: 'Flash API · live', cls: 'border-mint-400/20 bg-mint-400/[0.07] text-mint-300', dot: 'bg-mint-400' },
    dry: { text: 'dry run · not armed', cls: 'border-ember-500/25 bg-ember-500/[0.08] text-ember-300', dot: 'bg-ember-400' },
    down: { text: 'API unreachable', cls: 'border-rose-500/25 bg-rose-500/[0.08] text-rose-300', dot: 'bg-rose-400' },
  } as const;

  const s = map[state];

  return (
    <div className={`hidden xl:flex items-center gap-2 rounded-full border px-3.5 py-1.5 ${s.cls}`}>
      <span className="relative flex h-1.5 w-1.5">
        {state === 'live' && (
          <span className={`absolute inline-flex h-full w-full rounded-full animate-pulse-ring ${s.dot}`} />
        )}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${s.dot}`} />
      </span>
      <span className="num text-[10px] uppercase tracking-[0.18em]">{s.text}</span>
    </div>
  );
}

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <motion.header
        initial={{ y: -28, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.55, ease: [0.22, 0.68, 0.32, 1] }}
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'py-2.5 backdrop-blur-2xl bg-ink-950/85 border-b border-white/[0.07]'
            : 'py-4 bg-transparent border-b border-transparent'
        }`}
      >
        <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
          <div className="flex items-center justify-between gap-4">
            <Link href="/" className="focus-ring rounded-xl shrink-0" aria-label="Night Desk home">
              <span className="hidden sm:block">
                <Wordmark />
              </span>
              <span className="sm:hidden">
                <LogoMark size={36} />
              </span>
            </Link>

            <nav className="hidden lg:flex items-center gap-1 rounded-full border border-white/[0.07] bg-white/[0.028] p-1.5 backdrop-blur-xl">
              {LINKS.map(link => {
                const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`focus-ring relative rounded-full px-4 py-2 text-[13.5px] font-medium transition-colors duration-200 ${
                      active ? 'text-ink-950' : 'text-mist-400 hover:text-mist-100 hover:bg-white/[0.05]'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="nav-pill"
                        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                        className="absolute inset-0 rounded-full bg-gradient-to-b from-ember-300 to-ember-500"
                      />
                    )}
                    <span className="relative z-10">{link.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center gap-2.5">
              <StatusPill />

              <Link
                href="/create"
                className="focus-ring group hidden sm:inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-ember-300 to-ember-500 px-5 py-2.5 text-[13.5px] font-semibold text-ink-950 shadow-[0_10px_30px_-10px_rgba(255,143,66,0.55)] transition-all duration-200 hover:shadow-[0_16px_42px_-10px_rgba(255,143,66,0.72)] hover:-translate-y-[1px]"
              >
                <Wallet size={15} strokeWidth={2.3} />
                Connect wallet
              </Link>

              <button
                onClick={() => setOpen(v => !v)}
                className="focus-ring lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.09] bg-white/[0.04] text-mist-200"
                aria-label={open ? 'Close menu' : 'Open menu'}
              >
                {open ? <X size={18} /> : <Menu size={18} />}
              </button>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 0.68, 0.32, 1] }}
              className="lg:hidden overflow-hidden border-t border-white/[0.07] bg-ink-950/96 backdrop-blur-2xl"
            >
              <div className="mx-auto max-w-[1240px] px-5 sm:px-8 py-4 space-y-1">
                {LINKS.map(link => {
                  const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`flex items-center justify-between rounded-2xl px-4 py-3.5 text-[15px] font-medium transition-colors ${
                        active ? 'bg-ember-500/12 text-ember-300' : 'text-mist-300 hover:bg-white/[0.05]'
                      }`}
                    >
                      <span>{link.label}</span>
                      <ChevronRight size={16} className="opacity-45" />
                    </Link>
                  );
                })}
                <Link
                  href="/create"
                  className="mt-3 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-ember-300 to-ember-500 px-5 py-3.5 text-[15px] font-semibold text-ink-950"
                >
                  <Wallet size={16} strokeWidth={2.3} />
                  Connect wallet
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      <div className="h-[76px]" />
    </>
  );
}
