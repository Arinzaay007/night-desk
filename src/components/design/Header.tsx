'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Wallet, ChevronRight, Check, Copy, LogOut } from 'lucide-react';
import { Wordmark, LogoMark } from './Brand';
import { useWallet } from '@/lib/useWallet';
import { hasInjectedWallet } from '@/lib/wallet';
import { shortAddress, usd } from '@/lib/format';

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

/**
 * The header's wallet control.
 *
 * The design renders this as a decorative <Link href="/create">Connect wallet</Link>
 * — a button that never changes because it isn't connected to anything. It now
 * reads the one shared wallet: disconnected it is the way in, connected it shows
 * who you are, what you hold, and the way out.
 *
 * With no browser wallet installed there is nothing useful to do in a header, so
 * the click hands off to /create, where the local-key path lives.
 */
function WalletButton({ full = false }: { full?: boolean }) {
  const wallet = useWallet();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // `hasInjectedWallet()` reads window, and the server render has no window.
  // Branching on it during render would be a hydration mismatch, so wait a tick.
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const injectedReady = mounted && hasInjectedWallet();

  if (!wallet.address) {
    return (
      <button
        type="button"
        disabled={wallet.connecting}
        title={injectedReady ? 'Connect your browser wallet' : 'Choose a wallet on the compose page'}
        onClick={async () => {
          if (injectedReady) {
            await wallet.connectInjected();
            return;
          }
          // No browser wallet to talk to. The local-key path lives on /create —
          // so go there, and if we are already there, take the user to the
          // control instead of doing nothing at all.
          if (pathname === '/create') {
            document.getElementById('connect')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          } else {
            router.push('/create');
          }
        }}
        className={`focus-ring group inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-ember-300 to-ember-500 text-[13.5px] font-semibold text-ink-950 shadow-[0_10px_30px_-10px_rgba(255,143,66,0.55)] transition-all duration-200 hover:shadow-[0_16px_42px_-10px_rgba(255,143,66,0.72)] hover:-translate-y-[1px] disabled:opacity-70 disabled:hover:translate-y-0 ${
          full ? 'w-full justify-center px-5 py-3.5 text-[15px]' : 'px-5 py-2.5'
        }`}
      >
        <Wallet size={full ? 16 : 15} strokeWidth={2.3} />
        {wallet.connecting ? 'Connecting…' : 'Connect wallet'}
      </button>
    );
  }

  return (
    <div ref={ref} className={`relative ${full ? 'w-full' : ''}`}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-label="Wallet menu"
        className={`focus-ring inline-flex items-center gap-2 rounded-full border border-mint-400/24 bg-mint-400/[0.08] text-[13px] font-medium text-mint-200 transition-colors hover:border-mint-400/42 hover:bg-mint-400/[0.12] ${
          full ? 'w-full justify-center px-5 py-3.5' : 'px-4 py-2.5'
        }`}
      >
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full rounded-full bg-mint-400 animate-pulse-ring" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-mint-400" />
        </span>
        <span className="num">{shortAddress(wallet.address)}</span>
        <ChevronRight
          size={13}
          className={`opacity-55 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.22, 0.68, 0.32, 1] }}
            className={`absolute z-50 mt-2 w-[268px] overflow-hidden rounded-2xl border border-white/[0.09] bg-ink-950/97 p-1.5 backdrop-blur-2xl shadow-[0_24px_60px_-18px_rgba(0,0,0,0.85)] ${
              full ? 'left-0' : 'right-0'
            }`}
          >
            <div className="px-3 py-2.5">
              <div className="num text-[7px] uppercase tracking-[0.2em] text-mist-600">
                {wallet.signer?.mode === 'local' ? 'local key · this browser' : 'connected wallet'}
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(wallet.address ?? '').then(
                    () => {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1600);
                    },
                    () => undefined,
                  );
                }}
                className="mt-1.5 flex w-full items-center justify-between gap-2 rounded-lg px-1 py-1 text-left transition-colors hover:bg-white/[0.05]"
                title="Copy address"
              >
                <span className="num truncate text-[11px] text-mist-200">{wallet.address}</span>
                {copied ? (
                  <Check size={11} className="shrink-0 text-mint-400" />
                ) : (
                  <Copy size={11} className="shrink-0 text-mist-500" />
                )}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
              <div className="bg-ink-900/60 px-3 py-2.5">
                <div className="num text-[6.5px] uppercase tracking-[0.18em] text-mist-600">
                  usdc
                </div>
                <div className="num mt-1 text-[12px] text-mist-100">
                  {wallet.balance ? usd(wallet.balance.usdc) : '—'}
                </div>
              </div>
              <div className="bg-ink-900/60 px-3 py-2.5">
                <div className="num text-[6.5px] uppercase tracking-[0.18em] text-mist-600">eth</div>
                <div className="num mt-1 text-[12px] text-mist-100">
                  {wallet.balance ? wallet.balance.eth.toFixed(6) : '—'}
                </div>
              </div>
            </div>

            <div className="mt-1.5 space-y-px">
              {[
                { href: '/desk', label: 'My desk' },
                { href: '/payouts', label: 'Payouts' },
              ].map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-[12.5px] text-mist-300 transition-colors hover:bg-white/[0.05] hover:text-mist-100"
                >
                  {item.label}
                  <ChevronRight size={12} className="opacity-45" />
                </Link>
              ))}

              <button
                type="button"
                onClick={() => {
                  wallet.disconnect();
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[12.5px] text-rose-300/85 transition-colors hover:bg-rose-500/[0.09] hover:text-rose-200"
              >
                <LogOut size={12} />
                Disconnect
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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

                <div className="hidden sm:block">
                  <WalletButton />
                </div>

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
                  <div className="mt-3">
                    <WalletButton full />
                  </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      <div className="h-[76px]" />
    </>
  );
}
