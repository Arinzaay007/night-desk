#!/usr/bin/env node
/**
 * Unit tests for plan compliance.
 *
 * These compile the *real* module (`src/lib/verify.ts`) rather than
 * reimplementing it, so the tests exercise shipped code. No network, no wallet.
 *
 * The assertions that matter are the NEGATIVE ones. A compliance readout that
 * says "as published" when it should say "deviated" is worse than no readout at
 * all: it is the app lying on the author's behalf.
 *
 * Run: npm run test:verify
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const out = mkdtempSync(path.join(tmpdir(), 'nightdesk-verify-'));
execFileSync(
  path.resolve('node_modules/.bin/tsc'),
  [
    'src/lib/verify.ts',
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
  TOLERANCE_PCT,
  deviationPct,
  evaluateCompliance,
  summariseCompliance,
  withinTolerance,
} = await import(pathToFileURL(path.join(out, 'verify.js')).href);

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

const group = name => console.log(`\n\x1b[1m${name}\x1b[0m`);

/**
 * A clean mirror of a +20% / -8% plan on a $240.45 entry.
 * Levels are what the quote would have produced at mirror time.
 */
const clean = (over = {}) => ({
  tpPct: 20,
  slPct: 8,
  plannedTakeProfit: 288.54,
  plannedStopLoss: 221.21,
  actualTakeProfit: 288.54,
  actualStopLoss: 221.21,
  bracketOrderId: 'bracket-1',
  bracketStatus: 'active',
  entryPrice: 240.45,
  ...over,
});

/* ------------------------------------------------------------------ */

group('1. Tolerance');

check('the tolerance is half a percent', TOLERANCE_PCT === 0.5);
check('an exact match is within tolerance', withinTolerance(100, 100));
check('0.4% out is within tolerance', withinTolerance(100.4, 100));
check('a whole percent out is NOT', withinTolerance(101, 100) === false);
check('10% out is not', withinTolerance(110, 100) === false);
check('half the level is not', withinTolerance(50, 100) === false);
check('NaN is never compliant', withinTolerance(Number.NaN, 100) === false);
check('a zero expectation is refused, not divided by', withinTolerance(1, 0) === false);

check('deviation is symmetric', deviationPct(110, 100) === deviationPct(90, 100));
check('deviation of an exact match is zero', deviationPct(100, 100) === 0);
check('a missing actual has no deviation', deviationPct(null, 100) === null);
check('a missing expected has no deviation', deviationPct(100, null) === null);
check('deviation is a percentage of the expected', Math.abs(deviationPct(120, 100) - 20) < 0.0001);

/* ------------------------------------------------------------------ */

group('2. A mirror that ran the plan');

const good = evaluateCompliance(clean());
check('it is published', good.status === 'published', good.status);
check('take-profit deviation is zero', good.takeProfitDeviationPct === 0);
check('stop-loss deviation is zero', good.stopLossDeviationPct === 0);
check('no check failed', good.checks.filter(c => !c.ok && !c.skipped).length === 0);
check('protection attached is asserted', good.checks.some(c => c.name === 'protection attached' && c.ok));
check('the correct-side check ran', good.checks.some(c => c.name.includes('correct side')));
check('the summary names the plan levels', good.summary.includes('+20%') && good.summary.includes('-8%'), good.summary);
check('the summary reads as a positive', good.summary.startsWith('Ran as published'));

/* ------------------------------------------------------------------ */

group('3. A widened stop is CAUGHT — the case that matters');

// Mirrorer took the entry but set their stop at -16% instead of -8%.
const widened = evaluateCompliance(clean({ actualStopLoss: 202.0 }));
check('a doubled stop is NOT published', widened.status !== 'published', widened.status);
check('it is reported as deviated', widened.status === 'deviated', widened.status);
check('the stop deviation is large', widened.stopLossDeviationPct > 8, `${widened.stopLossDeviationPct?.toFixed(1)}%`);
check('take-profit is still judged fine', widened.takeProfitDeviationPct === 0);
check('the failing check is the stop', widened.checks.some(c => c.name.includes('stop-loss') && !c.ok));
check('the summary names the stop', widened.summary.toLowerCase().includes('stop'));

// Slightly outside tolerance.
const nearly = evaluateCompliance(clean({ actualTakeProfit: 291.0 }));
check('1% off the TP is still caught', nearly.status === 'deviated');
check('0.4% off the TP is tolerated', evaluateCompliance(clean({ actualTakeProfit: 289.7 })).status === 'published');

/* ------------------------------------------------------------------ */

group('4. No protection at all');

const bare = evaluateCompliance(clean({ bracketOrderId: null, bracketStatus: null, actualTakeProfit: null, actualStopLoss: null }));
check('an entry with no bracket is unprotected', bare.status === 'unprotected', bare.status);
check('it is never called published', bare.status !== 'published');
check('the summary says so plainly', bare.summary.toLowerCase().includes('no protection'), bare.summary);
check('the attached check failed', bare.checks.some(c => c.name === 'protection attached' && !c.ok));
check('unprotected outranks deviated', bare.status === 'unprotected');

/* ------------------------------------------------------------------ */

group('5. Cancelled protection');

const cancelled = evaluateCompliance(clean({ bracketStatus: 'cancelled' }));
check('a cancelled bracket is not published', cancelled.status !== 'published', cancelled.status);
check('it is deviated', cancelled.status === 'deviated');
check('the live check failed', cancelled.checks.some(c => c.name === 'protection still live' && !c.ok));

const fired = evaluateCompliance(clean({ bracketStatus: 'closed' }));
check('a closed bracket is also not published', fired.status !== 'published');

/* ------------------------------------------------------------------ */

group('6. Unknown is reported, never assumed good');

const unknown = evaluateCompliance(clean({ actualTakeProfit: null, actualStopLoss: null }));
check('missing levels give unknown', unknown.status === 'unknown', unknown.status);
check('unknown is never published', unknown.status !== 'published');
check('it says what is missing', unknown.summary.includes('Not enough'), unknown.summary);
check('the skipped checks are marked', unknown.checks.some(c => c.skipped));

/* ------------------------------------------------------------------ */

group('7. Inverted protection');

const inverted = evaluateCompliance(clean({ actualTakeProfit: 200, actualStopLoss: 300 }));
check('TP below the entry is caught', inverted.status === 'deviated', inverted.status);
check('the correct-side check failed', inverted.checks.some(c => c.name.includes('correct side') && !c.ok));

/* ------------------------------------------------------------------ */

group('8. Aggregation');

const summary = summariseCompliance([
  evaluateCompliance(clean()),
  evaluateCompliance(clean()),
  evaluateCompliance(clean({ actualStopLoss: 202 })),
  evaluateCompliance(clean({ bracketOrderId: null, actualTakeProfit: null, actualStopLoss: null })),
  evaluateCompliance(clean({ actualTakeProfit: null, actualStopLoss: null })),
]);
check('every mirror is counted', summary.total === 5);
check('two ran as published', summary.published === 2);
check('one deviated', summary.deviated === 1);
check('one unprotected', summary.unprotected === 1);
check('one unknown', summary.unknown === 1);
check('the rate excludes unknowns', Math.abs(summary.ratePct - 50) < 0.0001, `${summary.ratePct}% of 4 judgeable`);

const allUnknown = summariseCompliance([evaluateCompliance(clean({ actualTakeProfit: null, actualStopLoss: null }))]);
check('nothing judgeable gives a null rate, not 0%', allUnknown.ratePct === null);

const empty = summariseCompliance([]);
check('an empty plan is not a 0% failure', empty.ratePct === null && empty.total === 0);

/* --- summary --------------------------------------------------------- */
rmSync(out, { recursive: true, force: true });

console.log(`\n${'─'.repeat(64)}`);
if (failed === 0) {
  console.log(`\x1b[1m\x1b[32m${passed}/${passed} assertions passed\x1b[0m`);
  console.log('\nCompliance is a readout, not a control — and it never assumes the best.\n');
  process.exit(0);
} else {
  console.log(`\x1b[1m\x1b[31m${failed} failed\x1b[0m, ${passed} passed`);
  process.exit(1);
}
