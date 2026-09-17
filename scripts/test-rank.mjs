#!/usr/bin/env node
/**
 * Assertions for the board ranking.
 *
 * Compiles the real `src/lib/rank.ts` (not a copy of it) into a temp directory
 * and imports the output, so the test cannot pass while the shipped module is
 * broken.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const GREEN = '\u001b[32m';
const RED = '\u001b[31m';
const DIM = '\u001b[2m';
const BOLD = '\u001b[1m';
const OFF = '\u001b[0m';

let passed = 0;
let failed = 0;
let groupName = '';

const group = name => {
  groupName = name;
  console.log(`\n${BOLD}${name}${OFF}`);
};

const check = (label, condition, detail = '') => {
  if (condition) {
    passed += 1;
    console.log(`  ${GREEN}✓${OFF} ${label}${detail ? `  ${DIM}${detail}${OFF}` : ''}`);
  } else {
    failed += 1;
    console.log(`  ${RED}✗${OFF} ${label}${detail ? `  ${DIM}${detail}${OFF}` : ''}`);
  }
};

/* --- compile the real module ---------------------------------------- */
const out = mkdtempSync(path.join(tmpdir(), 'nightdesk-rank-'));
let rank;
try {
  execFileSync(
    path.join(root, 'node_modules', '.bin', 'tsc'),
    [
      path.join(root, 'src', 'lib', 'rank.ts'),
      '--outDir', out,
      '--module', 'esnext',
      '--target', 'es2022',
      '--moduleResolution', 'bundler',
      '--skipLibCheck',
    ],
    { cwd: root, stdio: 'pipe' },
  );
  writeFileSync(path.join(out, 'package.json'), '{"type":"module"}');
  rank = await import(pathToFileURL(path.join(out, 'rank.js')).href);
} catch (error) {
  console.error(`${RED}Could not compile src/lib/rank.ts${OFF}`);
  console.error(error.stdout?.toString() ?? error.message);
  process.exit(1);
}

const { rankPlans, scoreRow, hasRealised } = rank;

/* --- fixtures -------------------------------------------------------- */
const row = (planKey, mirrors, createdAt = 1_700_000_000_000) => ({ planKey, mirrors, createdAt });

const result = (realisedUsd, { unrealisedUsd = 0, totalPct = 0 } = {}) => ({
  realisedUsd,
  unrealisedUsd,
  totalUsd: realisedUsd + unrealisedUsd,
  totalPct,
});

const keys = rows => rows.map(r => r.planKey);

/* --- 1. realised ranking is the headline rule ------------------------ */
group('Ranked on realised P&L');

{
  /*
   * The case that matters: a plan that booked more real profit wins, even when a
   * rival copied it twenty times over. Reach is not the ranking signal.
   */
  const rows = [row('popular', 20), row('profitable', 1), row('middling', 5)];
  const pnl = {
    popular: result(0.4, { unrealisedUsd: 0.1 }),
    profitable: result(3.5, { unrealisedUsd: -0.2 }),
    middling: result(1.1),
  };
  const ranked = rankPlans(rows, pnl, 'realised');
  check('more realised profit wins', keys(ranked)[0] === 'profitable', keys(ranked).join(' > '));
  check(
    'the most-copied plan does not automatically lead',
    keys(ranked)[0] !== 'popular' && keys(ranked).indexOf('popular') === 2,
  );
}

{
  // A loss is still a score. It beats nothing only because unpriced is lower than any number.
  const rows = [row('loss'), row('win'), row('flat')];
  const pnl = { loss: result(-2.25), win: result(1), flat: result(0) };
  const ranked = rankPlans(rows, pnl, 'realised');
  check('a winner leads a loser', keys(ranked).join(' > ') === 'win > flat > loss', keys(ranked).join(' > '));
  check('a loss is a real score, not an unpriced row', scoreRow(row('loss'), pnl, 'realised')[0] === -2.25);
}

group('Unpriced is not the same as flat');

{
  const rows = [row('unpriced', 50), row('zero', 1)];
  const pnl = { zero: result(0) };
  const ranked = rankPlans(rows, pnl, 'realised');
  check('a priced zero beats an unpriced row', keys(ranked)[0] === 'zero', keys(ranked).join(' > '));
  check('unpriced sorts last despite 50 wallets', keys(ranked)[1] === 'unpriced');
  check('an unpriced score is -Infinity, not 0', scoreRow(row('unpriced'), pnl, 'realised')[0] === Number.NEGATIVE_INFINITY);

  // Every row unpriced: order is stable and still deterministic (newest first).
  const allUnpriced = rankPlans(
    [row('a', 1, 300), row('b', 9, 200), row('c', 4, 100)],
    {},
    'realised',
  );
  check('all-unpriced falls back to recency', keys(allUnpriced).join(' > ') === 'a > b > c', keys(allUnpriced).join(' > '));
}

group('Tie-breaks');

{
  // Same realised: more open profit wins.
  const rows = [row('lessOpen'), row('moreOpen')];
  const pnl = {
    lessOpen: result(1, { unrealisedUsd: 0.1 }),
    moreOpen: result(1, { unrealisedUsd: 2 }),
  };
  check('a realised tie breaks on open', keys(rankPlans(rows, pnl, 'realised'))[0] === 'moreOpen');

  // Same realised and same total: more wallets wins.
  const tied = [row('few', 2), row('many', 7)];
  const tiedPnl = { few: result(1), many: result(1) };
  check('then on wallets', keys(rankPlans(tied, tiedPnl, 'realised'))[0] === 'many');

  // Fully tied: newest first.
  const same = [row('older', 3, 100), row('newer', 3, 200)];
  const samePnl = { older: result(1), newer: result(1) };
  check('then on recency', keys(rankPlans(same, samePnl, 'realised'))[0] === 'newer');
}

/* --- 2. the other two modes ------------------------------------------ */
group('Return % mode');

{
  const rows = [row('bigDollars'), row('betterReturn')];
  const pnl = {
    /* A large wallet books more dollars; a small one does better with less. */
    bigDollars: { realisedUsd: 10, unrealisedUsd: 0, totalUsd: 10, totalPct: 1.5 },
    betterReturn: { realisedUsd: 0.5, unrealisedUsd: 0, totalUsd: 0.5, totalPct: 22 },
  };
  check('ranks on percentage, not dollars', keys(rankPlans(rows, pnl, 'return'))[0] === 'betterReturn');

  const missing = { known: { realisedUsd: 1, unrealisedUsd: 0, totalUsd: 1, totalPct: 4 } };
  const withNull = [row('nullPct'), row('known')];
  check(
    'a null percentage does not outrank a real one',
    keys(rankPlans(withNull, missing, 'return'))[0] === 'known',
  );
}

group('Wallets mode');

{
  const rows = [row('quiet', 1), row('loud', 9)];
  check('ignores performance entirely', keys(rankPlans(rows, {}, 'wallets'))[0] === 'loud');
  check('needs no pricing at all', rankPlans(rows, {}, 'wallets').length === 2);
}

/* --- 3. shape of the result ----------------------------------------- */
group('The ranking is safe to render');

{
  const rows = [row('a', 1), row('b', 2), row('c', 3)];
  const ranked = rankPlans(rows, {}, 'realised');
  check('returns every row', ranked.length === 3);
  check('invents none', new Set(keys(ranked)).size === 3);
  check('does not mutate the input', rows.map(r => r.planKey).join() === 'a,b,c');
  check('is deterministic', keys(rankPlans(rows, {}, 'realised')).join() === keys(ranked).join());

  const unstable = [row('a', 1), row('b', 3), row('c', 2)];
  check('equal scores never throw', rankPlans(unstable, {}, 'wallets').length === 3);
}

group('hasRealised');

check('false while nothing has closed', hasRealised({ a: result(0), b: result(0) }) === false);
check('true once one plan books', hasRealised({ a: result(0), b: result(0.01) }) === true);
check('true for a loss', hasRealised({ a: result(-0.5) }) === true);
check('false for an empty board', hasRealised({}) === false);

/* --- summary --------------------------------------------------------- */
rmSync(out, { recursive: true, force: true });

console.log(`\n${'─'.repeat(64)}`);
if (failed === 0) {
  console.log(`${BOLD}${GREEN}${passed}/${passed} assertions passed${OFF}`);
  console.log('\nThe board is ranked on what settled, not on how loud it was.\n');
  process.exit(0);
} else {
  console.log(`${BOLD}${RED}${failed} failed${OFF}, ${passed} passed`);
  process.exit(1);
}
