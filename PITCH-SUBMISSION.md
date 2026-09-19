# Night Desk — submission pitch

The live figures in this document were read off the deployment on **2026-09-19** and are
checkable at the URLs given. Nothing here is projected.

- **Live product:** https://night-desk-swart.vercel.app
- **The plan in the video:** https://night-desk-swart.vercel.app/p/eyJ2IjoxLCJhIjoiMHg1OWY4MDY0MTI3OGY1NTRhYTkyMWNiYzY1NDdjMTgyM2FhZmUyZmIyIiwidCI6IjB4YjIwMDAwMDAwMDAwMDAwMDAwMDAwMDA3OGVlN2NlMmZlNDkwODEwOGMiLCJzIjoiTlZEQWMiLCJlIjoibWFya2V0IiwieiI6MTAwLCJ0cCI6MjAsInNsIjo4LCJ0cyI6MTc4OTc0MTM2NDkzNywibSI6InRoZSBncmVhdCJ9
- **Raw proof, no UI:** https://night-desk-swart.vercel.app/api/proof?planKey=u8201h

---

## HOW TO USE THIS

The demo video **already has narration burned in**. So:

- **Playing the narrated video** (`night-desk-pitch-narrated.mp4`) — you don't speak over it.
  Use §1 for the form and §5 for the X post, and keep §2 open in case anyone asks a question.
- **Playing the silent master** (`night-desk-pitch.mp4`) — read §2 out loud, beat by beat. The
  timings in the left column are the video's. The script is written to land inside each beat.

Either way, §3 is the part that survives scrutiny. It's the "explain each part" answer.

---

## 1. The pitch

### One sentence

> **Night Desk turns a trade plan into a link anyone can run — at their own size, with their
> own stop-loss — and pays the person who wrote it when they do.**

### Thirty seconds (form field / spoken intro)

> Tokenized stocks trade 24/7 on Base. The NYSE closed four hours ago and NVDA is still
> moving. But there's no way to *share a plan* someone else can actually run — you can post a
> chart with an arrow on it, and that's it.
>
> Night Desk makes a plan a link. Anyone who opens it executes it at their own size, with
> their own take-profit and stop-loss attached as their own order on the exchange. The author
> can't exit them, can't touch their money, and can't front-run them.
>
> And when someone runs your plan, **you get paid** — a share of the fee that Flash charges on
> their execution. Not theirs. That's the whole thing: plans, not signals. Authors, not
> influencers.

### The design inversion, in one line

> **Every other copy-trading product copies the trade. Night Desk copies the plan.** The
> author's position is irrelevant to yours, because your stop-loss was signed by your key,
> over your levels, before the author could do anything about it.

---

## 2. Beat-by-beat talk track

Read the left column when the video is at that timestamp. Bracketed lines are optional.

### S1 · 0:00–0:11 · The 24/7 gap

> The New York Stock Exchange closed four hours ago. This is tokenized Nvidia, on Base, and it
> is still trading.
>
> Here's what's missing. I can post a chart with an arrow on it. I can tell you what I'd do.
> But there is no way to hand you a plan you can actually *run* — at your size, with your own
> risk.

*On screen:* the live product, a real quote, `100% · 5/5 · 24/7 · 25 bps`.

### S2 · 0:11–0:23 · A plan is a link

> Night Desk turns a trade plan into a link.
>
> Not a post. Not a feed. No followers, no chat, no group, no group admin. There is a link.
> Everything needed to run this plan is inside the URL — which is why it cannot rot, and why
> there is no database row it depends on.

*On screen:* the real plan page, then the URL itself in a pill.

### S3 · 0:23–0:36 · The levels, read back

> Here's a real plan. Entry, two forty. Target, two sixty-four. Stop, two oh two.
>
> The important word is **percentages**. A plan publishes *proportions*, not prices. When you
> mirror it, the app re-quotes against the live market and your balance, and you get levels
> that are yours.
>
> And that ember marker — it's not decoration. It sits where the exchange actually filled me.
> That's a fill, not a claim.

*On screen:* the level strip and the risk band, `$240.45` entry between `$202.66` and `$264.34`.

### S4 · 0:36–0:48 · Two signatures, your own bracket

> Mirroring is two signatures. The first is the entry. The second is your take-profit and
> stop-loss pair — signed by *your* key, over *your* levels, good-til-cancelled.
>
> That pair is a separate order on the exchange. Which is why **the author cannot exit you**:
> if they close their position, your bracket is still live. Your size is yours, your signature
> is yours, your exit cap is yours.
>
> A trade you can't exit isn't a product.

*On screen:* the mirror panel with both signatures described.

### S5 · 0:48–1:06 · Did they actually run it?

> Now — the obvious problem with anything social. Someone says they ran your plan. Did they?
>
> Every mirror *is* an order on the exchange, so I can read back what actually landed and
> compare it against what the plan asked for. Protection attached. Protection still live.
> Take-profit at the published level. Stop-loss at the published level. Levels on the correct
> side of the entry.
>
> **Five checks green. One hundred percent as published.** That's the difference between a
> claim and a fact you can check.
>
> And I'll be honest about what this is: it's a readout, not a control. Nothing forces a
> mirror to stay on the published levels. Where I can't tell, it says *unknown* — it never
> assumes the best.

*On screen:* the gauge at 100%, the five checks, the per-funder rows.

### S6 · 1:06–1:36 · **How the author earns when his trade is copied** ← the core

> So: how does the author actually get paid?
>
> Every mirror routes through Flash, and Flash charges an integrator fee — twenty-five basis
> points of the mirror's notional. On this trade that's **0.34 cents**. Night Desk passes
> **sixty percent** of that to whoever wrote the plan: **0.20 cents**.
>
> Read where that money comes from. It's paid by **the mirror's wallet**, never out of the
> author's position. He doesn't have to trade for a mirror to pay him. He doesn't need a
> follow. He publishes a plan, someone runs it, he earns.
>
> It's a ledger of obligation, not a contract — and that's deliberate. Flash pays exactly one
> integrator per order; it cannot split a fee across many authors. I'm not going to deploy a
> contract to fake a split.
>
> So the money moves through three states. **Estimated** while the order rests — a forecast,
> and never withdrawable. **Reconciled** once the fills settle, recomputed from what was
> actually charged on the entry *and* the bracket leg. **Claimed** once it's paid.
>
> And the punchline: **the payout function cannot even see an estimate.** That's not a UI
> rule, it's a property of the code. I can't accidentally pay out a projection.

*On screen:* the fee flow `$1.35 → 0.34¢ → 0.14¢ → 0.20¢`, then the three-state ladder.

### S7 · 1:36–1:46 · The board

> The board ranks plans on **realised profit** — money that actually settled, read back off the
> chain. Not screenshots. Not followers.
>
> And it separates the two numbers people confuse: *realised* is what's been booked,
> *unrealised* is what's still open. A plan whose fills haven't been read back yet gets an
> em-dash and sinks to the bottom, because **unpriced is not the same as flat**.

*On screen:* the board, the sort toggle, the one-row ranking.

### S8 · 1:46–1:52 · Close

> Plans, not signals. Authors, not influencers.
>
> Night Desk. Live on Base. The code's on GitHub.

---

## 3. Explaining each part — the detailed version

### 3.1 Why this is a product and not a demo of an API

The brief asks for a real product with the potential to become a company, with the sponsor's
API genuinely load-bearing inside it. So, concretely:

- **The bracket is not decoration.** Every mirror is executed as a Flash **bracket** order —
  the entry and the take-profit/stop-loss pair submitted as one signed unit. Remove Flash and
  there is no product: there's no way to attach an independent, signed exit to someone else's
  plan. That's the entire mechanism.
- **The fee is the business model, not a feature.** Flash's integrator fee is what makes an
  author worth following in the first place. Without it, a plan is a free tweet.
- **Tokenized equities are the premise.** Spot crypto doesn't have this problem — it never
  closes. The product only exists because tokenized NVDA trades at 3am while the NYSE doesn't.

### 3.2 Which advanced order type, and why it's load-bearing

**Bracket (take-profit + stop-loss attached to an entry).**

The social mechanic depends on one property: **each mirror's exit must be independent of the
author's.** If mirrors shared the author's position, then the author closing would close
everyone — and the product would be a liability. A bracket makes the exit a *separate signed
order, owned by the mirroring wallet*.

Concretely, from the live proof:

| | Mirror A (`0x8c2c…cab5`) | Mirror B (`0x59f8…2fb2`) |
| --- | --- | --- |
| Entry (market) | **$229.00** | **$240.45** |
| Take-profit | $266.98 | $264.34 |
| Stop-loss | $204.68 | $202.66 |
| Size | $1.35 (100% of wallet) | $1.35 (100% of wallet) |
| Bracket order | `78d38858…` | `72b7ce84…` |

Same plan. Different entry prices, because they were quoted minutes apart. Different bracket
levels, because each was derived from that wallet's own fill. **Two independent positions that
happen to share an intent.** That is the whole design in one table.

### 3.3 The plan link

A plan is a JSON object — author, asset, entry style, size percent, TP percent, SL percent,
timestamp, note — encoded as base64url into the URL. There is no server row required for the
link to work.

Two consequences worth stating out loud:

1. **The link cannot rot.** It carries its own contents.
2. **The link cannot be edited after the fact.** The plan's identity is a hash of its own
   fields, and the compliance readout compares the exchange against *that*, not against
   anything the app remembers.

Sizing is stored as **percentages**, never dollar amounts, because the whole point is that the
mirror's size is a proportion of *their* wallet — `100%` here means $1.35 for one wallet and
would mean $135 for another.

### 3.4 Compliance: measured, not mandated

Five checks, every one read back from the exchange by funder and order id:

1. Protection attached — the bracket exists on the entry.
2. Protection still live — the bracket has not been cancelled or closed.
3. Take-profit at the published level (within 0.5%).
4. Stop-loss at the published level (within 0.5%).
5. Levels sit on the correct side of the entry.

**Standing caveat, and it belongs in the pitch:** this is a readout, not a control. A mirror
that deviates is still that wallet's own position, and that independence is the product rather
than a flaw in it. `unknown` is never counted as a pass — where the read is incomplete, it says
so and excludes itself from the rate.

### 3.5 The author economy

| | |
| --- | --- |
| Fee charged | **25 bps** of the mirror's notional (`flashIntegratorFeeBps`) |
| Author share | **60%** of that fee |
| Who pays it | **the mirroring wallet** — never the author's position |
| Where it's held | an **off-chain ledger of obligation**, settled by a USDC transfer |
| Why off-chain | Flash pays exactly **one** integrator per order; it cannot split a fee across many authors, and faking that split with a contract would be a liability, not a feature |

Money is stored as **integer micro-USD**, and this is not fussiness. A $0.25 mirror at 25 bps
pays 625 µUSD; the author's 60% is 375 µUSD. In floating-point dollars that rounds to zero —
the author would be silently paid nothing, on exactly the small mirrors this product is built
to encourage.

**The three states**, and the guarantee behind each:

- `estimated` — an order was placed. A forecast. **Never payable**, filtered out by
  construction rather than by remembering to check.
- `reconciled` — the fills settled; recomputed from what was actually charged on the entry
  **and** the bracket leg (the pair charges its own fee — pay the entry alone and you underpay
  exactly the authors whose plans worked).
- `claimed` — a transfer was verified on Base and recorded. Terminal; a late fill report cannot
  reopen it.

**And the payout is checked, not trusted.** This is the one place money leaves the system, so
it is the one place worth being pedantic. `settle` will not record anything as paid until it
has read the transfer back off Base and found a USDC transfer to *that* author of at least the
amount owed. No hash, a reverted transaction, a transfer to a different address, a different
token, an underpayment — every one of those is refused with a reason, and the ledger is left
alone. A ledger that claims a payout that never happened is worse than one that says nothing,
because the author stops waiting.

**A mirror of your own plan accrues nothing.** You cannot owe yourself a fee. This is worth
mentioning unprompted, because it's the first thing a careful listener thinks of.

### 3.6 The ledger, live right now

Read from `GET /api/earnings?author=0x59f80641278f554aa921cbc6547c1823aafe2fb2`:

```
payable    0.20¢
estimated  $0.00
claimed    $0.00
records    1   (funder 0x8c2c…cab5, fee 3375 µUSD, author 2025 µUSD, state reconciled)
```

One mirror by a **different wallet**, one reconciled payable row. That is the model working
end to end on a real order.

### 3.7 The board

Ranked on **realised P&L** — only fills that actually settled. Sortable by Return %, Wallets,
or Most recent. The rule that matters: **a plan whose fills have not been read back is never
rendered as $0.00.** It is marked unpriced and sinks to the bottom, because ranking "not yet
read" as "broke even" is the single most dishonest thing this page could do.

### 3.8 What is deliberately *not* claimed

Say these before anyone asks. Every one of them makes the build stronger, not weaker:

- **A plan is not enforced.** A mirror is guided execution. Compliance is measured after the
  fact; nothing compels anyone to stay on the published levels.
- **The author cannot touch a mirror's money.** They never have custody, and they cannot exit
  anyone.
- **Author payouts are off-chain obligations**, settled in USDC from the integrator balance —
  not an on-chain split. Flash does not support splitting one order's fee. The *transfer* is
  verified on Base before the ledger records it, but the obligation itself is a database row,
  not a contract.
- **`/api/proof` is scoped to published plans.** Flash scopes order reads to a funder address,
  so there is no global feed of Flash trades to index. Every number on the board comes from a
  plan someone deliberately published.
- **This is a reference build.** Not financial advice, no figure here is an offer.

---

## 4. Answers to the track's specific questions

**Which Flash advanced order types power the social experience, and how?**

> **Bracket.** Every mirror executes as a bracket: the entry and its take-profit/stop-loss pair
> are quoted together and signed together. The bracket is what makes a *social* trade safe to
> hand to a stranger, because the protective pair is a separate order owned by the mirroring
> wallet — signed by their key over their levels, good-til-cancelled. If the plan's author
> closes their own position, every mirror's bracket stays live. Each mirror is therefore an
> independent position that shares an intent, not a shared position. The compliance readout
> then reads those bracket levels back off the exchange and compares them with what the plan
> published, which turns "N wallets mirrored this" from a claim into something checkable.

**How does the fee / revenue work?**

> Flash charges a 25 bps integrator fee on each mirror's notional. 60% is credited to the plan
> author, 40% is the platform's. The fee is paid by the mirroring wallet, never out of the
> author's position. It's tracked as an off-chain ledger of obligation in integer micro-USD
> and settles in USDC — Flash pays one integrator per order, so splitting it on-chain would
> require a contract, and the ledger is the honest version of that. Nothing is withdrawable
> until the fills settle and the amount is reconciled against what was actually charged on
> both the entry and the bracket leg.

**What's the business model?**

> Two-sided and it starts on day one, because the fee is charged per execution rather than per
> user. The platform takes 40% of a 25 bps integrator fee on every mirror; the author takes
> 60%. Night Desk's revenue grows with executed volume, and the author's cut is what makes
> writing a good plan worth someone's time. Subscriptions and signals both monetise attention;
> this monetises *execution*, which only happens when the plan was actually worth running.

**Is this just copy trading?**

> No, and the difference is the mechanism. Copy trading copies the *trade* — the follower's
> position shadows the leader's, and the leader's exit is the follower's exit. Night Desk
> copies the *plan*: proportions, not prices. Each mirror is quoted against the live market and
> its own balance, and signs its own bracket. Two mirrors opened an hour apart are two entirely
> independent positions. That's why the author can't exit you — there is nothing of theirs to
> exit you from.

---

## 5. The X post

Post this, then paste the permalink into the form's X link field.

> Tokenized stocks trade 24/7 on Base. But you can't share a *plan* someone else can run — only
> a chart with an arrow on it.
>
> So I built Night Desk for @DefinitiveFi's Flash track:
>
> Publish a plan as a link. Anyone runs it at their own size, with their own stop-loss attached
> as their own of Flash **bracket** order. The author can't exit you. And when you run their
> plan, the author gets 60% of the execution fee — paid by *your* wallet, not theirs.
>
> Live: night-desk-swart.vercel.app
> Code: github.com/Arinzaay007/night-desk
>
> #RuntimeAgentWeek

**Attach the video** (X supports it, and the track wants it posted). If you keep it under
2:20 it'll play natively.

---

## 6. Before you submit — checklist

- [ ] **Push the repo.** `github.com/Arinzaay007/night-desk` is at `9ad7074`; the two most
      important fixes are **not** on it (see below). The repo link is a required form field.
- [ ] Confirm the live URL loads in a fresh incognito tab: https://night-desk-swart.vercel.app
- [ ] Open the plan link and confirm the earnings panel reads **0.20¢ — PAYABLE**.
- [ ] Post on X tagging **@DefinitiveFi**, copy the permalink.
- [ ] Submit at https://runtime.nyc/submit with the live URL + the X permalink.

**The two missing commits are the two that make the pitch true:**

| Commit | What it fixes |
| --- | --- |
| `6810a19` | The header's wallet state. Without it the connect button stays stale and balances don't refresh — visible mid-demo. |
| `7972aa8` | **The author payment.** Without it, mirror mode files each mirror under the wrong author and the ledger never reconciles. A judge testing the pitch's central claim on that code would see $0.00. |

That is the difference between a repo that demonstrates the business model and one that
appears to disprove it. If the PAT isn't handy, there's a credential-free fallback at
`/home/user/night-desk-wallet-fix.bundle`.
