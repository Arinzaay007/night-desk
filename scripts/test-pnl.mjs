#!/usr/bin/env node
/**
 * Unit tests for the P&L maths.
 *
 * These compile the *real* module (`src/lib/pnl.ts`) rather than reimplementing
 * it, so the tests exercise shipped code. No network, no wallet, no funds.
 *
 * Run: npm run test:pnl
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const out = mkdtempSync(path.join(tmpdir(), 'nightdesk-pnl-'));
execFileSync(
  path.resolve('node_modules/.bin/tsc'),
  [
    'src/lib/pnl.ts',
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

const { computePnl, aggregatePnl, tokensAcquired, tokensSold } = await import(
  pathToFileURL(path.join(out, 'pnl.js')).href
);

let passed = 0;
let failed = 0;

function check(name, actual, expected, tolerance = 0.0001) {
  const ok =
    typeof expected === 'number' && typeof actual === 'number'
      ? Math.abs(actual - expected) <= tolerance
      : actual === expected;
  if (ok) {
    passed += 1;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } else {
    failed += 1;
    console.log(`  \x1b[31m✗\x1b[0m ${name}  \x1b[2mexpected ${expected}, got ${actual}\x1b[0m`);
  }
}

const group = name => console.log(`\n\x1b[1m${name}\x1b[0m`);

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

/** An entry that bought `tokens` for `spent` USD at `price`. */
const entryOrder = ({ tokens, spent, price, extraFills = [] }) => ({
  status: 'ORDER_STATUS_FILLED',
  qty: String(spent),
  filled: {
    targetAmount: String(tokens),
    contraAmount: String(spent),
    averageNotionalPrice: String(price),
  },
  fills: [{ notional: String(spent), fillPrice: String(price) }, ...extraFills],
});

/** A protective pair that sold `tokens` for `proceeds` USD at `price`. */
const exitOrder = ({ tokens, proceeds, price }) => ({
  status: 'ORDER_STATUS_FILLED',
  fills: proceeds ? [{ notional: String(proceeds), fillPrice: String(price) }] : [],
});

/* ------------------------------------------------------------------ */

group('Token maths');

check(
  'tokensAcquired prefers the settled targetAmount',
  tokensAcquired(entryOrder({ tokens: 1.25, spent: 250, price: 200 })),
  1.25,
);
check(
  'tokensAcquired falls back to contraAmount / averagePrice',
  tokensAcquired({ filled: { targetAmount: null, contraAmount: '240', averageNotionalPrice: '200' } }),
  1.2,
);
check('tokensAcquired is 0 when nothing settled', tokensAcquired({ filled: null }), 0);
check(
  'tokensSold divides notional by fill price',
  tokensSold(exitOrder({ tokens: 0.5, proceeds: 110, price: 220 })),
  0.5,
);
check('tokensSold ignores fills with no price', tokensSold({ fills: [{ notional: '5', fillPrice: null }] }), 0);

group('Open position (entered, not exited)');

const open = computePnl({
  entry: entryOrder({ tokens: 1, spent: 200, price: 200 }),
  exit: exitOrder({ proceeds: 0 }),
  currentPrice: 230,
});
check('status is open', open.status, 'open');
check('entry cost is the settled notional', open.entryCostUsd, 200);
check('no realised P&L yet', open.realisedUsd, 0);
check('position is valued at the current price', open.positionValueUsd, 230);
check('unrealised is value minus cost', open.unrealisedUsd, 30);
check('total equals unrealised', open.totalUsd, 30);
check('total percent is 15%', open.totalPct, 15);
check('still holding the full position', open.tokensHeld, 1);

group('Open position, underwater');

const down = computePnl({
  entry: entryOrder({ tokens: 2, spent: 400, price: 200 }),
  exit: exitOrder({ proceeds: 0 }),
  currentPrice: 170,
});
check('unrealised is negative', down.unrealisedUsd, -60);
check('total percent is -15%', down.totalPct, -15);
check('cost basis is unchanged', down.entryCostUsd, 400);

group('Closed position (bracket fired in full)');

const closed = computePnl({
  entry: entryOrder({ tokens: 1, spent: 200, price: 200 }),
  exit: exitOrder({ tokens: 1, proceeds: 250, price: 250 }),
  currentPrice: 250,
});
check('status is closed', closed.status, 'closed');
check('realised is proceeds minus fully-sold cost', closed.realisedUsd, 50);
check('nothing is held', closed.tokensHeld, 0);
check('no unrealised on a closed position', closed.unrealisedUsd, 0);
check('total equals realised', closed.totalUsd, 50);
check('total percent is 25%', closed.totalPct, 25);

group('Closed position at a loss (stop fired)');

const stopped = computePnl({
  entry: entryOrder({ tokens: 1, spent: 200, price: 200 }),
  exit: exitOrder({ tokens: 1, proceeds: 184, price: 184 }),
  currentPrice: 180,
});
check('realised loss is booked', stopped.realisedUsd, -16);
check('unrealised does not soften it', stopped.unrealisedUsd, 0);
check('total percent is negative', stopped.totalPct, -8);

group('Partial exit (pro-rated cost basis)');

const partial = computePnl({
  entry: entryOrder({ tokens: 1, spent: 200, price: 200 }),
  exit: exitOrder({ tokens: 0.5, proceeds: 125, price: 250 }),
  currentPrice: 250,
});
check('status is partial', partial.status, 'partial');
check('realised covers half the cost basis', partial.realisedUsd, 25);
check('half the position remains', partial.tokensHeld, 0.5);
check('remaining half still valued', partial.positionValueUsd, 125);
check('unrealised is 125 - 100', partial.unrealisedUsd, 25);
check('total is both halves', partial.totalUsd, 50);

group('Unfilled entry');

const unfilled = computePnl({
  entry: { status: 'ORDER_STATUS_ACCEPTED', qty: '50', filled: null, fills: [] },
  exit: exitOrder({ proceeds: 0 }),
  currentPrice: 200,
});
check('status is unfilled', unfilled.status, 'unfilled');
check('no cost basis yet', unfilled.entryCostUsd, 0);
check('no percentage without a cost basis', unfilled.totalPct, null);
check('explains itself', typeof unfilled.note, 'string');

group('Missing price');

const noPrice = computePnl({
  entry: entryOrder({ tokens: 1, spent: 200, price: 200 }),
  exit: exitOrder({ proceeds: 0 }),
  currentPrice: null,
});
check('unrealised is excluded, not guessed', noPrice.unrealisedUsd, 0);
check('cost basis still reported', noPrice.entryCostUsd, 200);
check('flags the omission', typeof noPrice.note, 'string');

group('Malformed input must not produce NaN');

const junk = computePnl({
  entry: { filled: { targetAmount: 'abc', contraAmount: 'xyz', averageNotionalPrice: null }, fills: [{ notional: 'nope' }] },
  exit: { fills: [{ notional: undefined, fillPrice: '???' }] },
  currentPrice: Number.NaN,
});
check('entryCost is 0, not NaN', junk.entryCostUsd, 0);
check('tokensHeld is 0, not NaN', junk.tokensHeld, 0);
check('total is 0, not NaN', junk.totalUsd, 0);
check('every figure is finite', [junk.entryCostUsd, junk.realisedUsd, junk.unrealisedUsd, junk.totalUsd].every(Number.isFinite), true);

group('Aggregation');

const agg = aggregatePnl([
  open,
  closed,
  stopped,
  partial,
  unfilled,
]);
check('counts every mirror', agg.mirrors, 5);
check('counts statuses', agg.open + agg.closed + agg.partial + agg.unfilled, 5);
check('realised sums the booked rows', agg.realisedUsd, 50 - 16 + 25);
check('unrealised sums the open rows', agg.unrealisedUsd, 30 + 25);
check('invested sums settled cost only', agg.investedUsd, 200 + 200 + 200 + 200);
check('total is realised plus unrealised', agg.totalUsd, 59 + 55);
check('percentage is a number when invested > 0', typeof agg.totalPct, 'number');

const emptyAgg = aggregatePnl([]);
check('empty aggregate is all zeros', emptyAgg.totalUsd, 0);
check('empty aggregate has no percentage', emptyAgg.totalPct, null);

/* ------------------------------------------------------------------ */

console.log(`\n${'─'.repeat(60)}`);
console.log(`\x1b[1m${passed}/${passed + failed} assertions passed\x1b[0m`);
rmSync(out, { recursive: true, force: true });

if (failed) {
  console.log('\n\x1b[31mP&L maths is wrong. Fix before showing it to anyone.\x1b[0m\n');
  process.exit(1);
}
console.log('\nThe maths behind the board holds up.\n');
