# What you are looking at when you record

A shot-by-shot of the actual screens, written from the rendered pages rather than from
memory. Every quotation below is text that is really on the page.

---

## 0. Where things actually stand

**The software works.** Verified on this deployment, just now:

| | |
| --- | --- |
| Preflight | **114/114** |
| Unit suites | **224/224** (51 P&L + 24 ranking + 97 earnings + 52 compliance) |
| Production build | clean |
| Routes | `/`, `/create`, `/desk`, `/board`, `/payouts`, `/p/<plan>` all **HTTP 200** |
| Live proof | 1 mirror, compliance **5/5 checks**, **100% published**, revenue **3375 µUSD** |
| The plan page | renders the level strip, the risk band, the compliance readout, the earnings ledger |
| Browser check | all six routes drive clean in a real Chromium — **0 console errors**, no invented figures |

**Two blockers that used to be in this list are now closed. Do not go looking for them:**

1. ~~Wallet B holds no USDC.~~ **Both wallets are funded and verified on Base.** B (the author)
   holds **1.225363 USDC**; A (the mirror) holds **1.3499 USDC**. The two-wallet beat in §4
   can run as written. A has never sent a transaction, so its **first** action is the two
   one-time approvals in §4 — budget two extra prompts and don't narrate them as the trade.
2. ~~A deployed link would show an empty board.~~ **The ledger is on Upstash**, and the
   deployment is verified durable: the board shows **1 plan · 1 mirror · $1.35 notional**
   and the plan page reads compliance back live. Nothing to seed, nothing to re-deploy.

**Two warnings that are false alarms, so you don't chase them:**

- *"0x8c2c4a…cAb5 has 0.000040 ETH — two approvals may not fit."* **Wrong.** Base gas is
  0.006 gwei; two ERC-20 approvals cost **~0.00000055 ETH**. Wallet A has **72× headroom**.
  The check is conservative. You do not need to buy ETH.
- *"market data is slow, 3941 ms."* True, and worth narrating rather than hiding — see §3.

---

## 1. Before you hit record

**Record against [night-desk-swart.vercel.app](https://night-desk-swart.vercel.app)** — the
deployed app, in a **real browser tab**. Not the Arena preview iframe (a sandboxed frame
blocks the MetaMask extension, and wallet A is an injected wallet), and not a sandbox URL
(those die on restart and change on every restart).

The deployed app is verified: `dryRun: false`, `store.backend: upstash`, all six routes
serving, and 7 equities pricing live through Flash. It is the same link you will put in the
submission form, so the video and the form agree.

- [ ] Two browser profiles: **A** in one, **B** in the other. Never switch mid-recording.
- [ ] The plan link already open in a third tab, obtained with the **Copy link** button —
      never by hand-selecting it. A plan ID is 251 characters and one wrong character
      makes it unreadable (the app fails loudly, but it will cost you a take).
- [ ] Record at 1080p, cursor visible, notifications silenced, extensions off.
- [ ] `/desk` is **empty until a wallet is connected** — connect first, then it fills.
- [ ] Do one full dry pass with `NEXT_PUBLIC_DRY_RUN=1` to put the prompts in your fingers.

**Know the state of the market before you open your mouth.** Right now:

```
entry 240.45   now 219.60   take-profit 264.34   stop-loss 202.66
        the position is -8.7%, and the stop sits 7.7% below the current price
```

NVDAc is *falling*. Two consequences worth being ready for: the stop could fire during or
after your recording (**that is a gift** — film a 30-second follow-up of a trigger firing
unattended), or the position is closed by the time you record (**also fine** — say so and
show the fill).

---

  ## 2. The ledger — done, skip this

  This used to be a step and is now just a fact. The ledger lives on Upstash and the host has
  `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `DEFINITIVE_API_KEY`,
  `NEXT_PUBLIC_DRY_RUN=0` and `INTEGRATOR_FEE_BPS=25` set for production. Verified on the
  deployed URL, not assumed: the board renders **1 plan**, **1 mirror**, **$1.35 notional**,
  and the plan page reads compliance back as **100% published** with **3375 µUSD** of settled
  fee. A judge clicking your submitted link sees exactly this.

  The trap it used to describe is still worth knowing, because it is silent: **deploying
  without a reachable store serves an empty board without erroring.** `.data/` is gitignored
  and a serverless host cannot write its own filesystem, so the real order stays on Base while
  the index pointing at it disappears. Everything worth submitting — the compliance readout,
  the fee, the ranked board — reads from that ledger. If you ever redeploy and the board comes
  up empty, that is this, and the fix is the two Upstash variables, not the code.

---

## 3. What is on your screen, beat by beat

### Beat 1 — The claim · `/` · 20s

Three lines, then four explainer cards and two buttons: **Compose a plan** · **See
published plans**.

> "The NYSE closed four hours ago. This is tokenized NVDA on Base and it is still trading.
> Here's what nobody has: a way to share a *plan* that someone else can actually run."

Read the headline aloud — it is the product in one sentence: *"Publish a trade plan. Anyone
can mirror it — with their own stop-loss."* Say the last five words deliberately.

### Beat 2 — Compose, and a real quote · `/create` · 60s

Left column: **Connect wallet** / **Use local key**, then *Compose a plan* — an asset picker
listing seven tokenized equities, Entry (Market / Limit), **Size** ("percent of the
mirroring wallet, never a fixed amount"), **Take-profit %**, **Stop-loss %**, a note, then
**Preview levels** and **Sign, execute & publish**.

Right column: *"What you are about to sign"* and *"Two signatures, one position."*

Press **Preview levels** with wallet A connected. **Expect a 3–9 second pause** — it is a
live quote, and today's market data is running ~3.9s.

> "While that quotes, every number comes back pinned to *my* balance and the *live* price."

**Do not press "Sign, execute & publish" here** — that button *is* the trade, and it would
spend wallet A's $1.35 before beat 4 gets to use it. There is no separate publish step: the
plan becomes a link by being executed, which is exactly why the link cannot lie about
whether the author ran it. If you have decided **not** to spend A's money at all (§4), then
this is your one live execution and you *should* press it — just understand you get the
authoring flow instead of the mirroring one.

Talk over the button instead:

> "Hitting this signs the entry, then the protective pair, and publishes the plan as a
> link. Two signatures, one position. The author of the plan you're about to see did
> exactly this at midnight."

  ### Beat 3 — It is a link, not a post · `/p/<plan>` · 30s

  The page opens on three pills: **PLAN LIVE** · *published 4h ago* · **100% verified**, and
  the headline **"NVDAc momentum plan, fully protected."** Below it the author
  (`0x59f8…2fb2`) and three counters — *mirrors 1 · notional $1.35 · open P&L −$0.12*.

  Then the strip, and this is the shot to hold on:

  ```
  ENTRY          TAKE-PROFIT    STOP-LOSS      SIZE
  $240.45        $264.34        $202.66        100%
  market         +20%           −8%            of wallet
  ```

  And the risk band under it, which is the whole idea in one bar — the ember marker is
  sitting at **$240.45**, the price this mirror actually got filled at:

  ```
  STOP −8% ──────$202.66 ──── $240.45 ──────── $264.34──── TARGET +20%
  market now $219.53 (−8.7% from your entry)   inside your bracket
  ```

  > "This is the whole social layer. No feed, no followers, no chat. There is a link, and
  > everything needed to run this plan is in the URL — which is why it cannot rot."

  Then the honest core, and **use the marker to point at it**:

  > "The levels move with the live price at the moment *you* mirror, because your bracket is
  > your own order. Two mirrors opened an hour apart are two independent positions, not one
  > shared trade. And the entry on that bar isn't a claim — it's the price the exchange
  > filled *me* at."

  The market has run against the position, so say so before anyone reads it off the screen:

  > "The position is down 8.7% and the stop sits 7.7% below the current price. Two things
  > about that. One, this is one dollar thirty-five — at that size the fee is 8% of the
  > trade, and at twenty-five dollars it's under a percent. Two, if the stop fires while we
  > talk, that's not a bug, that's the product."

### Beat 4 — The second wallet · same page, profile B · 60s

**This is the beat the money decides.** Two options:

**If you spend A's $1.35 (recommended, costs ~$0.11):** in profile A, scroll to **Mirror
it**, connect A, set size to **100%**, and press **Sign, execute & mirror**. Two signature
prompts: the entry, then the pair. Narrate each one as it appears — a judge watching an
unexplained signature prompt assumes a black box.

Then in profile B, open **My desk** and show both positions side by side.

> "Same plan. Different wallet. A different signature. **A different bracket.** A's exit
> was signed by A's key over A's levels — the author cannot exit her."

**This is worth the $0.11 for three reasons:** it turns the product's central claim from
narration into a second on-chain fact; it makes the author payout a *real* row instead of a
forecast, because the funder (A) is now a different wallet from the author (B); and it
retires the one weakness in the build — that the only mirror so far is a wallet mirroring
itself.

**If you do not spend it:** B's mirror is still real and still provable. Show `/desk` for B,
then jump to beat 6 and say plainly that the second mirror is not live yet. A missing beat
costs far less than a fake one.

**Be honest about the stop numbers.** Both brackets were derived from a live reference
price, so they differ only if the market moved between the two quotes and coincide if it
did not:

> "The market barely moved between those quotes, so the stops landed near the same number.
> What is independent regardless is the size, the signature, and the exit cap: that pair can
> only ever sell what this wallet received."

### Beat 5 — Getting out · `/desk` · 40s

**My desk — "Positions, protection, exits."** Connect B (or A). Each entry appears with the
protective pair it carried, because Flash treats the pair as its own order.

> "A trade you can't exit isn't a product."

Show a live position: entry status, the **live** protection pill, **Show fills** → the fill
and its transaction hash. Then **Close position** or **Cancel order**, narrating as it runs:

> "Flash cancels a bracket pair separately from its entry, so closing sells first and *then*
> cancels the pair. Order matters — and a pair that fires mid-sell cannot oversell, because
> its exit is capped."

### Beat 6 — The board · `/board` · 40s

  **Board — "Plans, ranked by the money their mirrors actually booked."** The snapshot strip
  reads **1 plan tracked · 1 mirror · $1.35 notional · $0.00 realised**, a sort toggle across
  **Realised P&L / Return % / Wallets / Most recent**, then one row:

  ```
  NVDAc [TOP]   100% size · +20% · −8%   1 mirror   $1.35   $0.00   −8.70%   100%
  @0x59f8…2fb2 · 4h ago                            1 mirror · $1.35 deployed      read back from chain
  ```

  **Watch the row fill in.** The store pre-paints the row, then the page reads each plan's
  fills back from the exchange — so the four numeric cells briefly read *reading…* before the
  real values land. Let it happen on camera; it is the difference between a number and a
  lookup:

  > "Those cells were empty a second ago. Nothing is cached — the page is reading the fills
  > back from the exchange right now, and it won't print a zero it hasn't verified."

  > "Ranked on realised profit and loss — money that actually settled, read back from the
  > exchange. Not screenshots, not followers."

  Say why **Realised P&L** is the default and why **Return %** exists when every mirror picks
  its own size. Then pre-empt the reading of the two numbers that look like they disagree:

  > "Realised is zero and return is minus 8.7%, and both are right. Nothing has closed, so
  > nothing has been *booked* — that's the realised column. The return is what the open
  > position is marked at, which is the fee drag on a one-dollar-thirty-five trade. A plan
  > whose fills haven't been read back yet gets an em-dash and sinks to the bottom, because
  > **unpriced is not the same as flat**."

  ### Beat 7 — Did they run it? · back to `/p/<plan>` · 45s

  Scroll to **Did they run it?** — *"Every mirror is an order on the exchange, so we can read
  back what actually landed and compare it against the levels above. Anything else is just a
  claim."*

  A gauge reads **100% — AS PUBLISHED**, next to **1 / 1** judgeable mirrors and a three-up of
  **published · deviated · unprotected**. (A fourth state, **unknown**, only appears when the
  exchange can't be read; if it does, it is counted as unknown and never as a pass.) The panel
  below shows one row per check:

```
✓ protection attached                         a take-profit / stop-loss pair
✓ protection still live                       active
✓ take-profit at +20%      wanted $264.34     got $264.34
✓ stop-loss at −8%         wanted $202.66     got $202.66
✓ levels sit on the correct side of the entry
```

> "This is the difference between *three wallets mirrored it* and *three wallets ran it as
> published*. Same information, and only one of them is checkable."

Then read the caveat on screen, out loud — it is there for a reason:

> "This is a readout, not a control. Nothing forces a mirror to stay compliant — the app
> compares what landed against what was published, and reports honestly. Where it can't
> tell, it says unknown rather than assuming the best."

### Beat 8 — The author gets paid · same page, then `/payouts` · 45s

**What the author earns** — *"Every mirror of this plan carries a small integrator fee, and
the person who wrote the plan gets a cut of it — the one part of a shared plan that pays its
author."*

> "A plan is a link, and a link that pays whoever wrote it is the whole reason anyone would
> write one. Every mirror carries a 25 basis point integrator fee and the author takes 60%
> of it."

Point at the revenue figure — it is read off the settled fills, not estimated — and at the
states:

> "**Forecast is not money.** The order is placed, nothing has settled, so nothing is
> withdrawable — and that isn't a UI rule, the payout function cannot even see an estimate.
> It becomes payable when the fills settle. And reconciliation sums the entry *and* the
> protective leg, because the bracket charges its own fee — pay the entry alone and you
> underpay exactly the authors whose plans worked."

  Then scroll back up to the **Raw proof JSON** button next to **Copy plan link**, and open it
  — that is the same readout as an unformatted API response, fills and transaction hashes
  included, read back per funder. The fills and their BaseScan links also sit inline under the
  compliance section, next to the fee that was actually charged.

  > "Every number on this page clicks through to BaseScan, and this button hands you the raw
  > response the page was built from. The whole point is that you don't have to take my word
  > for any of it."

Close on the plan URL itself.

`/payouts` is optional — it is the operator queue, useful only if you have a settled row to
show. If the queue is empty, skip it and say why rather than dwelling.

---

  ## 4. The one decision to make before you record

  **Spend wallet A's $1.35 mirroring B's plan?** A is funded; this is now purely a call about
  $0.11 and one live beat.

  - **Yes (recommended).** Real cost ~**$0.11** — the rest becomes NVDAc you still own. Buys
    the live second-wallet beat, a genuine author payout row, compliance 2/2, and retires the
    self-mirror weakness.
  - **No.** Everything else in this guide still works. Beat 4 becomes narration over B's real
    mirror, and you say so out loud.

  **Do the approvals before you hit record, not during it.** A has never transacted, so its
  first bracket trade needs two one-time ERC-20 approvals. Open
  [night-desk-swart.vercel.app/create](https://night-desk-swart.vercel.app/create) in profile
  A, connect A, and press **Pre-warm NVDAc**. Two prompts, ~0.0000006 ETH of gas at the
  current base fee, and then the mirror itself is the clean two-signature beat. Signing them
  on camera is four prompts in a row and reads as a black box.

Either way, do **not** mirror at a small size to save money: Flash's floor means a tiny
order fails outright or eats a far larger fee fraction. At $1.35 the all-in fee is ~8%; at
$25 it is under a percent. Size is honest here — "your size is yours" — but only 100% of
$1.35 is viable.

---

## 5. Fallbacks

| If | Do | Say |
| --- | --- | --- |
| A quote stalls past ~8s | Wait; the client gives up at 15s, retries once, and tells you plainly. | "That's a live quote against a real market. I'd rather show you the real latency than a canned number." |
| The bracket sits at `pending activation` | Nothing is wrong — it arms on the first fill. | "Protection is attached and waiting. That's the venue's own status, not mine." |
| Wallet A won't connect | Switch to **Use local key** in profile A with a pre-funded throwaway key. | — just do it quickly. |
| Nothing fills live | Do not fake it and do not re-take hoping for one. | "Entry is resting. The protection arms on the fill." |
| A trigger fires later | Film a **30-second follow-up** and cut it in. | A stop firing unattended is the strongest 30 seconds you can show. |

**Never narrate an outcome you did not show.** Every claim in this build is checkable on
BaseScan, and that is the entire advantage. One overstatement costs more than any missing
beat.
