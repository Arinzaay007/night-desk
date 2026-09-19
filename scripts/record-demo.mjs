/**
 * Record a real screen capture of the deployed app.
 *
 * This drives the LIVE site in a real Chromium and captures the frames the
 * browser actually paints, via the CDP screencast. Nothing here is a mockup or
 * a re-render: if the page is broken, the video is broken.
 *
 * Frames land in FRAMES_DIR as 0001.jpg, 0002.jpg… with a matching timings.json
 * holding the wall-clock offset of each frame. build-video.mjs turns that into
 * an MP4 at true speed — frames are held for the interval they were on screen,
 * so the video does not drift from what the narration timings assume.
 */

import puppeteer from 'puppeteer-core';
import fs from 'node:fs/promises';

const EXEC = process.env.CHROME_PATH;
if (!EXEC) {
  console.error('Set CHROME_PATH to a Chromium binary.');
  process.exit(1);
}

const BASE = process.env.BASE ?? 'https://night-desk-swart.vercel.app';
const PLAN = process.env.PLAN_PATH ?? '/';
const FRAMES = process.env.FRAMES_DIR ?? '/tmp/frames';
const W = 1440;
const H = 900;

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Eased scroll, so the capture reads as a camera move rather than a jump. */
async function scrollTo(page, y, ms) {
  await page.evaluate(
    async (y, ms) => {
      const start = window.scrollY;
      const delta = y - start;
      if (Math.abs(delta) < 2) return;
      const t0 = performance.now();
      await new Promise(resolve => {
        function step() {
          const t = Math.min(1, (performance.now() - t0) / ms);
          const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
          window.scrollTo(0, start + delta * eased);
          if (t < 1) requestAnimationFrame(step);
          else resolve();
        }
        requestAnimationFrame(step);
      });
    },
    y,
    ms,
  );
}

/** Scroll so that a text fragment sits in the middle of the frame. */
async function scrollToText(page, needle, ms, offset = -0.32) {
  const y = await page.evaluate(
    (needle, offset) => {
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walk.nextNode())) {
        if (node.textContent && node.textContent.includes(needle)) {
          const el = node.parentElement;
          if (!el) continue;
          const top = el.getBoundingClientRect().top + window.scrollY;
          return Math.max(0, top + window.innerHeight * offset);
        }
      }
      return null;
    },
    needle,
    offset,
  );
  if (y === null) {
    console.warn(`  ! could not find text: ${needle.slice(0, 42)}`);
    return false;
  }
  await scrollTo(page, y, ms);
  return true;
}

async function main() {
  await fs.rm(FRAMES, { recursive: true, force: true });
  await fs.mkdir(FRAMES, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: EXEC,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars', '--force-device-scale-factor=1'],
    defaultViewport: { width: W, height: H },
  });

  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });

  const cdp = await page.createCDPSession();
  const frames = [];
  let capture = true;

  cdp.on('Page.screencastFrame', async ev => {
    const t = Date.now() - t0;
    if (capture) {
      const name = String(frames.length + 1).padStart(4, '0');
      await fs.writeFile(`${FRAMES}/${name}.jpg`, Buffer.from(ev.data, 'base64'));
      frames.push({ file: `${name}.jpg`, t });
    }
    try {
      await cdp.send('Page.screencastFrameAck', { sessionId: ev.sessionId });
    } catch {
      /* frame arrived after teardown */
    }
  });

  await cdp.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 88,
    maxWidth: W,
    maxHeight: H,
    everyNthFrame: 1,
  });

  const t0 = Date.now();
  const at = async (targetMs, fn) => {
    const wait = targetMs - (Date.now() - t0);
    if (wait > 0) await sleep(wait);
    if (fn) await fn();
  };

  console.log(`  recording ${BASE} → ${FRAMES}`);

  // ---- S1 · 0:00–0:10 · home hero ----
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 90_000 });
  await sleep(2500);
  await at(3000, () => scrollTo(page, 260, 2600));
  await at(7000, () => scrollTo(page, 120, 1800));

  // ---- S2 · 0:10–0:24 · the plan link ----
  await at(10_000, async () => {
    await page.goto(BASE + PLAN, { waitUntil: 'networkidle2', timeout: 90_000 });
  });
  await sleep(2000);
  await at(14_000, () => scrollTo(page, 180, 2200));
  await at(19_000, () => scrollTo(page, 60, 1800));

  // ---- S3 · 0:24–0:37 · level strip + risk band ----
  await at(24_000, () => scrollToText(page, 'TAKE-PROFIT', 2600, -0.24));
  await at(33_000, () => scrollTo(page, 0, 0)); // hold

  // ---- S4 · 0:37–0:49 · mirror panel ----
  await at(37_000, () => scrollToText(page, 'Mirror it', 2400, -0.1));

  // ---- S5 · 0:49–1:07 · compliance readout ----
  await at(49_000, () => scrollToText(page, 'actually run it?', 2600, -0.22));
  await at(58_000, () => scrollToText(page, 'PER FUNDER', 2200, -0.3));

  // ---- S6 · 1:07–1:44 · how the author earns ----
  await at(67_000, () => scrollToText(page, 'actually earns', 2800, -0.18));
  await at(80_000, () => scrollToText(page, 'Nobody has run this plan yet', 2200, -0.34));
  await at(92_000, () => scrollToText(page, 'nothing is withdrawable', 2200, -0.34));

  // ---- S7 · 1:44–1:55 · the board ----
  await at(104_000, async () => {
    await page.goto(BASE + '/board', { waitUntil: 'networkidle2', timeout: 90_000 });
  });
  await sleep(2200);
  await at(108_000, () => scrollToText(page, 'every published plan', 2400, -0.3));
  await at(114_000, null);

  capture = false;
  await cdp.send('Page.stopScreencast').catch(() => undefined);
  await browser.close();

  await fs.writeFile(`${FRAMES}/timings.json`, JSON.stringify(frames, null, 1));
  const secs = ((frames.at(-1)?.t ?? 0) / 1000).toFixed(1);
  console.log(`  ${frames.length} frames over ${secs}s`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
