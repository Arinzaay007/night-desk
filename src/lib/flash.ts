import type {
  FlashAsset,
  FlashGetOrderResponse,
  FlashOrder,
  FlashTokenBalance,
  QuoteResponse,
} from './types';

const FLASH_BASE = process.env.FLASH_BASE_URL ?? 'https://flash.definitive.fi/v1';

/**
 * Flash sits behind Cloudflare and returns HTTP 403 `error code: 1010` to
 * requests that carry a default programmatic User-Agent. A normal UA is
 * mandatory — this cost us an hour the first time, so it lives in one place.
 */
const USER_AGENT = 'NightDesk/0.1 (+https://runtime.nyc; hackathon build)';

export class FlashError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'FlashError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function apiKey(): string {
  const key = process.env.FLASH_API_KEY;
  if (!key) {
    throw new FlashError(500, 'MISSING_API_KEY', 'FLASH_API_KEY is not configured on the server.');
  }
  return key;
}

export const integratorFeeBps = (): string => process.env.INTEGRATOR_FEE_BPS ?? '25';

export const attributionCode = (): string | undefined =>
  process.env.ERC8021_ATTRIBUTION_CODE || undefined;

interface CallOptions {
  method?: 'GET' | 'POST' | 'PATCH';
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  /** Per-request ceiling. Quotes occasionally take >10s; fail loudly, not forever. */
  timeoutMs?: number;
  /**
   * Set for calls that are safe to repeat. Flash documents cancels as
   * idempotent, so a timed-out cancel is retried once and, if it still fails,
   * reported as "safe to try again" rather than "nothing happened" — which is
   * the honest message when the first attempt may well have landed.
   */
  idempotent?: boolean;
}

const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Flash enforces 5 requests/sec per endpoint per key. We retry once on 429, and
 * once on a timeout for calls that are safe to repeat: quotes (which move no
 * funds) and cancels (which Flash documents as idempotent).
 *
 * Order submission is deliberately never auto-retried: a retry after an
 * ambiguous failure could double-submit a trade.
 */
async function flash<T>(path: string, options: CallOptions = {}, attempt = 0): Promise<T> {
  const url = new URL(FLASH_BASE + path);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }

  const isQuote = path === '/quote';
  const mayRepeat = isQuote || options.idempotent === true;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? (options.body ? 'POST' : 'GET'),
      headers: {
        'x-definitive-api-key': apiKey(),
        'content-type': 'application/json',
        accept: 'application/json',
        'user-agent': USER_AGENT,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const timedOut =
      error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    if (timedOut && mayRepeat && attempt < 1) {
      // A slow response is usually a slow upstream, and repeating is free here.
      await new Promise(r => setTimeout(r, 400));
      return flash<T>(path, options, attempt + 1);
    }
    const seconds = Math.round(timeoutMs / 1000);
    throw new FlashError(
      timedOut ? 504 : 502,
      timedOut ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_UNREACHABLE',
      timedOut
        ? options.idempotent
          ? `Flash did not respond within ${seconds}s, twice. A cancel is idempotent, so trying again is safe even if the first one landed.`
          : `Flash did not respond within ${seconds}s. Try again — nothing was submitted.`
        : `Could not reach Flash: ${error instanceof Error ? error.message : 'unknown network error'}`,
    );
  }

  if (response.status === 429 && attempt < 1) {
    const reset = Number(response.headers.get('ratelimit-reset') ?? '1');
    await new Promise(r => setTimeout(r, Math.min(Math.max(reset, 1), 3) * 1000));
    return flash<T>(path, options, attempt + 1);
  }

  const text = await response.text();
  let payload: unknown = undefined;
  try {
    payload = text ? JSON.parse(text) : undefined;
  } catch {
    payload = text;
  }

  if (!response.ok) {
    const err = (payload as { error?: { code?: string; message?: string; details?: unknown } })?.error;
    throw new FlashError(
      response.status,
      err?.code ?? `HTTP_${response.status}`,
      err?.message ?? `Flash request failed (${response.status})`,
      err?.details ?? payload,
    );
  }

  return payload as T;
}

export const quote = (body: Record<string, unknown>) => flash<QuoteResponse>('/quote', { body });

export const submitOrder = (body: Record<string, unknown>) =>
  flash<{ orderId: string; attachedBracket?: { status?: string } | null }>('/order', { body });

export const listOrders = (funderAddress: string, pageSize = 50) =>
  flash<{ orders?: FlashOrder[] }>('/orders', { query: { funderAddress, pageSize } });

export const getOrder = (orderId: string, funderAddress: string) =>
  flash<FlashGetOrderResponse>(`/orders/${encodeURIComponent(orderId)}`, {
    query: { funderAddress },
  });

export const cancelOrder = (orderId: string, body: Record<string, unknown>) =>
  flash<unknown>(`/orders/${encodeURIComponent(orderId)}/cancel`, { body, idempotent: true });

export const searchAssets = (query: string, chain?: string, limit = 5) =>
  flash<{ assets?: FlashAsset[] }>('/search', { query: { query, chain, limit } });

export const getBalances = (address: string) =>
  flash<FlashTokenBalance[] | { balances?: FlashTokenBalance[] }>(`/balances/${encodeURIComponent(address)}`);

export function normaliseBalances(result: FlashTokenBalance[] | { balances?: FlashTokenBalance[] }): FlashTokenBalance[] {
  if (Array.isArray(result)) return result;
  return result?.balances ?? [];
}

/**
 * Client-facing one-liner.
 *
 * `describeFlashError` appends the raw upstream JSON blob, which is exactly what
 * you want in a log and exactly what you do not want on a plan page read by
 * somebody deciding whether to trust you. This keeps the code and the sentence,
 * drops the blob, and truncates on a word boundary so the board never renders
 * half a word.
 */
export const summariseFlashError = (error: unknown, max = 120): string => {
  const raw =
    error instanceof FlashError
      ? `${error.code}: ${error.message}`
      : error instanceof Error
        ? error.message
        : 'Unknown error';

  // Drop any trailing JSON object/array — it is for logs, not for the browser.
  const withoutBlob = raw.replace(/\s*[{[]\s*"[\s\S]*$/, '').trim();
  const text = withoutBlob || raw;

  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
};

export const describeFlashError = (error: unknown): string => {
  if (error instanceof FlashError) {
    const detail = error.details ? ` ${JSON.stringify(error.details)}` : '';
    return `${error.code}: ${error.message}${detail}`;
  }
  return error instanceof Error ? error.message : 'Unknown error';
};
