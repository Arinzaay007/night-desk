# Night Desk

**Publish a trade plan as a link. Anyone who opens it executes it in one tap — at their own size, with their own take-profit and stop-loss.**

Built for **Runtime Agent Week** (September 2026), entered in the **Definitive Flash — Best Social Trading Build** track.

---

## What it does

A **plan** is a shareable object, not a post in a feed:

| Field | Meaning |
| --- | --- |
| Asset | A tokenized equity on Base (NVDAc, METAc, GOOGLc, AAPLc, TSLAc, AMZNc, MSFTc) |
| Entry | Market now, or a resting limit at a price |
| Size | A **percentage of the mirroring wallet** — never a fixed amount |
| Take-profit | A percentage above the reference price |
| Stop-loss | A percentage below the reference price |

Publishing a plan produces a URL (`/p/<encoded-plan>`). Opening that URL re-quotes the plan against **your** wallet and balance, and you sign your own entry plus your own protective bracket.

### Why parametric

Every mirror needs a fresh quote against a different wallet, so a plan *has* to be expressed in percentages. That constraint is also the better product: a follower with $50 gets a proportional position and a proportional stop instead of inheriting a whale's absolute size.

### Why independent brackets

Each mirror signs its own take-profit / stop-loss pair, good-til-cancelled. **The author closing their position cannot exit a follower.** That is the difference between a signal and a shared exit, and it is what makes the advanced-order engine load-bearing rather than decorative.

---

## Definitive Flash advanced orders used

This build uses the Flash advanced order types below. Naming them explicitly, as the track asks:

- **Bracket orders** (`attachedBracket`) — the core primitive. One quote returns **two signing payloads**: the entry, and the take-profit / stop-loss pair. Both are signed with the funder wallet and submitted together, so one submit lands the position *with its protection attached*. The pair's signature is good-til-cancelled (`deadline: 281474976710655`, the non-expiring sentinel) and its exposure is capped by `signedMaxFromAmount`.
- **Take Profit and Stop Loss** (the bracket legs) — trigger legs on the received asset, priced in USD notional, fired by the keeper at execution time.
- **Limit orders** (`limitNotionalPrice`) — for plans that want a specific entry rather than a market fill.
- **TWAP** (`durationSeconds`) — supported by the API and usable for scaling into a position without moving the market. Implemented in the client's quoting layer; used less than bracket + market.
- **Market orders** with `maxSlippage` bounded server-side.

The bracket is what the product is built on: **every mirror is protected by construction**, because the UI has no path that produces an entry without its exit pair.

**Also used:** `flashIntegratorFeeBps` (a 25 bps integrator fee on every order, surfaced to the user in the preview before signing), and optionally `erc8021AttributionCode` for Base builder-code attribution on settlement transactions.

---

## Architecture

```
Browser (Next.js App Router + viem)
  │  1. POST /api/quote          → server builds a parametric quote for THIS wallet
  │  2. send approve txs         → one for the spent asset, one for the asset the bracket sells
  │  3. sign EIP-712 locally     → entry signature + bracket signature (keys never leave the browser)
  │  4. POST /api/order          → server echoes order fields + signatures to Flash
  ▼
Server routes (Next.js)  ──►  Flash API  https://flash.definitive.fi/v1
```

- **The Flash API key never reaches the browser.** Every Flash call goes through `/api/*`.
- **Signing happens client-side**, with either an injected wallet (`eth_signTypedData_v4`) or a local throwaway key for a two-wallet demo.
- **`/api/quote` owns the maths** — balance → size % → reference price → absolute TP/SL levels → bracket quote — and returns the exact `orderFields` the client must echo on submit, so the client can never drift from the quote.
- **Plans live in the URL**, so a shared link is permanent and never depends on a database row.

### Routes

| Route | Purpose |
| --- | --- |
| `/` | What it is, in five seconds |
| `/create` | Compose a plan, preview the levels, sign twice, publish |
| `/p/[id]` | **The plan link** — the whole social layer, plus a proof panel |
| `/desk` | Positions and protection, with exits: cancel an open order, or close a filled position |
| `/board` | Published plans ranked on realised P&L, with two other rankings a click away |
| `/api/quote`, `/api/order`, `/api/orders`, `/api/cancel`, `/api/close`, `/api/proof`, `/api/plans`, `/api/assets`, `/api/balance`, `/api/setup-tx`, `/api/receipt`, `/api/warmup`, `/api/health` | Server routes |

### The board

Ranking is not a vanity sort. The headline order is **realised P&L** — dollars that actually settled
from fills read back off the exchange — so a plan that booked profit outranks a plan that forty
wallets copied into a loss. Two other orders are one click away: **Return %**, which is the fairer
comparison when each mirror chooses its own size, and **Wallets**, which ignores performance
entirely.

Two details that matter more than they look:

- **Unpriced is not the same as flat.** A plan whose fills have not been read back yet has no score
  at all, so it sinks to the bottom of the board rather than being ranked as a zero. If the read
  fails outright the row says *unreadable* and keeps a retry button.
- **The board is honest about an all-zero column.** Before anything has closed, every plan books
  $0.00 realised and the ordering falls through to open performance. The page says so, in words,
  instead of presenting a column of zeros as a result.

The ordering rule lives in `src/lib/rank.ts` as a pure function with 24 assertions behind it
(`npm run test:rank`) — including that the most-copied plan does not automatically lead.

### Getting out

A trade you cannot exit is not a product, so `/desk` carries two distinct actions:

- **Cancel order** — for an order that has not filled (`PENDING`, `ACCEPTED`,
  `PARTIALLY_FILLED`). Requires an EIP-191 `personal_sign` over an exact plaintext message rather
  than the quote payload, so the wallet prompt shows the user precisely which order they are
  cancelling. Partial fills are kept; the remainder stops.
- **Close position** — sells the wallet's whole balance of the token into USDC at market, **then**
  cancels the protective pair.

That second one is the subtle bit: **Flash cancels a bracket pair separately from its entry.**
Cancelling an entry does not cancel the pair, and once an entry has filled at all the pair stays
live protecting what it received. So closing without cancelling the pair would strand a live order
against a position that no longer exists. The order matters too — the sell goes first, because
cancelling protection first would leave the position briefly exposed, and because a bracket's exit
is capped by `signedMaxFromAmount` a pair that fires mid-sell cannot oversell.

### Proof, not screenshots

The plan page reads every mirror back from the exchange by funder and order id and shows the
fills, the venue, the transaction hashes, whether the protective pair actually activated, and
whether it fired. Anyone reviewing the submission can click through to BaseScan and check. A
mirror that cannot be read back is reported as **unverified**, never hidden.

---

## Running it

```bash
npm install
cp .env.example .env.local     # a working public key is pre-filled in .env.example
npm run dev                    # http://localhost:3000
```

`FLASH_API_KEY` — the pre-filled value is the public integrator key from Definitive's docs, which is fine for building and recording. **For your own org to be the integrator** (so integrator fees accrue to you), log in at [app.definitive.fi](https://app.definitive.fi/) → **More** → **Flash** → **Create Flash Key**, and paste it in.

### Recording the demo

**[DEMO.md](./DEMO.md)** is the runbook: the readiness check, the beat-by-beat shot list with what
appears on screen at each step, the fallback beats for when a live market misbehaves, and the
submission checklist.

```bash
npm run demo:check -- --armed --wallets 0xA...,0xB... --plan "<link>"
```

It exits non-zero on anything that would be discovered live, on camera, with the clock running —
including whether your Flash key is your own. On the public key from Definitive's docs, integrator
fees on your mirrors accrue to the demo integrator rather than to you.

### Recording the two-wallet demo

1. **Wallet A** — connect an injected wallet, compose a plan, sign twice, publish. Copy the link.
2. **Wallet B** — open the link, connect the second wallet (an injected wallet in another browser profile, or `Use local key` with a throwaway key), and mirror.
3. Show the two positions side by side on `/desk`: different absolute stops, two independent brackets.

Use two browser profiles, one wallet each — it is the cleanest way to demo a mirror without
wallet-switching on camera.

**Rehearse it first.** With `NEXT_PUBLIC_DRY_RUN=1`, both wallets can walk the entire sequence
before either holds a cent: live quote, both signature prompts, the order route assembling the real
payload. Only the approximations in the ladder below are left. `npm run rehearse` does the same
thing from the terminal with two throwaway wallets.

---

## Known limitations (honest list)

- **The board is best-effort.** Flash scopes order reads to a funder address, so there is no global feed of trades to index; the board can only see plans published through Night Desk. Its ledger picks a backend at runtime — Upstash Redis if `UPSTASH_REDIS_REST_URL`/`_TOKEN` are set, otherwise `./.data/store.json`, which is **ephemeral on serverless hosts**. `GET /api/health` reports which backend is live and warns when it is the ephemeral one, so the failure is visible before it bites rather than after a redeploy empties the board. Plan *viewing* never touches the store at all, so links keep working either way.
- **Author fee share is accrued, not distributed.** Integrator fees are collected by Flash into the integrator's portfolio; splitting them to plan authors is an off-chain ledger step this build does not implement.
- **P&L covers what the exchange reports, which is what a proof can honestly claim.** Realised figures come from settled fills on the entry and its bracket legs; the open remainder is marked at the current market price from a fresh quote. It is not a full accounting ledger: fees are taken as reported by Flash rather than recomputed, and a position that was moved by something outside Night Desk will read as an unexplained difference rather than being silently reconciled. Where a fill cannot be read back the row is marked unverified and excluded from the totals.
- **Close-position was not verified end to end.** The sell request shape, its signature and the guards are all covered by the preflight, but no wallet we had access to holds a tokenised equity, so the round trip (sell → cancel pair) has not been executed against real funds. It is rung 2b on the funded ladder.
- **Base only.** Robinhood Chain, Solana and cross-chain all quote successfully through Flash and are deliberately out of scope to keep settlement single-chain.
- **`MAX_SPEND_USD` (default $250)** clamps any single order regardless of the percentage chosen.
- Demo software. Not financial advice.

---

## Testing

Flash has **no testnet** — testnets are not valid chain values in their API and the tokenized
equities only exist on mainnet. Testing is therefore layered:

```bash
npm run check            # typecheck + pure-layer assertions (no server needed)
npm run rehearse         # 91 preflight checks, then the 35-assertion two-wallet mirror rehearsal
npm run dev              # with NEXT_PUBLIC_DRY_RUN=1 for a free full-flow rehearsal in the browser
```

Three layers, and the first two cost nothing:

1. **Preflight** — 91 checks over live market data, the parametric maths, bracket construction,
   verified signatures, every guard, the cancel bytes, the board and secret hygiene.
2. **The mirror rehearsal** — `scripts/test-flow.mjs` runs the whole flow with two throwaway wallets:
   real quotes, real signatures, the real order route assembling the real payload, stopped one line
   before the exchange. It proves the headline claim — two wallets, two *independent* brackets — and
   that a rehearsal leaves nothing on the board. In the browser, the same thing is walkable by hand
   with the **rehearse at** box on any plan page.
3. **The funded ladder** — the only part that costs anything, and rungs 1–3 come to well under a
   quarter.

**Trade size is configurable, and testing is nearly free.** Flash's own floor is ~$0.03, but every
quote carries a fixed ~$0.03 of network cost, so tiny trades are mostly fee (11% at $0.25, 3.9% at
$1, 0.88% at $5). Set `MIN_SPEND_USD` / `MAX_SPEND_USD` in `.env.local`; putting `MAX` **below**
`MIN` forces tiny orders for a mechanics-only smoke test. Capital deployed is recoverable — it
becomes stock you still own — so the real cost of the whole ladder is under $0.25.

Then a staged **funded mainnet ladder** that starts at one dollar and, for the rungs that matter
most, costs nothing at all. Full detail, including what each rung proves and what it costs:
**[TESTING.md](./TESTING.md)**.

The preflight already paid for itself — it found an undocumented API constraint that would have
broken any limit entry (see below).

## Gotchas worth knowing

- **Flash sits behind Cloudflare and returns `403 error code: 1010` to requests with a default programmatic User-Agent.** A normal `User-Agent` is mandatory on every call. This is by far the most confusing failure you can hit — an apparently valid key appears to be rejected. It is handled once, in `src/lib/flash.ts`.
- **A bracketed limit entry must use `limitCrossPrice`, not `limitNotionalPrice`.** A limit entry alone accepts `limitNotionalPrice`, but attaching the bracket block makes Flash reject it with `attached_bracket limit entries require limit_cross_price in v1`. This is **not in their documentation** — it was found by exercising the live API, and it is covered by section 7 of the preflight. `limitCrossPrice` is the pair rate (target priced in the contra asset); since the contra here is USDC the number the user typed is right either way, only the field name changes.
- **TWAP needs `durationSeconds`**, which is not shown in the basic quote parameter tables.
- **The balances endpoint returns `tokenDecimals`**, while `/search` returns `decimals`. Same API, different field names.
- **A first bracket trade needs two approvals**, not one: the spent asset, and the asset the bracket leg is authorised to sell on exit. Both come back on the quote (`evm.approveTx` and `attachedBracket.evm.approveTx`).
- **Order reads require the funder address** (`GET /orders/{orderId}?funderAddress=…`), which is why there is no global leaderboard.
- **Never run `next build` while `next dev` is running.** Both write `.next/`, and the build wins — the dev server then 500s on every dynamic route until it is restarted with a clean `.next`. It looks exactly like a code regression and is not one. Stop the dev server, build, then start it again.
- **Upstream failures are summarised for the browser and logged in full.** `describeFlashError` (which appends the raw upstream JSON) goes to the server console; `summariseFlashError` is what reaches a user, so a mirror never sees a hundred characters of somebody else's error envelope. Checked by the preflight.
- **Rate limit is 5 requests/sec per endpoint per key.** Polling fills in a loop will 429; the client reads remaining quota and backs off.

---

## Stack

Next.js 15 (App Router) · React 19 · TypeScript (strict) · viem · no UI framework, no database.
