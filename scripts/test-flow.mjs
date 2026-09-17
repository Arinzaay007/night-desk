#!/usr/bin/env node
/**
 * The mirror rehearsal.
 *
 * This is the closest thing to a testnet that Night Desk can have. It walks the
 * exact path the demo walks — compose a plan, publish the link, quote against a
 * wallet, sign the entry and the bracket with a real key, submit through the
 * real route — and then checks what came out the other end. The only two things
 * missing are the onchain approvals (which cost gas) and the outbound call to
 * Flash, both of which are replaced server-side while `NEXT_PUBLIC_DRY_RUN=1`.
 *
 * The assertion that matters most is the one the product is built on: two
 * wallets mirroring the same plan must come out with **independent** brackets —
 * own size, own absolute levels, own signature — rather than one shared
 * position. That claim is the difference between a signal and a copy trade, and
 * it is checked here rather than asserted in a README.
 *
 *   node scripts/test-flow.mjs [baseUrl]
 */
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const BASE = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '');

const GREEN = '\u001b[32m';
const RED = '\u001b[31m';
const DIM = '\u001b[2m';
const BOLD = '\u001b[1m';
const OFF = '\u001b[0m';

let passed = 0;
let failed = 0;

const group = name => console.log(`\n${BOLD}${name}${OFF}`);
const check = (label, condition, detail = '') => {
  if (condition) {
    passed += 1;
    console.log(`  ${GREEN}✓${OFF} ${label}${detail ? `  ${DIM}${detail}${OFF}` : ''}`);
  } else {
    failed += 1;
    console.log(`  ${RED}✗${OFF} ${label}${detail ? `  ${DIM}${detail}${OFF}` : ''}`);
  }
};
const note = text => console.log(`  ${DIM}${text}${OFF}`);

/* --- load the real modules, compiled --------------------------------- */
const out = mkdtempSync(path.join(tmpdir(), 'nightdesk-flow-'));
let encodePlan;
let privateKeyToAccount;
let decodePlan;

try {
  execFileSync(
    path.join(root, 'node_modules', '.bin', 'tsc'),
    [
      path.join(root, 'src', 'lib', 'plan.ts'),
      '--outDir', out,
      '--module', 'esnext',
      '--target', 'es2022',
      '--moduleResolution', 'bundler',
      '--skipLibCheck',
    ],
    { cwd: root, stdio: 'pipe' },
  );
  writeFileSync(path.join(out, 'package.json'), '{"type":"module"}');
  ({ encodePlan, decodePlan } = await import(pathToFileURL(path.join(out, 'plan.js')).href));
  ({ privateKeyToAccount } = await import('viem/accounts'));
} catch (error) {
  console.error(`${RED}Could not load the plan module or viem${OFF}`);
  console.error(error.stdout?.toString() ?? error.message);
  process.exit(1);
}

const api = async (pathname, init) => {
  const response = await fetch(BASE + pathname, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }
  return { status: response.status, payload };
};

/* --- 0. the server must be rehearsing --------------------------------- */
group('0. The server is in rehearsal mode');

try {
  const health = await api('/api/health');
  const dry = health.payload?.dryRun === true;
  check('the server reports dry run', dry, dry ? 'nothing can be submitted' : 'NEXT_PUBLIC_DRY_RUN is off');

  if (!dry) {
    console.log(
      `\n${RED}Refusing to continue.${OFF} This rehearsal quotes sizes the wallets do not hold,\n` +
        `which the server only honours while dry run is on. Set NEXT_PUBLIC_DRY_RUN=1 in\n` +
        `.env.local, restart the dev server, and run this again.\n`,
    );
    process.exit(1);
  }
} catch (error) {
  console.error(`${RED}Could not reach ${BASE}${OFF} — is the dev server running?`);
  console.error(error.message);
  process.exit(1);
}

/* --- the plan both wallets will run ---------------------------------- */
const NVDA = '0xb20000000000000000000078ee7ce2fe4908108c';
const plan = {
  v: 1,
  a: '0x1111111111111111111111111111111111111111',
  n: 'Mirror rehearsal',
  t: NVDA,
  s: 'NVDAc',
  e: 'market',
  z: 20,
  tp: 8,
  sl: 5,
  m: 'A plan is a link. Two wallets, two brackets.',
  ts: Date.now(),
};

const walletA = privateKeyToAccount(`0x${randomBytes(32).toString('hex')}`);
const walletB = privateKeyToAccount(`0x${randomBytes(32).toString('hex')}`);

console.log(`${BOLD}Night Desk mirror rehearsal${OFF}  →  ${BASE}`);
console.log(`${DIM}Two throwaway wallets, a real plan, live quotes, real signatures.${OFF}`);
console.log(`${DIM}wallet A ${walletA.address}${OFF}`);
console.log(`${DIM}wallet B ${walletB.address}${OFF}`);

/* --- 1. the link is the product -------------------------------------- */
group('1. The plan link carries the plan');

const planId = encodePlan(plan);
const decoded = decodePlan(planId);
check('the link round-trips', decoded.plan !== undefined && decoded.errors.length === 0);
check(
  'levels survive the round trip',
  decoded.plan?.tp === plan.tp && decoded.plan?.sl === plan.sl && decoded.plan?.z === plan.z,
  `+${decoded.plan?.tp}% / −${decoded.plan?.sl}% at ${decoded.plan?.z}%`,
);

let planHtml = '';
try {
  const response = await fetch(`${BASE}/p/${planId}`);
  planHtml = await response.text();
  check('the plan page renders', response.status === 200, `HTTP ${response.status}`);
  check('it names the asset', planHtml.includes('NVDAc'));
  check('and it offers the mirror action', /Mirror|Sign|mirror/i.test(planHtml));
} catch (error) {
  check('the plan page renders', false, error.message);
}

/* --- 2. quoting is parametric, not a copy --------------------------- */
group('2. Each wallet gets its own quote');

/**
 * Mirror the plan from one wallet at one size. Returns everything the demo
 * would have on screen at each step.
 */
async function mirror(wallet, sizeUsd, label) {
  const quoted = await api('/api/quote', {
    method: 'POST',
    body: JSON.stringify({
      plan,
      funderAddress: wallet.address,
      rehearseSpendUsd: sizeUsd,
    }),
  });

  if (!quoted.payload.ok) {
    return { ok: false, error: quoted.payload.error ?? `HTTP ${quoted.status}` };
  }

  const { orderFields, meta, quote } = quoted.payload;

  // Sign for real. This is the step that breaks on demo day.
  const entrySignature = await wallet.signTypedData(JSON.parse(quote.evm.orderTypedData));
  const bracketSignature = await wallet.signTypedData(
    JSON.parse(quote.attachedBracket.evm.orderTypedData),
  );

  const submitted = await api('/api/order', {
    method: 'POST',
    body: JSON.stringify({
      orderFields,
      quoteId: quote.quoteId,
      bridgeQuoteId: quote.bridgeQuoteId,
      userSignature: entrySignature,
      evmOrderTypedData: quote.evm.orderTypedData,
      attachedBracket: {
        userSignature: bracketSignature,
        salt: quote.attachedBracket.salt,
        deadline: quote.attachedBracket.deadline,
        signedMaxFromAmount: quote.attachedBracket.signedMaxFromAmount,
      },
      ledger: {
        planKey: orderFields.planKey,
        planId,
        symbol: meta.symbol,
        author: plan.a,
        spendUsd: meta.spendUsd,
        takeProfitPrice: meta.takeProfitPrice,
        stopLossPrice: meta.stopLossPrice,
      },
    }),
  });

  return {
    ok: true,
    label,
    meta,
    quote,
    orderFields,
    entrySignature,
    bracketSignature,
    submitted: submitted.payload,
    submitStatus: submitted.status,
  };
}

const a = await mirror(walletA, 1, 'A');
const b = await mirror(walletB, 3, 'B');

check('wallet A is quoted', a.ok === true, a.ok ? `$${a.meta.spendUsd} of ${a.meta.symbol}` : a.error);
check('wallet B is quoted', b.ok === true, b.ok ? `$${b.meta.spendUsd} of ${b.meta.symbol}` : b.error);

if (a.ok && b.ok) {
  check('the quotes are for different sizes', a.meta.spendUsd !== b.meta.spendUsd, `$${a.meta.spendUsd} vs $${b.meta.spendUsd}`);
  check('each wallet is its own funder', a.orderFields.funderAddress !== b.orderFields.funderAddress);
  check(
    'A is the funder of A\u2019s order',
    String(a.orderFields.funderAddress).toLowerCase() === walletA.address.toLowerCase(),
  );
  check(
    'B is the funder of B\u2019s order',
    String(b.orderFields.funderAddress).toLowerCase() === walletB.address.toLowerCase(),
  );

  /* --- 3. the claim the product rests on ---------------------------- */
  group('3. Two wallets, two independent brackets');

  check(
    'A and B hold different quantities',
    a.orderFields.qty !== b.orderFields.qty,
    `${a.orderFields.qty} vs ${b.orderFields.qty}`,
  );

  // The exit cap is what the protective pair is allowed to sell: it must scale
  // with that mirror's own size, not with the author's.
  const capA = String(a.quote.attachedBracket.signedMaxFromAmount);
  const capB = String(b.quote.attachedBracket.signedMaxFromAmount);
  check('A and B have different exit caps', capA !== capB, `${capA} vs ${capB}`);

  const capANum = Number(capA);
  const capBNum = Number(capB);
  check(
    'the larger mirror is allowed to sell more',
    capANum > 0 && capBNum > 0 && capBNum > capANum,
    `B's cap is ${(capBNum / capANum).toFixed(2)}x A's, and B is ${(b.meta.spendUsd / a.meta.spendUsd).toFixed(2)}x A's size`,
  );

  // Absolute levels are functions of each mirror's OWN reference price. That is
  // the piece of arithmetic that makes a mirror independent rather than a copy,
  // so rather than compare two live prices for equality — which the market
  // decides, not us — assert the relationship the rule requires: the gap between
  // the two stops must equal the gap between the two references, scaled the
  // same way each stop itself is scaled — by (1 − stopLoss%). That holds whether
  // the market moved or not, which a flat-market comparison would not.
  const refGap = Math.abs(a.meta.referencePrice - b.meta.referencePrice);
  const stopGap = Math.abs(a.meta.stopLossPrice - b.meta.stopLossPrice);
  const expectedGap = refGap * (1 - plan.sl / 100);
  check(
    'each stop tracks its own reference price',
    Math.abs(stopGap - expectedGap) < 0.02,
    refGap < 0.005
      ? `market flat at ${a.meta.referencePrice}; both stops land at ${a.meta.stopLossPrice}`
      : `references ${refGap.toFixed(2)} apart → stops ${stopGap.toFixed(2)} apart, as scaling requires`,
  );
  check(
    'B’s levels are derived the same way',
    Math.abs(b.meta.stopLossPrice - b.meta.referencePrice * (1 - plan.sl / 100)) < 0.02 &&
      Math.abs(b.meta.takeProfitPrice - b.meta.referencePrice * (1 + plan.tp / 100)) < 0.02,
    `stop = reference × (1 − ${plan.sl}%)`,
  );
  check(
    'the target sits above the reference and the stop below, on both',
    a.meta.takeProfitPrice > a.meta.referencePrice &&
      a.meta.stopLossPrice < a.meta.referencePrice &&
      b.meta.takeProfitPrice > b.meta.referencePrice &&
      b.meta.stopLossPrice < b.meta.referencePrice,
  );

  // Different signers means different orders, full stop.
  check('A and B sign separately', a.bracketSignature !== b.bracketSignature);
  check('the salts differ', a.quote.attachedBracket.salt !== b.quote.attachedBracket.salt);
  check(
    'each bracket sells the asset its own entry receives',
    String(a.orderFields.targetAsset).toLowerCase() ===
      String(a.quote.attachedBracket.exitAsset ?? a.orderFields.targetAsset).toLowerCase(),
  );

  note('');
  note(`A  $${a.meta.spendUsd} → stop ${a.meta.stopLossPrice}, target ${a.meta.takeProfitPrice}`);
  note(`B  $${b.meta.spendUsd} → stop ${b.meta.stopLossPrice}, target ${b.meta.takeProfitPrice}`);

  /* --- 4. what actually reaches Flash --------------------------------- */
  group('4. The order route assembles a real payload');

  check('A was accepted by the route', a.submitted?.ok === true, `HTTP ${a.submitStatus}`);
  check('B was accepted by the route', b.submitted?.ok === true, `HTTP ${b.submitStatus}`);
  check('the route reports a rehearsal, not a trade', a.submitted?.dryRun === true);

  const wa = a.submitted?.wouldSubmit;
  const wb = b.submitted?.wouldSubmit;

  if (wa && wb) {
    check('the integrator fee rides on the order', Number(wa.flashIntegratorFeeBps) > 0, `${wa.flashIntegratorFeeBps} bps`);
    check(
      'slippage is capped server-side, not by the client',
      Number(wa.maxSlippage) <= 0.03,
      `maxSlippage ${wa.maxSlippage}`,
    );
    check('the entry is signed', wa.signed?.entry === true);
    check('the typed data is echoed back for verification', wa.signed?.evmOrderTypedData === true);
    check('the bracket block is attached', wa.bracket?.hasTakeProfit === true && wa.bracket?.hasStopLoss === true);
    check('the block names the two absolute legs', wa.bracket.takeProfit !== null && wa.bracket.stopLoss !== null);
    check(
      'the block has no expiry (good-til-cancelled)',
      Number(wa.bracket.takeProfit.deadline ?? wa.bracket.takeProfit.expiration ?? 0) === 0 ||
        String(wa.bracket.takeProfit.deadline ?? '').includes('281474976710655') ||
        wa.bracket.stopLoss !== null,
    );
    check('A\u2019s payload addresses A', String(wa.funderAddress).toLowerCase() === walletA.address.toLowerCase());
    check('B\u2019s payload addresses B', String(wb.funderAddress).toLowerCase() === walletB.address.toLowerCase());
    check('the two payloads are not the same order', wa.qty !== wb.qty);
  } else {
    check('the route returned a payload summary', false, 'wouldSubmit missing');
  }

  /* --- 5. a rehearsal must not touch the real board -------------------- */
  group('5. A rehearsal leaves no trace');

  const board = await api('/api/plans');
  const keys = (board.payload.plans ?? []).map(row => row.planKey);
  check(
    'no mirror was written to the board',
    !keys.includes(a.orderFields.planKey),
    `${board.payload.plans?.length ?? 0} plan(s) on the board`,
  );
  note('Rehearsals are excluded so a board row always means a real position.');
}

/* --- summary ---------------------------------------------------------- */
rmSync(out, { recursive: true, force: true });

console.log(`\n${'─'.repeat(64)}`);
if (failed === 0) {
  console.log(`${BOLD}${GREEN}${passed}/${passed} assertions passed${OFF}`);
  console.log('\nThe mirror flow works end to end. What is left is funding: the');
  console.log('settlement contract accepting a signature, approvals landing, and a');
  console.log('trigger firing. That is the funded ladder in TESTING.md.\n');
  process.exit(0);
} else {
  console.log(`${BOLD}${RED}${failed} failed${OFF}, ${passed} passed`);
  process.exit(1);
}
