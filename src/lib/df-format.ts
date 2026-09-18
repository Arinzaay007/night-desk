/** Formatting helpers — shared across every page. */

export const usd = (value: number | string | null | undefined, digits = 2): string => {
  const n = typeof value === 'string' ? Number(value) : value;
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

/** Compact currency: $12.4K, $1.28M */
export const usdCompact = (value: number | null | undefined): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(2)}K`;
  return `${sign}$${abs.toFixed(2)}`;
};

/** Always-signed percentage: +12.4% / −3.1% */
export const pct = (value: number | null | undefined, digits = 1): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(digits)}%`;
};

/** Signed currency with a real minus glyph. */
export const usdSigned = (value: number | null | undefined, digits = 2): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${usd(Math.abs(value), digits)}`;
};

export const shortAddress = (address?: string | null, size = 4): string => {
  if (!address) return '—';
  if (address.length <= size * 2 + 2) return address;
  return `${address.slice(0, size + 2)}…${address.slice(-size)}`;
};

export const relativeTime = (ms: number): string => {
  const diff = Date.now() - ms;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
};

export const explorerTx = (hash?: string | null): string =>
  hash ? `https://basescan.org/tx/${hash}` : 'https://basescan.org/';

/** Micro-USD (ledger units) rendered honestly — never "$0.00" for real money. */
export const microUsd = (value: number): string => {
  const dollars = Math.abs(value) / 1_000_000;
  if (dollars === 0) return '$0.00';
  if (dollars < 0.01) return `${(dollars * 100).toFixed(2)}¢`;
  if (dollars < 1) return `$${dollars.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}`;
  return `$${dollars.toFixed(2)}`;
};

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/** Deterministic pseudo-random in [0,1) from a string seed — stable renders. */
export const seeded = (seed: string): number => {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
};

/** Build a smooth series of `n` points around a base value, deterministic per seed. */
export const seriesFromSeed = (seed: string, n: number, base: number, drift = 0.06): number[] => {
  const out: number[] = [];
  let value = base * (1 - drift);
  for (let i = 0; i < n; i += 1) {
    const r = seeded(`${seed}:${i}`);
    const wave = Math.sin((i / n) * Math.PI * 2.1 + seeded(seed) * 6) * drift * 0.55;
    value = value * (1 + (r - 0.48) * drift * 0.62 + wave / n * 4);
    out.push(Number(value.toFixed(4)));
  }
  // normalize so the last point lands near `base`
  const last = out[out.length - 1];
  const scale = base / last;
  return out.map(v => Number((v * scale).toFixed(4)));
};
