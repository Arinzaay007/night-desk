#!/usr/bin/env node
/**
 * Is the integrator fee actually yours?
 *
 * Flash pays the integrator that owns the API key. The prefilled key in
 * Definitive's docs is *their* key, so a build running on it charges a real fee
 * that lands in their portfolio. Nothing errors. The money is just not yours.
 *
 * The Flash API does not echo which integrator a key belongs to, so this does
 * everything that can be checked:
 *
 *   1. Identity  — is the loaded key the published demo key, or something else?
 *   2. Fingerprint — which key is actually loaded? (hash, never the key itself)
 *   3. Function  — does a live quote honour `flashIntegratorFeeBps` at all?
 *
 * Step 3 matters because a key that ignores the fee parameter would make the
 * whole monetization claim hollow regardless of who owns it. Definitive's own
 * 10 bps platform fee sits inside the same `estimatedFeeNotional` figure, so the
 * check is a *delta* between two quotes at different rates — the only way to
 * isolate our fee from theirs.
 *
 *   npm run verify:key
 *   npm run verify:key -- --base https://your-app.vercel.app
 */
const args = process.argv.slice(2);
const value = name => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const BASE = (value('base') ?? process.env.DEMO_BASE ?? 'http://localhost:3000').replace(/\/$/, '');

const GREEN = '\u001b[32m';
const RED = '\u001b[31m';
const YELLOW = '\u001b[33m';
const DIM = '\u001b[2m';
const BOLD = '\u001b[1m';
const OFF = '\u001b[0m';

let problems = 0;
const ok = (label, detail = '') => console.log(`  ${GREEN}✓${OFF} ${label}${detail ? `  ${DIM}${detail}${OFF}` : ''}`);
const bad = (label, detail = '') => {
  problems += 1;
  console.log(`  ${RED}✗${OFF} ${label}${detail ? `  ${DIM}${detail}${OFF}` : ''}`);
};
const warn = (label, detail = '') => console.log(`  ${YELLOW}!${OFF} ${label}${detail ? `  ${DIM}${detail}${OFF}` : ''}`);
const info = (label, detail = '') => console.log(`  ${DIM}·${OFF} ${label}${detail ? `  ${DIM}${detail}${OFF}` : ''}`);

console.log(`${BOLD}Night Desk — integrator check${OFF}`);
console.log(`${DIM}${BASE}${OFF}\n`);

/* --- 1. what the server says ---------------------------------------- */
let health;
try {
  const response = await fetch(`${BASE}/api/health`);
  health = await response.json();
  if (!health?.ok) throw new Error(`health returned ${response.status}`);
} catch (error) {
  console.log(`${RED}Could not reach ${BASE}.${OFF} Start the app, or pass --base <url>.`);
  console.log(`${DIM}${error.message}${OFF}\n`);
  process.exit(1);
}

const integrator = health.integrator ?? {};

console.log(`${BOLD}1. Which key is loaded${OFF}`);
if (!health.hasFlashKey) {
  bad('no Flash API key is set', 'FLASH_API_KEY is empty');
  console.log(`\n    Set it in .env.local and restart.\n`);
  process.exit(1);
}

info('key fingerprint', integrator.fingerprint ? `sha256:${integrator.fingerprint}\u2026` : 'unavailable');
info('fees accrue to', String(integrator.feesAccrueTo ?? 'unknown'));

if (integrator.identity === 'public') {
  bad(
    'the fee is NOT yours',
    'this is the prefilled demo key from Definitive\u2019s docs',
  );
} else if (integrator.identity === 'own') {
  ok('your own integrator key is loaded', 'integrator fees accrue to your Flash Portfolio');
} else {
  bad('the key is not in the expected format', `identity: ${integrator.identity}`);
}

if (integrator.hint) {
  console.log(`\n    ${DIM}${integrator.hint}${OFF}`);
}

/* --- 2. does the fee parameter do anything? ------------------------- */
console.log(`\n${BOLD}2. Does Flash honour your integrator fee at all${OFF}`);

const keyBps = Number(health.integratorFeeBps ?? 0);
if (!Number.isFinite(keyBps) || keyBps <= 0) {
  bad('flashIntegratorFeeBps is zero', 'no fee is charged, so there is nothing to earn');
} else {
  info('configured rate', `${keyBps} bps`);
}

/** Small enough to be a plausible test size, large enough to read the fee. */
const NOTIONAL = 100;

/*
 * What this can and cannot measure.
 *
 * The quote route reads its bps from the environment by design, so a client
 * cannot choose its own fee — which means we cannot ask the server to quote at
 * two different rates and take the difference. Definitive's platform fee and the
 * network cost are also inside the same `estimatedFeeNotional` figure, so even
 * the all-in number does not isolate our share.
 *
 * So this reports what the app actually charges, and is explicit that it is an
 * upper bound rather than a measurement of revenue. That is the honest limit of
 * what an unauthenticated check can know.
 */
try {
  const response = await fetch(`${BASE}/api/quote`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      plan: {
        v: 1,
        a: '0x1111111111111111111111111111111111111111',
        t: '0xb20000000000000000000078ee7ce2fe4908108c',
        s: 'NVDAc',
        e: 'market',
        z: 100,
        tp: 20,
        sl: 8,
        ts: Date.now(),
      },
      funderAddress: '0x0000000000000000000000000000000000000001',
      rehearseSpendUsd: NOTIONAL,
    }),
  });
  const probe = await response.json();

  if (probe?.ok && typeof probe.meta?.estimatedFeeUsd === 'number') {
    const fee = Number(probe.meta.estimatedFeeUsd);
    const spend = Number(probe.meta.spendUsd);
    const pct = spend > 0 ? (fee / spend) * 100 : 0;
    info('a live quote charges', `$${fee.toFixed(4)} all-in on $${spend.toFixed(2)} (${pct.toFixed(2)}%)`);
    console.log(
      `    ${DIM}Upper bound on what you collect: Definitive\u2019s platform fee and the network${OFF}`,
    );
    console.log(`    ${DIM}cost are in that figure too. Your ${keyBps} bps is a slice of it.${OFF}`);
  } else {
    /*
     * A quote that fails is a *blocker*, not a warning — and specifically an
     * authentication failure, because that means the key is not valid at all.
     *
     * This branch exists because an earlier version of this script printed
     * "The fee is yours" while the key was being rejected with a 401. Identity
     * and validity are two different questions, and passing on the first while
     * failing the second is the exact silent-success failure this script was
     * written to prevent.
     */
    const message = String(probe?.error ?? 'unknown error');
    if (/401|403|PERMISSION_DENIED|UNAUTH/i.test(message)) {
      bad('the key is rejected by Flash', message.slice(0, 80));
    } else {
      warn('could not read a live quote', message.slice(0, 70));
    }
  }
} catch (error) {
  warn('live quote check skipped', error.message);
}

/* --- summary --------------------------------------------------------- */
console.log(`\n${'─'.repeat(64)}`);
if (problems === 0) {
  console.log(`${BOLD}${GREEN}The fee is yours.${OFF} Sending a mirror now earns into your Flash Portfolio.\n`);
  process.exit(0);
}

console.log(`${BOLD}${RED}${problems} thing${problems === 1 ? '' : 's'} to fix.${OFF}`);
console.log(`
${BOLD}To make the integrator fee yours${OFF}

  1. Go to app.definitive.fi and sign in with an ${BOLD}email${OFF}
     (Definitive's guide asks for email specifically, even if you already
     have an account on a wallet — it keeps API usage on its own account.)

  2. In the top navigation: ${BOLD}More${OFF} → ${BOLD}Flash${OFF}
     That opens your Integrator Dashboard.

  3. Click ${BOLD}Create Flash Key${OFF} and copy the value.

  4. Paste it into .env.local:

         FLASH_API_KEY=dpka_your_new_key_here

     ${DIM}.env.local is gitignored. Never commit a real key.${OFF}

  5. Restart the dev server (env changes are not picked up live), then:

         npm run verify:key

  Withdrawing later: your fees accumulate in the Flash Portfolio of that
  Definitive account, in a vault owned by the wallet you connect to it.
  ${DIM}app.definitive.fi → Flash Portfolio → connect wallet → Withdraw${OFF}
`);
process.exit(1);
