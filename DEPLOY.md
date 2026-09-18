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

Database: **`inspired-slug-284694.upstash.io`** — claimed to your Upstash account, so it
does not expire.

Seeded and verified three ways: `backend: upstash`, `durable: true`, `/api/proof` reading
**1 mirror · 100% published · 3375 µUSD**, and finally a direct `GET nightdesk:mirrors`
against Redis that bypasses the app entirely — `mirrors` + `earnings` keys present, NVDAc,
TP 264.34 / SL 202.66.

> The first database was created with Upstash's agent endpoint (`upstash.com/start-redis`),
> which needs no signup — but those expire after three days unless claimed. Replaced with a
> claimed one so the board survives past the judging window.

The credentials live in `.env.local` (gitignored) and must also be set on the host.

`npm run seed` re-pushes a local ledger into Redis. It merges rather than overwrites, keys
on `orderId`, keeps earnings rows whole, and reads the value back to confirm.

---

## Step 3 — Deploy ✅ DONE

**Live at [night-desk-swart.vercel.app](https://night-desk-swart.vercel.app)**

Project `night-desk` on Vercel. All six environment variables set for
production, preview and development. Verified on the deployed origin:

```
/api/health   store.backend = upstash   durable = true   dryRun = false
/api/proof    1 mirror · compliance 1/1 = 100% · revenue 3375 µUSD
routes        /  /create  /desk  /board  /payouts  /p/<plan>   all HTTP 200
hygiene       no Flash key and no Upstash host in the served HTML
```

`NEXT_PUBLIC_DRY_RUN=0` is load-bearing: it is inlined at **build** time, so changing it
requires a redeploy, not just an env edit. A stale `1` silently turns the live demo into a
rehearsal.

**This is the URL for the submission form and the X post.** Not the sandbox, not the
preview deployment URL — the alias above.

To ship a change after this point:

```bash
npx vercel deploy --prod --yes --token=<token>
```


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
