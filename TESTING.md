# Testing: there is no testnet, so here is the ladder

## The short answer

**Definitive Flash has no testnet.** Not "we didn't find one" — it cannot exist as configured:

```
POST /v1/quote  {"targetChain": "base-sepolia", ...}
→ VALIDATION_ERROR: Invalid enum value.
  Expected 'arbitrum' | 'avalanche' | 'base' | 'bsc' | 'ethereum' | ...
```

Testnets are not valid chain values, and the tokenized equities (NVDAc, TSLAc, …) are only
deployed on mainnet. There is no Base Sepolia TSLA to trade, so there is nothing to test against
even if the API allowed the chain.

The public integrator key in `.env.example` is **not a sandbox key**. It is a mainnet key that
simply doesn't require signup. Everything it quotes is a real, live market.

## Why this is less scary than it sounds

The instinct is to assume "mainnet" means "expensive to get wrong." Look at what each failure
actually costs:

| Failure | What it costs |
| --- | --- |
| Bad signature → order rejected | **$0.** The API refuses it; nothing is signed away, nothing moves |
| Bad quote parameters → VALIDATION_ERROR | **$0** |
| Plan maths wrong → wrong trigger levels | **$0** to discover, *before* you sign |
| Approval transaction reverts | **~$0.01** of Base gas |
| Order accepted, price moves | **Bounded.** `maxSlippage` is capped server-side at 3% |
| The actual fill | The trade itself — and you keep the stock |

The only genuinely irreversible step is the fill, and that's the step you *want* to verify. So
"testing on mainnet" here means **spending about a dollar once** — and rungs 1 to 3 of the ladder
below come to well under a quarter between them — not gambling the weekend.

## Layer 1 — Preflight (free, no funds, run as often as you like)

```bash
npm run preflight              # against localhost:3000
npm run preflight https://your-app.vercel.app   # against a deployment
```

114 checks across twenty-one groups, driving the real server routes and the real API:

- Live market data (all 7 equities priced, none risk-flagged)
- Balance discovery (funded wallet + a brand-new wallet, no crash)
- Parametric maths (spend clamping, reference price, TP/SL derived correctly, TP above SL)
- **Bracket construction** — both signing payloads present and distinct, non-expiring deadline,
  salt, `signedMaxFromAmount` covering the fill, received-asset approval requested
- **Signature validity** — every payload actually signed with viem and verified, including a check
  that the pair's exit leg sells the asset the entry receives
- All 7 equities quoting *and* signing
- Size sweep 1% → 100%
- Limit entry, including the levels derived from the limit price
- Guards refusing bad input (unfunded wallet, bad version, bad address, unknown asset, out-of-range size)
- Order route refusing unsigned/quoteless submissions
- Secret hygiene: no API key in served HTML, browser never calls Flash directly

The full group list is printed on every run. The newest surfaces:

- **Cancel message bytes** — the em dash sits at exactly the right index, one newline, the order id
  embedded verbatim, a 65-byte EIP-191 signature that verifies, the route refusing a tampered
  message, and a valid cancel actually reaching Flash
- **Close / sell path** — sell quote accepted, no bracket block on an exit, sell signature
  verified, and the route refusing a wallet with no position
- **Proof endpoint** — serves an unmirrored plan cleanly, requires a plan key
- **Allowance warm-up** — a cold wallet gets exactly two approval payloads (spend, and authorise the
  pair), the response carries nothing quotable or signable into an order, an unknown asset is refused
- **Health endpoint** — reports config, names the live store backend, leaks no key
- **Error hygiene** — what a mirror sees when something upstream fails is a sentence with a code
  on it, not the raw upstream JSON blob; the blob goes to the server log instead
- **The board** — rows account for every mirrored position, an unknown plan is an empty board rather
  than an error, and the ranking table is present in the server-rendered HTML with unpriced plans
  labelled instead of shown as flat
- **Author earnings** — the ledger refuses an unqualified read, an unknown author reads as empty
  rather than erroring, the queue is ordered by what is owed, an unknown action is refused, **an
  unearned balance prepares no transfer**, and settling with nothing payable is a no-op. Four of
  these are *structural* checks that read the source files directly (`the order route accrues an
  earning`, `the proof route reconciles entry and bracket fills`) — see below for why.

Three pure layers are covered by their own suites, all of which compile the real module into a temp
directory before importing it — a test cannot pass while the shipped file is broken:

- `npm run test:pnl` — **51 assertions** on `src/lib/pnl.ts`: token maths, open and underwater
  positions, closed at a profit and at a loss, partial exits with a pro-rated cost basis, unfilled
  orders, a missing price, and malformed input that must produce zero rather than `NaN`.
- `npm run test:verify` — **52 assertions** on `src/lib/verify.ts`: tolerance boundaries, a clean
  mirror, and above all the **negative** cases — a mirrorer who doubles their stop from −8% to −16%
  must be caught, a cancelled bracket must not read as protected, missing data must report `unknown`
  rather than pass, and an empty plan must not read as a 0% failure. A compliance readout that says
  "as published" when it should say "deviated" is the app lying on the author's behalf.
- `npm run test:rank` — **24 assertions** on `src/lib/rank.ts`: that realised profit outranks reach,
  that a loss is a real score, that an unpriced plan sinks rather than being ranked flat, the
  tie-breaks, and that the ranking neither mutates nor invents rows.
- `npm run test:earnings` — **97 assertions** on `src/lib/earnings.ts`: integer micro-USD arithmetic
  (including that a 375 µUSD share does *not* round to zero), the fee maths against the quoted
  all-in figure, reading a fee off a fill, idempotent accrual, reconciliation that sums the entry
  **and** the bracket leg without accumulating, and the payout invariant — **a forecast cannot be
  claimed, even when its id is named explicitly**, and a claimed record is terminal against a late
  fill report.

`npm run check` runs the typecheck and all four suites — 224 assertions, no server, no funds.

There is also a fourth for the wiring rather than the arithmetic:

```bash
npm run dev                     # in one shell
npm run test:earnings:live      # in another — 38 assertions through HTTP
```

`scripts/test-earnings-live.mjs` injects a store file, walks forecast → obligation → transfer →
settled over real HTTP against a running server, and restores what was there afterwards. It checks
that `prepare` builds genuine `0xa9059cbb` calldata for the reconciled amount only, that the amount
forked out does not include a forecast, and that settling twice does not pay twice.

This is the substitute for a testnet, and it already earned its keep.

### It caught a real bug, and then a silent one

The preflight found an **undocumented API constraint** that would have broken the demo the moment
anyone tried a limit entry:

```
attached_bracket limit entries require limit_cross_price in v1
(limit_notional_price is not supported with the block)
```

A limit entry works with `limitNotionalPrice` **on its own**, but the moment you attach a bracket
it must be `limitCrossPrice` instead. Nothing in Definitive's documentation mentions this. It was
only found by exercising the real API — **a testnet would not have caught it either**, because the
constraint is in their application logic, not their contracts. Fixed in `src/app/api/quote/route.ts`,
covered forever by section 7 of the preflight.

The second was quieter and worse. A rollback removed the author-share accrual from the order route
and the reconciliation from the proof route — and **every runtime check still passed**, because the
routes simply behaved as if the feature had never existed. Nothing errored; money just stopped being
owed. That is the failure mode a preflight is for, so group 9i now asserts the wiring directly by
reading the source files, and four of its checks fail if those lines go away again.

## Layer 2 — The mirror rehearsal (free, real quotes, real signatures)

```bash
npm run rehearse     # preflight, then the two-wallet mirror rehearsal
```

`scripts/test-flow.mjs` walks the exact path the demo walks, with two throwaway wallets, and checks
what comes out the other end. It is the closest thing to a testnet this build can have.

What it does, in order:

1. Encodes a plan into a link, decodes it back, fetches `/p/<id>` and checks the page renders with
   the asset and the mirror action on it.
2. Quotes the plan against **wallet A** at $1 and **wallet B** at $3, against the live market.
3. Signs the entry and the bracket for both, with real keys.
4. Submits both through the real `POST /api/order`, which runs every validation and assembles the
   payload Flash would receive — then stops, because the server is in dry run.

The assertion the product actually rests on is in the middle of it:

```
3. Two wallets, two independent brackets
  ✓ A and B hold different quantities            1.00 vs 3.00
  ✓ A and B have different exit caps             0.00487671 vs 0.01467685
  ✓ the larger mirror is allowed to sell more    B's cap is 3.01x A's, B is 3.00x A's size
  ✓ each stop tracks its own reference price     market flat at 214.51; both stops land at 203.79
  ✓ A and B sign separately
  ✓ the salts differ
```

That is the claim — *a mirror is an independent bracket, not a copy of the author's* — shown rather
than asserted. The exit cap scales with the mirror's own size, the levels are derived from that
mirror's own live reference price, and the signatures are its own.

It also checks something easy to get wrong: **a rehearsal leaves no trace.** No mirror is written to
the board, so a row on the board always means a real position. And it refuses to run at all unless
`/api/health` reports dry run, because it quotes sizes the wallets do not hold.

### Dry run in the UI

`NEXT_PUBLIC_DRY_RUN=1` makes the whole product walkable before either wallet holds anything. On
`/create` and on any plan page there is a **rehearse at** size box: set it to $1 and press *Sign,
execute & mirror*. You get the live quote, both signature prompts from your real wallet, and the
order route assembling the real payload — with no approvals, no spend, and nothing onchain.

Two things are deliberately **not** simulated, because they are the steps that break:

- **The signatures are real.** A rehearsal that skips the wallet prompts rehearses the wrong thing.
- **The order route validates for real.** Same code, same payload, stopped one line before the
  network call.

The banner says exactly that: *live quotes, real signatures, nothing sent to the exchange.*

## Layer 3 — Funded mainnet ladder

Short, staged, and each rung answers one question. Do them in order.

### How small can a test trade actually be?

I measured this rather than guessing. Flash's own floor is much lower than the app's default:

| Size | Result |
| --- | --- |
| $5.00 | OK |
| $1.00 | OK |
| $0.50 | OK |
| $0.25 | OK |
| $0.10 | OK |
| **$0.03** | **OK — the API floor** |
| $0.02 | `INVALID_ARGUMENT: flash quote failed: core OrderPreview: rpc error` |

So `$5` was a number I picked, not one Flash imposes. **There is, however, a real economic floor**,
because every quote carries a roughly fixed network/route cost:

| Size | All-in fee | Fee as % of the trade |
| --- | --- | --- |
| $0.05 | $0.038 | **75%** |
| $0.10 | $0.028 | 28% |
| $0.25 | $0.028 | 11% |
| $0.50 | $0.033 | 6.6% |
| **$1.00** | **$0.039** | **3.9%** |
| $2.50 | $0.042 | 1.7% |
| $5.00 | $0.044 | 0.88% |
| $10.00 | $0.050 | 0.50% |
| $25.00 | $0.065 | 0.26% |

The knee is around **$2.50–$5**. Below $1 you are mostly paying fixed costs — but note the
absolute money involved: the difference between testing at $5 and testing at $1 is about
**two cents**. Size barely affects what testing *costs*; it affects how the numbers read on screen.

> **Caveat, because it bit me while measuring:** the fixed component moves with Base gas
> conditions, so the effective fee at a given size is *not* stable run to run. The same $0.50
> quote measured **6.6%** in one run and **15.4%** in another a few minutes later. At $5+ the
> variation is noise; at $0.25 it swings the headline number by 2×. Another reason not to test
> at dust sizes. The preflight's fee section prints live numbers each time you run it.

**Configuring it** (`.env.local`):

```bash
MIN_SPEND_USD=1      # policy floor; Flash's own floor is ~$0.03
MAX_SPEND_USD=250    # clamp on any single order
```

To force a tiny mechanics-only smoke test, set `MAX_SPEND_USD` **below** `MIN_SPEND_USD` — `MAX`
wins the clamp and the refusal guard follows it down:

```bash
MAX_SPEND_USD=0.5    # every order is exactly $0.50, still fully bracketed
```

### The thing that actually matters

**Capital deployed is not cost.** The ~$15 in the ladder below is not money spent — it becomes
tokenized stock you still own, and you can sell it back whenever. The genuine cost of the entire
ladder is roughly **ten cents** in fees and gas. If you only want to prove the mechanics, rung 1
at $1 costs you about **four cents**.

### Rung 0 — Readiness (free)
- [ ] `npm run rehearse` → 114/114 and 35/35, with the dev server running
- [ ] `npm run check` → 224/224 (51 + 24 + 97 + 52)
- [ ] In the browser, with dry run on: press *Sign, execute & mirror* on a plan at **rehearse at $1**
      and watch all four steps complete. This is free and it exercises the wallet prompts.
- [ ] Wallet A holds ≥ $2 USDC on Base **plus ~$1 of ETH for gas**
- [ ] Wallet B holds ≥ $2 USDC on Base plus gas
- [ ] Your own Flash key created (`app.definitive.fi` → More → Flash)

Rung 0 costs nothing and covers everything up to settlement, including the two-wallet mirror story
— the CLI rehearsal walks that with two throwaway wallets. What it cannot cover is settlement: the
contract accepting a signature, an approval landing, an entry filling and a trigger firing. That is
what Rung 1 is for, and Rung 1 costs about four cents.

### Rung 1 — $1 smoke test (the important one)

Set `MAX_SPEND_USD=1` so this is tiny, then create a plan and execute it. Or just set
`MAX_SPEND_USD=0.5` if you want the absolute minimum.

This rung answers: *does the settlement contract accept our signature, do the approvals land, and
does the bracket activate on first fill?*

Watch for:
- "Approve tokens — transaction 1 of 2" → 2 → confirm on BaseScan
- "Sign entry + protection" completing
- `orderId` returned, bracket status `pending_activation`
- On `/desk`: entry appears, then flips to `active` once filled

If it fails here you have lost about **four cents** and bought the most valuable information of the
weekend.

### Rung 2 — Mirror from wallet B (~$5)

Open the plan link from Rung 1 in a different browser profile, connect wallet B, mirror. Raise
`MAX_SPEND_USD` a little so the position is visible.

This rung answers the product's central claim: **do two wallets produce two independent brackets?**

Verify on `/desk` from both wallets: two different absolute stop prices, two different bracket
order IDs, two separate salts. Screenshot this — it's the money frame of the video.

### Rung 2b — Close a position and cancel a pair (~$0 extra)
On the wallet from Rung 2, press **Close position**. It sells the balance into USDC and then cancels
the protective pair.

Verify both halves happened: the exit order appears on `/desk` as filled, and the pair is gone —
`CANCELLED` with `REASON_USER_REQUESTED`. **This is the one flow the preflight could not exercise**,
because no wallet available to us held a tokenised equity. It is the most likely place for a
surprise, so do it before you record.

### Rung 2c — Cancel a resting order (~$0)
Make a limit entry far from the market so it rests without filling, then cancel it.

Verify the order flips to `CANCELLED`. Two things about this path are worth knowing before you try
it on camera:

- **A cancel can race a fill.** If the order fills first, Flash returns `422 order already filled`,
  which the UI reports as *executed, not failed*, and it is never auto-retried.
- **A cancel is idempotent, and the client treats it that way.** A timed-out cancel is repeated once
  automatically, and if it still fails the message says trying again is safe *even if the first one
  landed* — rather than claiming nothing happened, which is not knowable from a timeout. Order
  submission gets no such mercy: it is never retried, because a retry after an ambiguous failure
  could double-submit a trade.

### Rung 3 — Trigger the stop (~$0)
Set a stop-loss very close to spot on a volatile name ($0.30 away on a $200 stock), then wait.

This rung answers: *does a trigger actually fire and produce a fill?*

Rehearse this at least twice so it fires on cue within a minute or two on camera. If it won't
fire reliably, record it once and use the clip — never gamble a live trigger in the final take.

### Rung 4 — The real demo recording
Only after 1–3 pass. Raise to $25–50 so the numbers read well on camera — that is also where the
fee is genuinely small (0.26–0.5%). Full size, both wallets, one take.

## Cost of the whole ladder

| | |
| --- | --- |
| Gas (Base, ~6 transactions) | **< $0.10** |
| Flash fees (rungs 1–3 at small size) | **~$0.15** |
| USDC deployed | **$10–25 — recoverable, it becomes stock you still own** |
| **Net cost of being confident** | **Under $0.25** |

If you only do Rung 1, the entire cost is about **four cents**.

## Rules

1. **Preflight before every deploy.** It's free and it caught a demo-breaking bug once already.
2. **Never record on a rung you haven't already completed.** A rehearsal is not a pass.
3. **Pre-warm approvals before recording.** The first trade for a token needs two approval
   transactions. Do them in advance so the money moment isn't a wallet popup.
4. **Assert the result, don't assume it.** After each rung, check `/desk` and BaseScan — not just
   that the UI said "done."
5. **Keep `NEXT_PUBLIC_DRY_RUN=0` for anything you intend to count.**
6. **Raise the size for the recording, not for the testing.** Small trades prove mechanics; readable
   trades make a demo.

## Resilience notes

Two behaviours worth knowing before you record, both added after watching real
traffic:

- **Quotes can be slow.** During a preflight run, four quote requests took over
  10 seconds and returned a gateway timeout. The client now caps every Flash
  call at 15s, retries a slow *quote* once (a quote moves no funds, so repeating
  it is free), and otherwise fails with a clear "nothing was submitted" message
  rather than hanging the UI.
- **Order submission is never auto-retried.** If a submit times out, the result
  is genuinely ambiguous — the order may or may not have been accepted — so the
  app surfaces the error and leaves the decision to you. Retrying a submit
  blindly is how you end up with two positions.
- **A cancel can race a fill.** Flash answers `422 order already filled`, which
  the UI reports as *executed, not failed*. Do not retry.
