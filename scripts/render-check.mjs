/**
 * Render pages in a real browser and report what a human would see.
 *
 * Everything before this verified markup and API responses. This drives an
 * actual Chromium: it waits for the client-side proof fetches to land, captures
 * the hydrated text, collects console errors, and writes screenshots. The
 * distinction matters because the proof-derived numbers hydrate after paint, so
 * "the page contains $264.34" is not something the server HTML can answer.
 */

import puppeteer from 'puppeteer-core';
import fs from 'node:fs/promises';

/**
 * Point CHROME_PATH at any Chromium/Chrome binary, or install one with:
 *   npx @puppeteer/browsers install chrome-headless-shell@stable --path ./.browsers
 * Requires `npm i -D puppeteer-core` (not a dependency of the app itself).
 */
const EXEC = process.env.CHROME_PATH;
if (!EXEC) {
  console.error('Set CHROME_PATH to a Chromium binary. See the header of this file.');
  process.exit(1);
}
const BASE = process.env.BASE ?? 'http://localhost:3000';
const PLAN = process.env.PLAN_PATH ?? '/';

const PAGES = [
  { name: 'home', path: '/' },
  { name: 'board', path: '/board' },
  { name: 'plan', path: PLAN },
  { name: 'create', path: '/create' },
  { name: 'desk', path: '/desk' },
  { name: 'payouts', path: '/payouts' },
];

const wanted = [
  '264.34',
  '202.66',
  '240.45',
  '100%',
  'ran as published',
  'Mirror it',
  'Copy plan link',
  'open position',
  'reading',
];

const invented = ['28.4K', 'nvda-momentum', '2,246.40', 'nightowl', '317.21', '243.19'];

const SHOTS = process.env.SHOTS_DIR ?? '/tmp/shots';
await fs.mkdir(SHOTS, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: EXEC,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-device-scale-factor=1'],
});

let totalErrors = 0;

for (const page of PAGES) {
  const tab = await browser.newPage();
  await tab.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });

  const errors = [];
  tab.on('console', m => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 200));
  });
  tab.on('pageerror', e => errors.push(`PAGEERROR ${e.message}`.slice(0, 200)));

  let status = 0;
  try {
    const res = await tab.goto(`${BASE}${page.path}`, {
      waitUntil: 'networkidle2',
      timeout: 60_000,
    });
    status = res?.status() ?? 0;
  } catch (e) {
    errors.push(`NAV ${e.message}`.slice(0, 200));
  }

  // Give the client-side proof reads a moment to settle.
  await new Promise(r => setTimeout(r, 2500));

  const text = await tab.evaluate(() => document.body.innerText);
  await tab.screenshot({ path: `${SHOTS}/${page.name}.png`, fullPage: false });

  const found = wanted.filter(w => text.includes(w));
  const bad = invented.filter(w => text.includes(w));
  // A literal escape (e.g. "\u2026") is a bug that only shows up at render time.
  const escapes = (text.match(/\\u[0-9a-fA-F]{4}/g) ?? []).slice(0, 3);

  totalErrors += errors.length;

  console.log(`\n  ── ${page.name}  (${page.path})  HTTP ${status}`);
  console.log(`     chars rendered : ${text.length}`);
  console.log(`     expected found : ${found.length}/${wanted.length}  ${found.length === wanted.length ? '' : '→ missing: ' + wanted.filter(w => !found.includes(w)).join(', ')}`);
  console.log(`     invented found : ${bad.length === 0 ? '✓ none' : '✗ ' + bad.join(', ')}`);
  if (escapes.length) console.log(`     literal escapes: ✗ ${escapes.join(', ')}`);
  if (errors.length) {
    console.log(`     console errors : ${errors.length}`);
    for (const e of errors.slice(0, 4)) console.log(`       · ${e}`);
  } else {
    console.log(`     console errors : ✓ none`);
  }

  await tab.close();
}

await browser.close();
console.log(`\n  screenshots → ${SHOTS}/*.png`);
console.log(`  total console errors across all pages: ${totalErrors}\n`);
