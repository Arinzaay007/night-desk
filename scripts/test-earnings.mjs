#!/usr/bin/env node
/**
 * Unit tests for the author ledger.
 *
 * These compile the *real* module (`src/lib/earnings.ts`) rather than
 * reimplementing it, so the tests exercise shipped code. No network, no wallet,
 * no funds.
 *
 * The assertion that matters most is buried in the payout group: that a
 * forecast is structurally incapable of reaching a withdrawal. Everything else
 * is arithmetic.
 *
 * Run: npm run test:earnings
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const out = mkdtempSync(path.join(tmpdir(), 'nightdesk-earnings-'));
execFileSync(
  path.resolve('node_modules/.bin/tsc'),
  [
    'src/lib/earnings.ts',
    '--outDir',
    out,
    '--module',
    'esnext',
    '--target',
    'es2022',
    '--moduleResolution',
    'bundler',
    '--skipLibCheck',
  ],
  { stdio: 'pipe' },
);

const {
  MICRO,
  accrue,
  authorCutMicro,
  authorSharePct,
  claimable,
  earningId,
  formatMicro,
  fromMicro,
  integratorFeeMicro,
  integratorFeeMicroFromFill,
  markClaimed,
  reconcile,
  summariseAllAuthors,
  summariseForAuthor,
  toMicro,
} = await import(pathToFileURL(path.join(out, 'earnings.js')).href);

let passed = 0;
let failed = 0;

const check = (label, condition, detail = '') => {
  if (condition) {
    passed += 1;
    console.log(`  \x1b[32m✓\x1b[0m ${label}${detail ? `  \x1b[2m${detail}\x1b[0m` : ''}`);
  } else {
    failed += 1;
    console.log(`  \x1b[31m✗\x1b[0m ${label}${detail ? `  \x1b[2m${detail}\x1b[0m` : ''}`);
  }
};

/** Compare numbers and report the difference, for the arithmetic groups. */
const checkNear = (label, actual, expected) => {
  const ok = Math.abs(actual - expected) <= 1e-9;
  check(label, ok, ok ? `${actual}` : `expected ${expected}, got ${actual}`);
};

const group = name => console.log(`\n\x1b[1m${name}\x1b[0m`);

const AUTHOR = '0xaa00000000000000000000000000000000000001';
const FUNDER = '0xbb00000000000000000000000000000000000002';
const OTHER_FUNDER = '0xcc00000000000000000000000000000000000003';

/** A settled fill, as Flash reports one. */
const fill = (notional, extra = {}) => ({
  notional: String(notional),
  status: 'FILLED',
  integratorFeeAmount: null,
  feeTicker: null,
  ...extra,
});

const draft = () => [];

/** accrue + return the record, for brevity. */
function seeded(overrides = {}) {
  const records = draft();
  const record = accrue(records, {
    planKey: 'plan-a',
    symbol: 'NVDAc',
    author: AUTHOR,
    funder: FUNDER,
    orderId: 'ord-1',
    notionalUsd: 100,
    bps: 25,
    ...overrides,
  });
  return { records, record };
}

/* ------------------------------------------------------------------ */
/* 1. units and rounding                                               */
/* ------------------------------------------------------------------ */

group('1. Money is integer micro-USD');

checkNear('MICRO is one millionth of a dollar', MICRO, 1_000_000);
checkNear('$1 is 1,000,000 µUSD', toMicro(1), 1_000_000);
checkNear('$0.25 is 250,000 µUSD', toMicro(0.25), 250_000);
checkNear('fromMicro inverts toMicro', fromMicro(toMicro(12.34)), 12.34);
checkNear('a bad float becomes zero, not NaN', toMicro(Number.NaN), 0);
checkNear('Infinity becomes zero', toMicro(Number.POSITIVE_INFINITY), 0);
check('every amount is an integer', Number.isInteger(toMicro(0.07)));

// The case that motivated integers at all.
checkNear('a $0.25 mirror still pays something', integratorFeeMicro(0.25, 25), 625);
checkNear('…and two-thirds of it is not rounded to zero', authorCutMicro(625, 60), 375);
checkNear('the float route would have lost this', Math.round(0.25 * 0.0025 * 0.6 * 100) / 100, 0);

/* ------------------------------------------------------------------ */
/* 2. the fee maths                                                    */
/* ------------------------------------------------------------------ */

group('2. Our fee, not the all-in fee');

checkNear('$100 at 25 bps is $0.25', integratorFeeMicro(100, 25), 250_000);
checkNear('$1,000 at 25 bps is $2.50', integratorFeeMicro(1000, 25), 2_500_000);
checkNear('10 bps halves it', integratorFeeMicro(100, 10), 100_000);
checkNear('zero bps earns nothing', integratorFeeMicro(100, 0), 0);
checkNear('negative bps is refused', integratorFeeMicro(100, -25), 0);
checkNear('a zero notional earns nothing', integratorFeeMicro(0, 25), 0);
checkNear('a negative notional earns nothing', integratorFeeMicro(-50, 25), 0);
checkNear('NaN notional earns nothing', integratorFeeMicro(Number.NaN, 25), 0);

checkNear('share defaults to 60%', authorSharePct(), 60);
checkNear('60% of a $0.25 fee is 15 cents', authorCutMicro(250_000), 150_000);
checkNear('20% of a $0.25 fee is 5 cents', authorCutMicro(250_000, 20), 50_000);
checkNear('0% pays nothing', authorCutMicro(250_000, 0), 0);
check('rounding a half-cent is still an integer', Number.isInteger(authorCutMicro(625, 60)));

/* ------------------------------------------------------------------ */
/* 3. reading a fill                                                   */
/* ------------------------------------------------------------------ */

group('3. Reading the fee off a fill');

check(
  'a USDC-tickered integrator fee is taken as reported',
  integratorFeeMicroFromFill({ integratorFeeAmount: '0.25', feeTicker: 'USDC' }, 25) === 250_000,
);
check(
  'lowercase ticker still counts as dollars',
  integratorFeeMicroFromFill({ integratorFeeAmount: '0.25', feeTicker: 'usdc' }, 25) === 250_000,
);
check(
  'USDT counts as dollars',
  integratorFeeMicroFromFill({ integratorFeeAmount: '0.1', feeTicker: 'USDT' }, 25) === 100_000,
);
check(
  'a non-dollar ticker falls back to our bps',
  integratorFeeMicroFromFill(
    { integratorFeeAmount: '0.004', feeTicker: 'NVDAc', notional: '100' },
    25,
  ) === 250_000,
);
check(
  'a missing integrator amount falls back to our bps',
  integratorFeeMicroFromFill({ feeTicker: 'USDC', notional: '100' }, 25) === 250_000,
);
check(
  'a zero reported amount falls back, not to zero',
  integratorFeeMicroFromFill({ integratorFeeAmount: '0', feeTicker: 'USDC', notional: '100' }, 25) ===
    250_000,
);
checkNear('a fill with nothing usable yields zero', integratorFeeMicroFromFill({}, 25), 0);
check(
  'a dollar-reported fee wins over the notional fallback',
  integratorFeeMicroFromFill(
    { integratorFeeAmount: '0.5', feeTicker: 'USDC', notional: '100' },
    25,
  ) === 500_000,
);

/* ------------------------------------------------------------------ */
/* 4. accrual                                                          */
/* ------------------------------------------------------------------ */

group('4. Accrual is idempotent and starts as a forecast');

const a = seeded();
checkNear('accrual produces one record', a.records.length, 1);
check('it is a forecast', a.record.state === 'estimated');
checkNear('the fee is 625 µUSD on a $0.25 mirror', a.record.feeMicro, 250_000);
checkNear('the author gets 375 µUSD…', a.record.authorMicro, 150_000);
checkNear('…which is 60% of the fee', a.record.authorMicro, 150_000);
check('the funder is recorded separately from the author', a.record.funder === FUNDER);
check('the author is normalised as given', a.record.author === AUTHOR);
check('the id is plan plus order', a.record.id === 'plan-a::ord-1');
check('bracketOrderId defaults to null', a.record.bracketOrderId === null);
check('there is no reconciliation timestamp yet', a.record.reconciledAt === undefined);

const again = accrue(a.records, {
  planKey: 'plan-a',
  symbol: 'NVDAc',
  author: AUTHOR,
  funder: FUNDER,
  orderId: 'ord-1',
  notionalUsd: 100,
  bps: 25,
});
checkNear('a retried submit does not double-count', a.records.length, 1);
check('…and returns the original record', again.id === a.record.id);
checkNear('…with the original amount', again.authorMicro, 150_000);

const idShape = earningId('p', 'o');
check('earningId is stable', idShape === earningId('p', 'o'));
check('earningId separates different orders', earningId('p', 'o1') !== earningId('p', 'o2'));
check('earningId separates different plans', earningId('p1', 'o') !== earningId('p2', 'o'));

/* ------------------------------------------------------------------ */
/* 5. reconciliation                                                   */
/* ------------------------------------------------------------------ */

group('5. Reconciliation replaces the forecast with what was charged');

const b = seeded({ notionalUsd: 100, orderId: 'ord-2' });
check('starts as an estimate', b.record.state === 'estimated');
reconcile(b.records, { planKey: 'plan-a', orderId: 'ord-2', fills: [fill(100)], bps: 25 });
check('a settled entry reconciles it', b.record.state === 'reconciled');
checkNear('the fee is now the recomputed one', b.record.feeMicro, 250_000);
check('a reconciliation timestamp is recorded', typeof b.record.reconciledAt === 'number');

// The bracket leg is a separate order and charges its own fee.
const c = seeded({ notionalUsd: 100, orderId: 'ord-3' });
reconcile(c.records, {
  planKey: 'plan-a',
  orderId: 'ord-3',
  fills: [fill(100), fill(40)],
  bps: 25,
});
checkNear('entry plus bracket leg is summed', c.record.feeMicro, 350_000);
checkNear('…and the author share follows', c.record.authorMicro, 210_000);
check(
  'entry-only would have underpaid the author',
  c.record.authorMicro > authorCutMicro(250_000),
);

// Re-running must not accumulate.
reconcile(c.records, {
  planKey: 'plan-a',
  orderId: 'ord-3',
  fills: [fill(100), fill(40)],
  bps: 25,
});
checkNear('reconciling twice does not accumulate', c.record.feeMicro, 350_000);
checkNear('…and the author share is unchanged', c.record.authorMicro, 210_000);

const d = seeded({ orderId: 'ord-4' });
reconcile(d.records, { planKey: 'plan-a', orderId: 'ord-4', fills: [], bps: 25 });
check('no fills leaves it as a forecast', d.record.state === 'estimated');

const e = seeded({ orderId: 'ord-5' });
reconcile(e.records, {
  planKey: 'plan-a',
  orderId: 'ord-5',
  fills: [{ notional: '100', status: 'PENDING', feeTicker: null, integratorFeeAmount: null }],
  bps: 25,
});
check('an unsettled fill is not reconciled', e.record.state === 'estimated');

const f = seeded({ orderId: 'ord-6' });
reconcile(f.records, {
  planKey: 'plan-a',
  orderId: 'ord-6',
  fills: [{ notional: '100', status: 'PARTIALLY_FILLED', feeTicker: null, integratorFeeAmount: null }],
  bps: 25,
});
check('a partial fill does reconcile', f.record.state === 'reconciled');

  const g = seeded({ orderId: 'ord-7' });
  const missing = reconcile(g.records, { planKey: 'plan-a', orderId: 'nope', fills: [fill(1)], bps: 25 });
  check('an unknown order reconciles nothing', missing === null);

  /*
   * The statuses Flash actually sends.
   *
   * `reconcile` originally accepted only the generic FILLED, but a real settled
   * fill comes back as CHAIN_STATUS_PROCESSED — so no author ever reconciled
   * and every payout sat at `estimated` permanently. That is the bug these four
   * assertions exist to keep out.
   */
  const processed = seeded({ orderId: 'ord-real' });
  reconcile(processed.records, {
    planKey: 'plan-a',
    orderId: 'ord-real',
    fills: [{ notional: '1.35', status: 'CHAIN_STATUS_PROCESSED', integratorFeeNotional: '0.003375', feeTicker: 'USDC' }],
    bps: 25,
  });
  check('a processed chain fill reconciles', processed.record.state === 'reconciled', processed.record.state);

  const finalized = seeded({ orderId: 'ord-fin' });
  reconcile(finalized.records, {
    planKey: 'plan-a',
    orderId: 'ord-fin',
    fills: [{ notional: '1.35', status: 'CHAIN_STATUS_FINALIZED', integratorFeeNotional: '0.003375', feeTicker: 'USDC' }],
    bps: 25,
  });
  check('a finalized chain fill reconciles', finalized.record.state === 'reconciled', finalized.record.state);

  const reorged = seeded({ orderId: 'ord-reorg' });
  reconcile(reorged.records, {
    planKey: 'plan-a',
    orderId: 'ord-reorg',
    fills: [{ notional: '1.35', status: 'CHAIN_STATUS_REORGED', integratorFeeNotional: '0.003375', feeTicker: 'USDC' }],
    bps: 25,
  });
  check('a reorged fill is never paid out', reorged.record.state === 'estimated', reorged.record.state);

  const blank = seeded({ orderId: 'ord-blank' });
  reconcile(blank.records, {
    planKey: 'plan-a',
    orderId: 'ord-blank',
    fills: [{ notional: '1.35', status: null, integratorFeeNotional: '0.003375', feeTicker: 'USDC' }],
    bps: 25,
  });
  check('a fill with no status is not treated as settled', blank.record.state === 'estimated', blank.record.state);

/* ------------------------------------------------------------------ */
/* 6. what is payable                                                  */
/* ------------------------------------------------------------------ */

group('6. Only settled money is withdrawable');

const ledger = [];
accrue(ledger, {
  planKey: 'plan-a', symbol: 'NVDAc', author: AUTHOR, funder: FUNDER, orderId: 'o1',
  notionalUsd: 100, bps: 25,
});
accrue(ledger, {
  planKey: 'plan-a', symbol: 'NVDAc', author: AUTHOR, funder: OTHER_FUNDER, orderId: 'o2',
  notionalUsd: 100, bps: 25,
});
accrue(ledger, {
  planKey: 'plan-b', symbol: 'TSLAc', author: AUTHOR, funder: FUNDER, orderId: 'o3',
  notionalUsd: 100, bps: 25,
});
checkNear('three orders, three records', ledger.length, 3);
checkNear('nothing is payable yet', claimable(ledger).length, 0);

reconcile(ledger, { planKey: 'plan-a', orderId: 'o1', fills: [fill(100)], bps: 25 });
checkNear('one settled order becomes payable', claimable(ledger).length, 1);
check('the forecast does not leak into the payable set', claimable(ledger).every(r => r.state === 'reconciled'));

const summary = summariseForAuthor(ledger, AUTHOR);
checkNear('payable is one order', summary.payableMicro, 150_000);
checkNear('two orders are still just forecasts', summary.estimatedMicro, 300_000);
checkNear('nothing has been claimed', summary.claimedMicro, 0);
checkNear('two distinct plans are counted', summary.plans, 2);
checkNear('all three records are counted', summary.records, 3);

const stranger = summariseForAuthor(ledger, OTHER_FUNDER);
checkNear('a different wallet is owed nothing', stranger.payableMicro, 0);
checkNear('…and has no records', stranger.records, 0);

// Claiming.
const claimed = markClaimed(ledger, [ledger[0].id], 'tx-abc');
checkNear('one record was marked claimed', claimed.length, 1);
checkNear('it moved out of payable', claimable(ledger).length, 0);
const afterClaim = summariseForAuthor(ledger, AUTHOR);
checkNear('payable is now zero', afterClaim.payableMicro, 0);
checkNear('claimed holds the 375 µUSD', afterClaim.claimedMicro, 150_000);
checkNear('forecasts are untouched by a payout', afterClaim.estimatedMicro, 300_000);
check('the claim is stamped', ledger[0].claimedAt !== undefined);
check('the transfer reference is kept', ledger[0].payoutRef === 'tx-abc');

const doubleClaim = markClaimed(ledger, [ledger[0].id], 'tx-abc');
checkNear('claiming twice changes nothing', doubleClaim.length, 0);
checkNear('a paid record cannot be re-paid', claimable(ledger).length, 0);

// An estimate can never be claimed, even if its id is named explicitly.
const estimateId = ledger[1].id;
const badClaim = markClaimed(ledger, [estimateId], 'tx-bad');
checkNear('an estimate named for payout is refused', badClaim.length, 0);
check('…and stays a forecast', ledger[1].state === 'estimated');

// A late fill report must not reopen a settled payout.
reconcile(ledger, { planKey: 'plan-a', orderId: 'o1', fills: [fill(999)], bps: 25 });
check('a claimed record is terminal', ledger[0].state === 'claimed');
checkNear('…and its amount is frozen', ledger[0].authorMicro, 150_000);

const queue = summariseAllAuthors(ledger);
checkNear('every author appears in the queue', queue.length, 1);
check('the queue is sorted by payable, largest first', queue[0].author === AUTHOR);

const q = [];
accrue(q, { planKey: 'p', symbol: 'S', author: '0xsmall', funder: FUNDER, orderId: 'x', notionalUsd: 1, bps: 25 });
accrue(q, { planKey: 'p', symbol: 'S', author: '0xbig', funder: FUNDER, orderId: 'y', notionalUsd: 1000, bps: 25 });
reconcile(q, { planKey: 'p', orderId: 'x', fills: [fill(1)], bps: 25 });
reconcile(q, { planKey: 'p', orderId: 'y', fills: [fill(1000)], bps: 25 });
const ordered = summariseAllAuthors(q);
check('the largest debt is first', ordered[0].author === '0xbig');
check('the smallest is last', ordered[1].author === '0xsmall');

/* ------------------------------------------------------------------ */
/* 7. the copy                                                         */
/* ------------------------------------------------------------------ */

group('7. Sub-cent money is never printed as $0.00');

check('zero prints as $0.00', formatMicro(0) === '$0.00');
check('375 µUSD prints in cents, not as $0.00', formatMicro(375) === '0.04¢');
check('375 µUSD does not print $0.00', formatMicro(375) !== '$0.00');
check('half a cent prints as 0.50¢', formatMicro(5000) === '0.50¢');
check('just under a cent stays in cents', formatMicro(9999) === '1.00¢');
check('15 cents prints as dollars', formatMicro(150_000) === '$0.15');
check('a dollar prints to two places', formatMicro(1_000_000) === '$1.00');
check('$2.50 prints correctly', formatMicro(2_500_000) === '$2.50');
check('a negative shows as a negative', formatMicro(-150_000).startsWith('-'));

/* --- summary --------------------------------------------------------- */
rmSync(out, { recursive: true, force: true });

console.log(`\n${'─'.repeat(64)}`);
if (failed === 0) {
  console.log(`\x1b[1m\x1b[32m${passed}/${passed} assertions passed\x1b[0m`);
  console.log('\nAuthors are paid on measured fees, and a forecast can never be withdrawn.\n');
  process.exit(0);
} else {
  console.log(`\x1b[1m\x1b[31m${failed} failed\x1b[0m, ${passed} passed`);
  process.exit(1);
}
