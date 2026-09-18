#!/usr/bin/env node
/**
 * Push the local mirror ledger into Upstash Redis.
 *
 * WHY THIS EXISTS
 * `.data/` is gitignored, and a serverless host cannot write to its own
 * filesystem. So the moment you deploy, the ledger starts EMPTY - and an empty
 * ledger means a judge clicking your link sees no mirrors, no compliance
 * readout, no revenue and no board. The real order is still on Base; only the
 * index that points at it is missing.
 *
 * `store.ts` supports Upstash already (SET/GET on the `nightdesk:mirrors`
 * key), so moving the ledger is one command rather than a rebuild.
 *
 * USAGE
 *   UPSTASH_REDIS_REST_URL=... UPSTASH_REDIS_REST_TOKEN=... node scripts/seed-ledger.mjs
 *   ... node scripts/seed-ledger.mjs --file .data/store.json --dry
 *
 * It never deletes: mirrors already in Redis are merged with the local ones,
 * keyed on orderId, and the union is written back. Earnings rows are kept
 * whole - they are an obligation, not a cache.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const LEDGER_KEY = 'nightdesk:mirrors';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const next = process.argv[i + 1];
  return next && !next.startsWith('--') ? next : true;
}

const dry = Boolean(arg('dry', false));
const file = String(arg('file', path.join(process.cwd(), '.data', 'store.json')));

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

function die(message) {
  console.error(`\n  ✗ ${message}\n`);
  process.exit(1);
}

async function command(parts) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(parts),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) die(`Upstash responded ${response.status} ${response.statusText}`);
  const payload = await response.json();
  if (payload.error) die(`Upstash error: ${payload.error}`);
  return payload.result ?? null;
}

const shape = value => ({
  mirrors: Array.isArray(value?.mirrors) ? value.mirrors : [],
  earnings: Array.isArray(value?.earnings) ? value.earnings : [],
});

async function main() {
  console.log('\n  Night Desk - seed the durable ledger\n');

  let local;
  try {
    local = shape(JSON.parse(await fs.readFile(file, 'utf8')));
  } catch (error) {
    die(`could not read ${file} - ${error.message}`);
  }

  console.log(`  local  ${local.mirrors.length} mirror(s), ${local.earnings.length} earnings row(s)`);
  for (const m of local.mirrors) {
    console.log(
      `         ${m.symbol ?? '?'} · funder ${String(m.funder ?? '').slice(0, 10)}… · ` +
        `order ${String(m.orderId ?? '').slice(0, 8)}…`,
    );
  }

  if (!url || !token) {
    console.log('\n  ! UPSTASH_REDIS_REST_URL / _TOKEN are not set.');
    console.log('    Nothing was written. Create a free database at https://console.upstash.com,');
    console.log('    then re-run with both variables.\n');
    process.exit(1);
  }

  const host = url.replace(/^https?:\/\//, '').split('/')[0];
  console.log(`\n  remote ${host}`);

  let remote = shape(null);
  try {
    const raw = await command(['GET', LEDGER_KEY]);
    if (raw) remote = shape(JSON.parse(raw));
    console.log(`         ${remote.mirrors.length} mirror(s), ${remote.earnings.length} earnings row(s)`);
  } catch (error) {
    die(`could not read the remote ledger - ${error.message}`);
  }

  // Union on orderId. Redis wins on conflict: it may hold a mirror this
  // machine never saw (a judge trying the flow, or the deployed app).
  const byOrder = new Map();
  for (const m of local.mirrors) if (m?.orderId) byOrder.set(m.orderId, m);
  for (const m of remote.mirrors) if (m?.orderId) byOrder.set(m.orderId, m);
  const mirrors = [...byOrder.values()].sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));

  const earningsByKey = new Map();
  for (const e of local.earnings) if (e) earningsByKey.set(`${e.orderId}:${e.author}:${e.state}`, e);
  for (const e of remote.earnings) if (e) earningsByKey.set(`${e.orderId}:${e.author}:${e.state}`, e);

  const merged = { mirrors, earnings: [...earningsByKey.values()] };

  console.log(`\n  merged ${merged.mirrors.length} mirror(s), ${merged.earnings.length} earnings row(s)`);
  const added = merged.mirrors.length - remote.mirrors.length;
  if (added > 0) console.log(`         +${added} mirror(s) the deployed app did not have`);
  else if (added === 0) console.log('         already up to date');

  if (dry) {
    console.log('\n  --dry: nothing written. Drop the flag to push.\n');
    return;
  }

  await command(['SET', LEDGER_KEY, JSON.stringify(merged)]);

  const verify = shape(JSON.parse((await command(['GET', LEDGER_KEY])) ?? 'null'));
  if (verify.mirrors.length !== merged.mirrors.length) {
    die(`wrote ${merged.mirrors.length} mirrors but read back ${verify.mirrors.length}`);
  }

  console.log('\n  ✓ ledger is durable - the deployed app will show every mirror above');
  console.log('    set UPSTASH_REDIS_REST_URL and _TOKEN on the host too, or it will');
  console.log('    read an empty ledger and look like it never ran.\n');
}

main().catch(error => die(error?.message ?? String(error)));
