/**
 * A Plan is the shareable object at the centre of Night Desk.
 *
 * It is deliberately **parametric** — a percentage of the mirroring wallet,
 * not an absolute quantity. That is forced by the architecture (every mirror
 * needs a fresh quote against a different wallet and balance) and it is also
 * the better product: a follower with $50 gets a proportional stop rather than
 * inheriting someone else's absolute position size.
 *
 * Plans are encoded into the URL, so a plan link is permanent and needs no
 * database. Keys are short because they end up in a tweet.
 */

export type EntryType = 'market' | 'limit';

export interface Plan {
  /** schema version */
  v: 1;
  /** author address */
  a: string;
  /** author label (optional, cosmetic) */
  n?: string;
  /** target equity address on Base */
  t: string;
  /** target symbol, for display */
  s: string;
  /** entry style */
  e: EntryType;
  /** limit price in USD notional, required when e === 'limit' */
  lp?: number;
  /** size as a percentage of the mirroring wallet's USDC balance */
  z: number;
  /** take-profit, percent above reference price */
  tp: number;
  /** stop-loss, percent below reference price */
  sl: number;
  /** thesis / note */
  m?: string;
  /** created at (ms) */
  ts: number;
}

export const PLAN_LIMITS = {
  minSizePct: 1,
  maxSizePct: 100,
  minTp: 1,
  maxTp: 500,
  minSl: 1,
  maxSl: 90,
} as const;

export function validatePlan(input: unknown): { plan?: Plan; errors: string[] } {
  const errors: string[] = [];
  if (!input || typeof input !== 'object') return { errors: ['Plan payload missing.'] };
  const p = input as Partial<Plan>;

  if (p.v !== 1) errors.push('Unsupported plan version.');
  if (!p.a || !/^0x[a-fA-F0-9]{40}$/.test(String(p.a))) errors.push('Plan author address is invalid.');
  if (!p.t || !/^0x[a-fA-F0-9]{40}$/.test(String(p.t))) errors.push('Plan asset address is invalid.');
  if (!p.s || typeof p.s !== 'string') errors.push('Plan symbol is missing.');
  if (p.e !== 'market' && p.e !== 'limit') errors.push('Entry type must be market or limit.');
  if (p.e === 'limit' && !(Number(p.lp) > 0)) errors.push('A limit entry needs a positive limit price.');

  const z = Number(p.z);
  if (!Number.isFinite(z) || z < PLAN_LIMITS.minSizePct || z > PLAN_LIMITS.maxSizePct) {
    errors.push(`Size must be between ${PLAN_LIMITS.minSizePct}% and ${PLAN_LIMITS.maxSizePct}% of the wallet.`);
  }

  const tp = Number(p.tp);
  if (!Number.isFinite(tp) || tp < PLAN_LIMITS.minTp || tp > PLAN_LIMITS.maxTp) {
    errors.push(`Take-profit must be between ${PLAN_LIMITS.minTp}% and ${PLAN_LIMITS.maxTp}%.`);
  }

  const sl = Number(p.sl);
  if (!Number.isFinite(sl) || sl < PLAN_LIMITS.minSl || sl > PLAN_LIMITS.maxSl) {
    errors.push(`Stop-loss must be between ${PLAN_LIMITS.minSl}% and ${PLAN_LIMITS.maxSl}%.`);
  }

  if (p.m && String(p.m).length > 280) errors.push('Note is too long (280 characters max).');

  if (errors.length) return { errors };

  return {
    errors: [],
    plan: {
      v: 1,
      a: String(p.a),
      n: p.n ? String(p.n).slice(0, 40) : undefined,
      t: String(p.t),
      s: String(p.s).slice(0, 16),
      e: p.e as EntryType,
      lp: p.lp !== undefined ? Number(p.lp) : undefined,
      z: Number(p.z),
      tp: Number(p.tp),
      sl: Number(p.sl),
      m: p.m ? String(p.m).slice(0, 280) : undefined,
      ts: Number(p.ts) || Date.now(),
    },
  };
}

/* ------------------------------------------------------------------ */
/* URL codec — base64url so a plan survives copy/paste into a tweet   */
/* ------------------------------------------------------------------ */

function toBase64Url(json: string): string {
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const b64 =
    typeof btoa === 'function'
      ? btoa(binary)
      : Buffer.from(json, 'utf8').toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): string {
  const b64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  if (typeof atob === 'function' && typeof window !== 'undefined') {
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }
  return Buffer.from(padded, 'base64').toString('utf8');
}

export function encodePlan(plan: Plan): string {
  const compact: Record<string, unknown> = {
    v: 1,
    a: plan.a,
    t: plan.t,
    s: plan.s,
    e: plan.e,
    z: plan.z,
    tp: plan.tp,
    sl: plan.sl,
    ts: plan.ts,
  };
  if (plan.n) compact.n = plan.n;
  if (plan.e === 'limit' && plan.lp) compact.lp = plan.lp;
  if (plan.m) compact.m = plan.m;
  return toBase64Url(JSON.stringify(compact));
}

export function decodePlan(id: string): { plan?: Plan; errors: string[] } {
  try {
    const json = fromBase64Url(decodeURIComponent(id));
    return validatePlan(JSON.parse(json));
  } catch {
    return { errors: ['This plan link is malformed.'] };
  }
}

/** Stable short key for a plan, used to group mirrors in the local ledger. */
export function planKey(plan: Plan): string {
  const input = `${plan.a}${plan.t}${plan.e}${plan.lp ?? ''}${plan.z}${plan.tp}${plan.sl}${plan.ts}`;
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}
