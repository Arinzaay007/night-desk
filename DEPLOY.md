# Shipping it

The software is done and verified. What is left is four steps, and only the first two need
a human with an account.

Order matters. Each step assumes the one above it. Total time if nothing fights you:
**about 40 minutes**, of which ~25 is waiting.

---

## Step 1 — Make the repo public ✅ DONE

**Live at [github.com/Arinzaay007/night-desk](https://github.com/Arinzaay007/night-desk).**
10 commits on `main`, public, verified readable with no credentials.

The pre-public audit before pushing found: the five scratch verifiers removed, `.env.local`
and `.data/` ignored, and a full-history scan for `dpka_` matching only **Definitive's own
published example key** from their docs — not ours. `your key` appears nowhere.

> **Private would have failed the track.** The rules say *"build a new open-source project
> specifically for Runtime."* Public is the requirement, not a preference.

---

## Step 2 — Make the ledger durable

A serverless host cannot write its own filesystem, so a deployed Night Desk starts with an
**empty ledger** — no mirrors, no compliance readout, no revenue, no ranked board. The real
order is still on Base; only the index pointing at it is missing.

Free, no card, ~5 minutes:

1. [console.upstash.com](https://console.upstash.com) → **Create Database** → any name,
   region **us-east-1** (closest to Vercel's default), **Free** plan.
2. On the database page, copy **`UPSTASH_REDIS_REST_URL`** and
   **`UPSTASH_REDIS_REST_TOKEN`**.
3. Push the existing ledger up:

```bash
cd nightdesk
UPSTASH_REDIS_REST_URL=... UPSTASH_REDIS_REST_TOKEN=... npm run seed
```

It prints what it found locally, what is already remote, and reads the value back to
confirm. It **merges** rather than overwrites, so running it twice is safe.

Expected: `+1 mirror(s) the deployed app did not have`.

---

## Step 3 — Deploy

**You:** [vercel.com](https://vercel.com), sign in with GitHub, **Add New → Project**,
pick `night-desk`. Framework auto-detects as Next.js; leave the build settings alone.

Before pressing Deploy, add these **Environment Variables** (all environments):

| Variable | Value | Why |
| --- | --- | --- |
| `FLASH_API_KEY` | `<your Flash key from .env.local>` from `.env.local` | Server-side only. Never `NEXT_PUBLIC_`. |
| `NEXT_PUBLIC_DRY_RUN` | `0` | Armed. `1` turns the live demo into a rehearsal. |
| `INTEGRATOR_FEE_BPS` | `25` | Your fee rate. This is the revenue. |
| `UPSTASH_REDIS_REST_URL` | from step 2 | The durable ledger. |
| `UPSTASH_REDIS_REST_TOKEN` | from step 2 | |
| `OPERATOR_TOKEN` | a long random string | Guards the payout endpoints. |

Then verify, in this order:

```bash
curl -s https://<your-app>.vercel.app/api/health | python3 -m json.tool
```

- `dryRun` must be **false** — if it is `true` you set `NEXT_PUBLIC_DRY_RUN` wrong, and
  nothing on camera will be real.
- `store.backend` must be **`upstash`**. If it says `memory` or `file`, the two Upstash
  variables did not take and your board will be empty.

```bash
curl -s "https://<your-app>.vercel.app/api/proof?planKey=u8201h" | python3 -m json.tool
```

Must return `"mirrors": 1` and `"ratePct": 100`. If it returns `"mirrors": 0`, the seed in
step 2 did not land — re-run it.

> **Note the short key.** `/api/proof` takes `planKey=u8201h`, **not** the long base64 plan
> ID. The long ID silently returns zero mirrors.

---

## Step 4 — Record, post, submit

Record against the **deployed URL**, not the sandbox. A sandbox restart mid-take kills the
app and changes the URL, and the video should show the same link you submit.

Then:

1. **Record** — `RECORDING.md` is the shot list, with the exact on-screen text.
2. **Post on X**, tagging `@DefinitiveFi`, ~1–2 hours before the deadline.
3. **Copy the `/status/<id>` permalink** — not the profile URL.
4. **Submit** at [runtime.nyc/submit](https://runtime.nyc/submit), pasting that permalink
   into the X link field.

**Deadline: Saturday 19 September, 21:00 Lagos (20:00 UTC).** Aim for 18:00.

---

## Still open

**Wallet B holds no USDC.** It spent its $1.35 on the live entry. So the two-wallet beat
cannot run as `DEMO.md` scripts it. See §4 of `RECORDING.md` — the recommendation is to
spend wallet A's $1.35 (~$0.11 real cost, the rest becomes NVDAc) mirroring B's plan, which
also retires the one weak spot in the build: the only mirror so far is a wallet mirroring
itself.

Everything else is done.
