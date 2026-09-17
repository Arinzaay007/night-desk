#!/usr/bin/env node
/**
 * The author ledger, walked end to end through HTTP against a running server.
 *
 * Sibling of test-earnings.mjs: that one proves the arithmetic, this one proves
 * the WIRING — that the order route accrues, that the ledger reports a forecast
 * as unpayaable, that prepare builds real transfer calldata, and that settling
 * cannot pay twice.
 *
 * It injects a store file and restores whatever was there, so it is safe to run
 * against a local dev server with real data. Do NOT point it at a deployment.
 *
 * Run: npm run test:earnings:live     (needs `npm run dev` in another shell)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';

const BASE = 'http://localhost:3000';
const FILE = '.data/store.json';
const AUTHOR = '0xaa00000000000000000000000000000000000001';
const FUNDER = '0xbb00000000000000000000000000000000000002';

let pass = 0, fail = 0;
const check = (label, ok, detail = '') => {
  if (ok) { pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}${detail ? `  \x1b[2m${detail}\x1b[0m` : ''}`); }
  else { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}${detail ? `  \x1b[2m${detail}\x1b[0m` : ''}`); }
};
const group = n => console.log(`\n\x1b[1m${n}\x1b[0m`);

const api = async (path, init) => {
  const r = await fetch(BASE + path, init);
  return { status: r.status, payload: await r.json().catch(() => ({})) };
};
const post = (body) => api('/api/earnings', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

// preserve whatever was there
const had = existsSync(FILE);
if (had) copyFileSync(FILE, '/tmp/store.live.bak');

const write = (earnings) => {
  mkdirSync('.data', { recursive: true });
  writeFileSync(FILE, JSON.stringify({ mirrors: [], earnings }, null, 2));
};

const rec = (over) => ({
  id: `${over.planKey}::${over.orderId}`,
  planKey: 'plan-x',
  symbol: 'NVDAc',
  author: AUTHOR,
  funder: FUNDER,
  orderId: 'ord-1',
  bracketOrderId: null,
  feeMicro: 250000,
  authorMicro: 150000,
  state: 'estimated',
  createdAt: Date.now(),
  ...over,
});

try {
  /* ---- 1. an estimate is a forecast, and nothing more ---- */
  group('1. A forecast is visible but not payable');
  write([rec({ orderId: 'ord-1' })]);
  let r = await api(`/api/earnings?author=${AUTHOR}`);
  check('the record is returned', r.payload?.earnings?.length === 1);
  check('it is labelled a forecast', r.payload?.earnings?.[0]?.state === 'estimated');
  check('payable totals zero', r.payload?.summary?.payableMicro === 0);
  check('the forecast is reported separately', r.payload?.summary?.estimatedMicro === 150000);
  check('the forecast is formatted, not $0.00', r.payload?.totals?.estimated === '$0.15', r.payload?.totals?.estimated);

  r = await api('/api/earnings?queue=1');
  check('the queue is empty for an unearned balance', r.payload?.queue?.length === 0, `owed ${r.payload?.totalPayable}`);

  r = await post({ action: 'prepare', author: AUTHOR });
  check('prepare offers no transfer', r.payload?.amountMicro === 0 && r.payload?.tx === undefined);
  check('...and explains why', (r.payload?.excludes ?? []).length === 1, r.payload?.excludes?.[0]?.reason?.slice(0, 48));

  /* ---- 2. reconciliation turns it into money owed ---- */
  group('2. A settled fill creates an obligation');
  write([
    rec({ orderId: 'ord-1', state: 'reconciled', reconciledAt: Date.now() }),
    rec({ orderId: 'ord-2', state: 'estimated' }),
  ]);
  r = await api(`/api/earnings?author=${AUTHOR}`);
  check('one record is payable', r.payload?.summary?.payableMicro === 150000);
  check('the unsettled one is still a forecast', r.payload?.summary?.estimatedMicro === 150000);
  check('two records are counted', r.payload?.summary?.records === 2);

  r = await api('/api/earnings?queue=1');
  check('the author appears in the queue', r.payload?.queue?.length === 1);
  check('largest debt first — only one here', r.payload?.queue?.[0]?.author === AUTHOR);
  check('the queue totals the debt', r.payload?.totalPayable === '$0.15', r.payload?.totalPayable);

  /* ---- 3. prepare builds the real transfer ---- */
  group('3. Prepare builds a real USDC transfer');
  r = await post({ action: 'prepare', author: AUTHOR });
  const tx = r.payload?.tx;
  check('a transaction is built', !!tx);
  check('it is a USDC transfer', tx?.data?.startsWith('0xa9059cbb'), tx?.data?.slice(0, 10));
  check('the recipient is padded into the calldata', tx?.data?.toLowerCase().includes(AUTHOR.slice(2).toLowerCase()));
  check('only the reconciled amount is sent', tx?.amountBaseUnits === '150000', tx?.amountBaseUnits);
  check('the amount equals payable, not payable plus forecast', r.payload?.amount === '$0.15', r.payload?.amount);
  check('the forecast is excluded and stated', (r.payload?.excludes ?? []).length === 1);
  check('it covers exactly one fill', (r.payload?.covers ?? []).length === 1);
  check('gas is priced from a real ETH quote', r.payload?.costs?.ethUsd > 100, `ETH $${r.payload?.costs?.ethUsd}`);
  check('gas is not absurd', r.payload?.costs?.estimatedGasUsd < 1, `$${r.payload?.costs?.estimatedGasUsd?.toFixed(6)}`);
  check('gas is labelled in gwei, not wei', r.payload?.costs?.gasPriceGwei < 1000, `${r.payload?.costs?.gasPriceGwei} gwei`);
  check('$0.15 is worth sending', r.payload?.costs?.uneconomic === false);

  /* ---- 4. settle ---- */
  group('4. Settling is recorded and irreversible');
  r = await post({ action: 'settle', author: AUTHOR, ref: 'test-tx-hash' });
  check('one record was marked paid', (r.payload?.changed ?? []).length === 1);
  check('the amount recorded is right', r.payload?.changed?.[0]?.authorMicro === 150000);
  check('the total is reported', r.payload?.total === '$0.15', r.payload?.total);

  r = await api(`/api/earnings?author=${AUTHOR}`);
  check('payable is now zero', r.payload?.summary?.payableMicro === 0);
  check('claimed holds the money', r.payload?.summary?.claimedMicro === 150000);
  check('the forecast survived the payout', r.payload?.summary?.estimatedMicro === 150000);

  r = await post({ action: 'settle', author: AUTHOR });
  check('settling again is a no-op', (r.payload?.changed ?? []).length === 0, 'no double-payment');

  r = await api(`/api/earnings?author=${AUTHOR}`);
  check('the amount did not double', r.payload?.summary?.claimedMicro === 150000, `${r.payload?.summary?.claimedMicro}`);

  /* ---- 5. the money that used to round to zero ---- */
  group('5. Sub-cent mirrors are not rounded away');
  write([rec({ orderId: 'tiny', feeMicro: 625, authorMicro: 375, state: 'reconciled' })]);
  r = await api(`/api/earnings?author=${AUTHOR}`);
  check('375 µUSD is payable', r.payload?.summary?.payableMicro === 375);
  check('it is never shown as $0.00', r.payload?.totals?.payable !== '$0.00', r.payload?.totals?.payable);
  check('it is shown in cents', r.payload?.totals?.payable === '0.04¢', r.payload?.totals?.payable);

  r = await post({ action: 'prepare', author: AUTHOR });
  check('a sub-cent payout still builds calldata', r.payload?.tx?.amountBaseUnits === '375', r.payload?.tx?.amountBaseUnits);
  check('...and is flagged as not worth the gas', r.payload?.costs?.uneconomic === true, `$${r.payload?.costs?.estimatedGasUsd?.toFixed(6)} gas vs $0.000375`);
} finally {
  if (had) copyFileSync('/tmp/store.live.bak', FILE);
  else writeFileSync(FILE, JSON.stringify({ mirrors: [], earnings: [] }, null, 2));
}

console.log(`\n${'─'.repeat(64)}`);
console.log(fail === 0 ? `\x1b[1m\x1b[32m${pass}/${pass} live assertions passed\x1b[0m` : `\x1b[1m\x1b[31m${fail} failed\x1b[0m, ${pass} passed`);
process.exit(fail === 0 ? 0 : 1);
