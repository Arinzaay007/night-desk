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

export const pct = (value: number, digits = 1): string =>
  Number.isFinite(value) ? `${value > 0 ? '+' : ''}${value.toFixed(digits)}%` : '—';

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

export const statusLabel = (status?: string | null): string => {
  if (!status) return 'UNKNOWN';
  return status.replace('ORDER_STATUS_', '').replace(/_/g, ' ').toLowerCase();
};

export const isLiveStatus = (status?: string | null): boolean =>
  status === 'ORDER_STATUS_PENDING' ||
  status === 'ORDER_STATUS_ACCEPTED' ||
  status === 'ORDER_STATUS_PARTIALLY_FILLED';

export const explorerTx = (hash?: string | null): string =>
  hash ? `https://basescan.org/tx/${hash}` : 'https://basescan.org/';
