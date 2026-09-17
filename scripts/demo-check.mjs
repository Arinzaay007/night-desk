#!/usr/bin/env node
/**
 * Recording-day readiness.
 *
 * `preflight` proves the code works. `test-flow` proves the mirror flow works.
 * This asks a different question: *is this machine, right now, ready to hit
 * record?* Every check here is something that would otherwise be discovered
 * live, on camera, with the clock running.
 *
 *   npm run demo:check                                  # as configured
 *   npm run demo:check -- --armed                       # assert dry run is OFF
 *   npm run demo:check -- --wallets 0xA...,0xB...       # funding for both wallets
 *   npm run demo:check -- --plan <id-or-url>            # the link you will open on camera
 *
 * Exits 1 if anything would block a recording.
 */
const BASE = (process.env.DEMO_BASE ?? 'http://localhost:3000').replace(/\/$/, '');

const GREEN = '\u001b[32m';
const RED = '\u001b[31m';
const YELLOW = '\u001b[33m';
const DIM = '\u001b[2m';
const BOLD = '\u001b[1m';
const OFF = '\u001b[0m';

const args = process.argv.slice(2);
const flag = name => args.includes(`--${name}`);
const value = name => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const wallets = (value('wallets') ?? '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const planArg = value('plan');

let blockers = 0;
let warnings = 0;

const section = name => console.log(`\n${BOLD}${name}${OFF}`);
const pass = (label, detail = '') => console.log(`  ${GREEN}✓${OFF} ${label}${detail ? `  ${DIM}${detail}${OFF}` : ''}`);
const block = (label, detail = '') => {
  blockers += 1;
  console.log(`  ${RED}✗${OFF} ${label}${detail ? `  ${DIM}${detail}${OFF}` : ''}`);
};
const warn = (label, detail = '') => {
  warnings += 1;
  console.log(`  ${YELLOW}!${OFF} ${label}${detail ? `  ${DIM}${detail}${OFF}` : ''}`);
};
const info = (label, detail = '') => console.log(`  ${DIM}·${OFF} ${label}${detail ? `  ${DIM}${detail}${OFF}` : ''}`);

const api = async (pathname, init) => {
  const response = await fetch(BASE + pathname, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  let payload = {};
  try {
    payload = await response.json();
  } catch {
    /* non-JSON */
  }
  return { status: response.status, payload, headers: response.headers };
};

const timed = async fn => {
  const started = Date.now();
  const result = await fn();
  return { result, ms: Date.now() - started };
};

/* ------------------------------------------------------------------ */
console.log(`${BOLD}Night Desk — recording readiness${OFF}`);
console.log(`${DIM}${BASE}${OFF}`);

/* Deadline. Lagos is UTC+1, so the 4pm EDT deadline is 9pm local. */
const DEADLINE = new Date('2026-09-19T21:00:00+01:00');
const hoursLeft = (DEADLINE.getTime() - Date.now()) / 36e5;
if (hoursLeft > 0) {
  console.log(
    `${DIM}Deadline: Sat 19 Sep, 9:00pm Lagos — in ${Math.floor(hoursLeft)}h ${Math.round((hoursLeft % 1) * 60)}m.${OFF}`,
  );
} else {
  console.log(`${RED}Deadline has passed.${OFF}`);
}

let health;
try {
  const probe = await api('/api/health');
  if (!probe.payload?.ok) throw new Error(`health returned ${probe.status}`);
  health = probe.payload;
} catch (error) {
  console.log(`\n${RED}${BOLD}The server is not answering at ${BASE}.${OFF}`);
  console.log(`${DIM}${error.message}${OFF}`);
  console.log(`\nStart it with:  npm run dev\n`);
  process.exit(1);
}

/* --- 1. mode ------------------------------------------------------- */
section('1. The app is in the mode you think it is');

const dry = health.dryRun === true;
if (flag('armed')) {
  if (dry) {
    block(
      'dry run is ON but you asked for an armed recording',
      'set NEXT_PUBLIC_DRY_RUN=0 in .env.local and restart the dev server',
    );
  } else {
    pass('orders are armed', 'a real mirror will reach the exchange');
  }
} else if (dry) {
  info('rehearsing', 'dry run is on — nothing can reach the exchange');
  info('to record for real', 'set NEXT_PUBLIC_DRY_RUN=0 and restart, then run with --armed');
} else {
  pass('orders are armed');
}

/* --- 2. revenue ---------------------------------------------------- */
section('2. The integrator fee reaches your org, not somebody else\u2019s');

{
  const integrator = health.integrator ?? {};
  if (integrator.fingerprint) {
    info('key fingerprint', `sha256:${integrator.fingerprint}\u2026`);
  }
  info('fees accrue to', String(integrator.feesAccrueTo ?? 'unknown'));

  if (integrator.identity === 'public' || health.usingPublicFlashKey) {
    block(
      'you are trading on the public key from Definitive\u2019s docs',
      'integrator fees on your mirrors accrue to the demo integrator, not to you',
    );
    console.log(
      `    ${DIM}Fix: app.definitive.fi → sign in with an email → More → Flash → Create Flash Key.${OFF}`,
    );
    console.log(`    ${DIM}Then: FLASH_API_KEY=<new key> in .env.local, restart, and run npm run verify:key.${OFF}`);
  } else if (integrator.identity === 'own') {
    pass('your own Flash key is loaded', 'integrator fees accrue to your Flash Portfolio');
  } else {
    block('the Flash key is missing or malformed', `identity: ${integrator.identity ?? 'unknown'}`);
  }
}

const bps = Number(health.integratorFeeBps);
if (Number.isFinite(bps) && bps > 0) {
  pass('flashIntegratorFeeBps is set', `${bps} bps`);
} else {
  block('integrator fee is zero', 'the track asks for a monetised build');
}

if (health.attribution === 'not set') {
  info('no ERC-8021 attribution code', 'optional, and only useful if you have one to register');
} else {
  info('attribution code present', health.attribution);
}

/* --- 3. the board survives judging --------------------------------- */
section('3. The board will still be there when a judge clicks your link');

if (health.store?.durable === true) {
  pass('the ledger is durable', `backend: ${health.store.backend}`);
} else {
  warn(
    'the ledger is not durable',
    `backend: ${health.store?.backend}`,
  );
  console.log(
    `    ${DIM}${health.store?.hint ?? ''}${OFF}`,
  );
  console.log(
    `    ${DIM}If you submit a deployed link, the board empties on the next redeploy. Set${OFF}`,
  );
  console.log(
    `    ${DIM}UPSTASH_REDIS_REST_URL and _TOKEN before deploying, or accept an empty board.${OFF}`,
  );
}

/* --- 4. funding ----------------------------------------------------- */
section('4. The wallets can actually trade');

if (!wallets.length) {
  info('no wallets given', 'pass --wallets 0xA...,0xB... to check funding and gas');
} else {
  for (const address of wallets) {
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      block(`${address} is not a valid address`);
      continue;
    }
    try {
      const { payload } = await api(`/api/balance?address=${address}`);
      if (!payload.ok) {
        block(`${address.slice(0, 10)}… could not be read`, payload.error ?? '');
        continue;
      }
      const usdc = Number(payload.usdc ?? 0);
      const eth = Number(payload.eth ?? 0);
      const label = `${address.slice(0, 8)}…${address.slice(-4)}`;

      if (usdc >= 2) {
        pass(`${label} holds enough USDC`, `$${usdc.toFixed(2)}`);
      } else if (usdc > 0) {
        warn(`${label} holds ${usdc.toFixed(2)} USDC`, 'enough for Rung 1, thin for a two-wallet demo');
      } else {
        block(`${label} holds no USDC`, 'a mirror cannot be funded from an empty wallet');
      }

      if (eth >= 0.0002) {
        pass(`${label} has gas`, `${eth.toFixed(6)} ETH`);
      } else if (eth > 0) {
        warn(`${label} has ${eth.toFixed(6)} ETH`, 'two approvals may not fit; top up before recording');
      } else {
        block(`${label} has no ETH`, 'approvals are onchain and need gas on Base');
      }
    } catch (error) {
      block(`${address.slice(0, 10)}… could not be read`, error.message);
    }
  }
}

/* --- 5. upstream latency -------------------------------------------- */
section('5. How long the on-camera wait will actually be');

try {
  const { ms } = await timed(() => api('/api/assets'));
  if (ms < 3000) {
    pass('market data is responsive', `${ms} ms for all seven equities`);
  } else if (ms < 8000) {
    warn('market data is slow', `${ms} ms — expect a visible pause after a click`);
  } else {
    warn('market data is very slow', `${ms} ms — rehearse the pause on camera`);
  }
} catch (error) {
  warn('could not time market data', error.message);
}

if (dry) {
  try {
    const { ms, result } = await timed(() =>
      api('/api/quote', {
        method: 'POST',
        body: JSON.stringify({
          plan: {
            v: 1,
            a: '0x1111111111111111111111111111111111111111',
            t: '0xb20000000000000000000078ee7ce2fe4908108c',
            s: 'NVDAc',
            e: 'market',
            z: 20,
            tp: 8,
            sl: 5,
            ts: Date.now(),
          },
          funderAddress: wallets[0] ?? '0x0000000000000000000000000000000000000001',
          rehearseSpendUsd: 1,
        }),
      }),
    );
    if (result.payload?.ok) {
      /*
       * Measured, not assumed. The wait varies with upstream conditions — this
       * deployment has been seen anywhere from 2.8s to 10.3s for the same call
       * — so the advice has to follow the number rather than a remembered range.
       */
      if (ms < 3000) {
        pass('a live quote takes', `${ms} ms — brisk, easy to narrate`);
      } else if (ms < 8000) {
        warn('a live quote takes', `${ms} ms — a visible pause after the click`);
      } else {
        warn(
          'a live quote takes',
          `${ms} ms — long enough that a viewer wonders if it is broken`,
        );
      }
      console.log(
        `    ${DIM}Whatever it is, the step list on screen is what the viewer watches during the wait.${OFF}`,
      );
      console.log(
        `    ${DIM}Do not cut it and do not narrate over silence — say what it is waiting for. The${OFF}`,
      );
      console.log(
        `    ${DIM}client gives up at 15s and retries a stalled quote once, then says so plainly.${OFF}`,
      );
      if (ms > 8000) {
        console.log(
          `    ${DIM}At ${ms} ms you are near that ceiling: press Preview levels once before recording${OFF}`,
        );
        console.log(`    ${DIM}so the first pause on camera is not the first one you have seen.${OFF}`);
      }
    } else {
      info('quote latency not measured', result.payload?.error ?? `HTTP ${result.status}`);
    }
  } catch (error) {
    info('quote latency not measured', error.message);
  }
}

/* --- 6. the link you will put on camera ----------------------------- */
section('6. The link on camera');

if (!planArg) {
  info('no plan given', 'pass --plan <id-or-url> to check the exact link you will open');
} else {
  const id = planArg.includes('/p/') ? planArg.split('/p/')[1].split(/[?#]/)[0] : planArg;
  try {
    const response = await fetch(`${BASE}/p/${id}`);
    const html = await response.text();
    const readable = !html.includes('not readable');
    if (response.status === 200 && readable) {
      pass('the plan link opens', `${id.length} char id`);
      const asset = /NVDAc|METAc|GOOGLc|AAPLc|TSLAc|AMZNc|MSFTc/.exec(html);
      if (asset) info('asset on the page', asset[0]);
      if (html.includes('Mirror it')) pass('the mirror panel is there');
      if (!dry && html.includes('rehearse at')) {
        warn('the rehearsal control is visible while armed', 'expected — it should not be');
      }
    } else {
      block('the plan link does not open', `HTTP ${response.status}`);
    }
  } catch (error) {
    block('the plan link could not be fetched', error.message);
  }

  const { payload } = await api('/api/plans');
  const count = payload.plans?.length ?? 0;
  if (count === 0) {
    pass('the board is empty', 'your demo starts from a clean board');
  } else {
    info('the board already has content', `${count} plan(s) — fine, just know what is on it`);
    for (const row of payload.plans ?? []) {
      info(`  ${row.symbol}`, `${row.mirrors} wallet(s), $${row.notional} in`);
    }
  }
}

/* --- summary -------------------------------------------------------- */
console.log(`\n${'─'.repeat(64)}`);
if (blockers === 0 && warnings === 0) {
  console.log(`${BOLD}${GREEN}Ready to record.${OFF} Nothing standing in the way.\n`);
  process.exit(0);
} else if (blockers === 0) {
  console.log(`${BOLD}${YELLOW}${warnings} warning${warnings === 1 ? '' : 's'}${OFF} — recordable, but read them first.\n`);
  process.exit(0);
} else {
  console.log(`${BOLD}${RED}${blockers} blocker${blockers === 1 ? '' : 's'}${OFF}${warnings ? `, ${warnings} warning${warnings === 1 ? '' : 's'}` : ''}.`);
  console.log('Fix the ✗ items before you hit record.\n');
  process.exit(1);
}
