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
published example key** from their docs — not ours.

> **One correction, made after the first push.** This file originally quoted the *first
> thirteen characters* of our own Flash key. It is not a usable credential on its own, but
> it had no business being public, so the history was rewritten with `git filter-branch`
> and force-pushed. A fresh anonymous clone confirms the prefix is absent from every
> commit, every file and every commit message. Recorded here rather than quietly fixed.

> **Private would have failed the track.** The rules say *"build a new open-source project
> specifically for Runtime."* Public is the requirement, not a preference.

---

## Step 2 — Make the ledger durable ✅ DONE

Database: **`literate-glowworm-285241.upstash.io`**

Created via Upstash's agent endpoint (`upstash.com/start-redis`) — no signup, no console
UI. The five-minute button hunt was unnecessary.

Seeded and verified locally: `backend: upstash`, `durable: true`, and `/api/proof` reading
**1 mirror · 100% published · 3375 µUSD** back out of Redis rather than off disk.

> ⚠️ **This database expires 3 days after creation unless claimed.** Claim it at
> `upstash.com/start-redis/console/4d1b038a-504d-41cb-88ee-7e5c353ce1c8` — click **Claim**.
> If judging happens after Monday and the database is unclaimed, the board goes empty and
> the submission shows nothing.

The credentials live in `.env.local` (gitignored). They must also be set on the host.

`npm run seed` remains the tool for re-pushing a local ledger into Redis. It merges rather
than overwrites, so running it twice is safe.

---

## Step 3 — Deploy

**You:** [vercel.com](https://vercel.com), sign in with GitHub, **Add New → Project**,
pick `night-desk`. Framework auto-detects as Next.js; leave the build settings alone.

Before pressing Deploy, add these **Environment Variables** (all environments):

| Variable | Value | Why |
| --- | --- | --- |
| `FLASH_API_KEY` | the `dpka_…` value in `.env.local` | Server-side only. Never `NEXT_PUBLIC_`. |
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
