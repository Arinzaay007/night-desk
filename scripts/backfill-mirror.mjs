/**
 * Backfill a mirror that was indexed under the wrong plan.
 *
 * WHAT THIS IS FOR
 * ----------------
 * Until the fix in this commit, mirror mode stamped the *mirroring* wallet as
 * the plan's author. Two things followed, and both are visible in the ledger:
 *
 *   1. The planKey moved, so the mirror filed as a brand-new plan instead of a
 *      mirror of the plan that was actually run.
 *   2. The author ledger skips self-mirrors on purpose — you cannot owe yourself
 *      a fee — so the real author was credited nothing.
 *
 * The trade itself was never wrong. It settled on Base, at the right size, with
 * a live bracket. Only the index was wrong. This script re-indexes it.
 *
 * IT VERIFIES, IT DOES NOT ASSERT
 * -------------------------------
 * Every value written comes from the exchange or from an explicit argument. The
 * script re-reads the order through this deployment's own /api/orders, refuses
 * to run unless the entry is actually FILLED, takes the bracket levels and the
 * integrator fee off the fill, and only then writes. It cannot invent a mirror,
 * and running it twice is a no-op.
 *
 * USAGE
 *   BASE=https://<deployment> \
 *   FUNDER=0x… AUTHOR=0x… ORDER_ID=… PLAN_KEY=… PLAN_ID=… \
 *   SYMBOL=NVDAc SPEND_USD=1.35 NOTE='…' SIZE_PCT=100 TP_PCT=20 SL_PCT=8 \
 *   node scripts/backfill-mirror.mjs
 *
 * Reads UPSTASH_REDIS_REST_URL / _TOKEN from the environment or .env.local, and
 * writes only to the same `nightdesk:mirrors` key the app uses.
 */

import fs from 'node:fs';
import path from 'node:path';

const LEDGER_KEY = 'nightdesk:mirrors';
const MICRO = 1_000_000;

/* --------------------------------- env ---------------------------------- */

function envFromFile(file, key) {
  if (!fs.existsSync(file)) return undefined;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && m[1] === key) return m[2].replace(/^["']|["']$/g, '');
  }
  return undefined;
}

const root = process.cwd();
const cfg = k => process.env[k] ?? envFromFile(path.join(root, '.env.local'), k);

const UPSTASH_URL = cfg('UPSTASH_REDIS_REST_URL');
const UPSTASH_TOKEN = cfg('UPSTASH_REDIS_REST_TOKEN');

const BASE = (process.env.BASE ?? '').replace(/\/$/, '');
const FUNDER = (process.env.FUNDER ?? '').toLowerCase();
const AUTHOR = (process.env.AUTHOR ?? '').toLowerCase();
const ORDER_ID = process.env.ORDER_ID ?? '';
const PLAN_KEY = process.env.PLAN_KEY ?? '';
const PLAN_ID = process.env.PLAN_ID ?? '';

const die = msg => {
  console.error(`\n  ✗ ${msg}\n`);
  process.exit(1);
};

for (const [k, v] of Object.entries({ UPSTASH_URL, UPSTASH_TOKEN, BASE, FUNDER, AUTHOR, ORDER_ID, PLAN_KEY })) {
  if (!v) die(`missing ${k}. See the header of this file.`);
}
if (FUNDER === AUTHOR) die('FUNDER and AUTHOR are the same wallet — that is a self-mirror and is deliberately not payable.');

/* ------------------------------- upstash -------------------------------- */

async function redis(command) {
  const res = await fetch(UPSTASH_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify(command),
  });
  if (!res.ok) die(`upstash ${command[0]} failed: HTTP ${res.status}`);
  return (await res.json()).result;
}

/* ----------------------- the exchange is the truth ---------------------- */

console.log(`  reading the order back from ${BASE}`);
const ordersUrl = `${BASE}/api/orders?funder=${FUNDER}&orderId=${ORDER_ID}`;
const ordersRes = await fetch(ordersUrl);
if (!ordersRes.ok) die(`could not read orders: HTTP ${ordersRes.status}`);
const payload = await ordersRes.json();
const order = payload.order ?? null;
if (!order) die('that order was not returned for this funder.');

const status = String(order.status ?? '');
console.log(`  status          ${status}`);
console.log(`  averagePrice    ${order.filled?.averagePrice ?? '—'}`);
if (!status.includes('FILLED')) die(`refusing to record a mirror whose entry is ${status || 'unknown'}.`);

const fills = Array.isArray(order.fills) ? order.fills.filter(f => f.status === 'CHAIN_STATUS_PROCESSED' || f.notional) : [];
const bracket = order.attachedBracket ?? null;

/* The fee Flash actually charged, preferring the notional field. Mirrors
 * src/lib/earnings.ts integratorFeeMicroFromFill — the fallback arithmetic is
 * that module's, restated here because this is a plain .mjs repair tool. */
function feeMicroFrom(fill) {
  const usd = Number(fill?.integratorFeeNotional ?? '');
  if (Number.isFinite(usd) && usd > 0) return Math.round(usd * MICRO);
  const ticker = String(fill?.feeTicker ?? '').toUpperCase();
  const reported = Number(fill?.integratorFeeAmount ?? '');
  if (['USDC', 'USDT', 'USD'].includes(ticker) && Number.isFinite(reported) && reported > 0) {
    return Math.round(reported * MICRO);
  }
  return 0;
}

const feeMicro = fills.reduce((sum, f) => sum + feeMicroFrom(f), 0);
if (feeMicro <= 0) die('the fills carry no integrator fee — nothing to credit, nothing to backfill.');

const sharePct = Number(process.env.AUTHOR_SHARE_PCT ?? cfg('AUTHOR_SHARE_PCT') ?? 60);
const authorMicro = Math.round((feeMicro * sharePct) / 100);

console.log(`  fills           ${fills.length}`);
console.log(`  integrator fee  ${feeMicro} µUSD`);
console.log(`  author share    ${authorMicro} µUSD (${sharePct}%)`);
console.log(`  bracket         ${bracket?.bracketOrderId ?? '—'}  TP ${bracket?.takeProfit?.notionalPrice ?? '—'}  SL ${bracket?.stopLoss?.notionalPrice ?? '—'}`);

/* ------------------------------ the ledger ------------------------------ */

const raw = await redis(['GET', LEDGER_KEY]);
const shape = raw ? JSON.parse(raw) : { mirrors: [], earnings: [] };
shape.mirrors = Array.isArray(shape.mirrors) ? shape.mirrors : [];
shape.earnings = Array.isArray(shape.earnings) ? shape.earnings : [];

const idx = shape.mirrors.findIndex(m => m.orderId === ORDER_ID);
if (idx === -1) die(`no mirror row for orderId ${ORDER_ID} — nothing to repair.`);
const before = shape.mirrors[idx];
console.log(`\n  before  planKey=${before.planKey}  author=${String(before.author).slice(0, 10)}…  funder=${String(before.funder).slice(0, 10)}…`);

/* Correct the identity. The mirror's own execution values that were right are
 * kept; the ones the exchange disagrees with are replaced by its answer. */
shape.mirrors[idx] = {
  ...before,
  planKey: PLAN_KEY,
  planId: PLAN_ID || before.planId,
  symbol: process.env.SYMBOL ?? before.symbol ?? '—',
  funder: FUNDER,
  author: AUTHOR,
  orderId: ORDER_ID,
  bracketOrderId: bracket?.bracketOrderId ?? before.bracketOrderId ?? null,
  spendUsd: Number(process.env.SPEND_USD ?? before.spendUsd ?? 0),
  takeProfitPrice: Number(bracket?.takeProfit?.notionalPrice ?? before.takeProfitPrice ?? 0) || null,
  stopLossPrice: Number(bracket?.stopLoss?.notionalPrice ?? before.stopLossPrice ?? 0) || null,
  note: process.env.NOTE ?? before.note,
  sizePct: Number(process.env.SIZE_PCT ?? before.sizePct ?? 0),
  tpPct: Number(process.env.TP_PCT ?? before.tpPct ?? 0),
  slPct: Number(process.env.SL_PCT ?? before.slPct ?? 0),
};

const after = shape.mirrors[idx];
console.log(`  after   planKey=${after.planKey}  author=${after.author.slice(0, 10)}…  funder=${after.funder.slice(0, 10)}…`);

/* The accrual, same shape src/lib/earnings.ts writes. Idempotent on
 * (planKey, orderId) — a second run finds the row and leaves it alone. */
const earningId = `${PLAN_KEY}::${ORDER_ID}`;
if (shape.earnings.some(e => e.id === earningId)) {
  console.log(`\n  earning ${earningId} already present — left unchanged.`);
} else {
  shape.earnings.push({
    id: earningId,
    planKey: PLAN_KEY,
    planId: after.planId,
    symbol: after.symbol,
    author: AUTHOR,
    funder: FUNDER,
    orderId: ORDER_ID,
    bracketOrderId: after.bracketOrderId,
    feeMicro,
    authorMicro,
    state: 'estimated',
    createdAt: Date.now(),
  });
  console.log(`\n  earning recorded: ${authorMicro} µUSD, state=estimated (reconciles on the next /api/proof read)`);
}

await redis(['SET', LEDGER_KEY, JSON.stringify(shape)]);
console.log(`\n  ✓ ledger written — ${shape.mirrors.length} mirror(s), ${shape.earnings.length} earning(s)`);
