# Night Desk — pitch video narration

**Length target: ~1:55.** Beats are ordered to follow the actual page order on the live
plan page (hero → level strip → mirror panel → compliance → earnings → board), so the
narration never describes something that is not on screen.

Every figure quoted is read from the live deployment. Nothing here is estimated.

---

## S1 · Home · 0:00–0:10 *(10s)*

> The New York Stock Exchange closed four hours ago. This is tokenized Nvidia on Base,
> still trading. What nobody has is a way to share a plan someone else can actually run.

## S2 · The plan link · 0:10–0:24 *(14s)*

> Night Desk turns a trade plan into a link. Anyone who opens it runs it at their own
> size, with their own stop-loss, attached as their own order. The author can't exit
> them, and can't touch their money. It's a plan, not a position.

## S3 · Level strip + risk band · 0:24–0:37 *(13s)*

> Here's a real plan. Entry, two hundred forty forty-five. Target, two sixty-four. Stop,
> two oh two. That marker sits at the price the exchange actually filled — a fill, not a
> claim. And the market has moved against it.

## S4 · Mirror panel · 0:37–0:49 *(12s)*

> Mirroring is two signatures. The first is the entry. The second is the protective pair,
> signed by your key over your levels, good-til-cancelled. If the author closes their
> position, your bracket stays live.

## S5 · Compliance readout · 0:49–1:07 *(18s)*

> Did they actually run it? Every mirror is an order on the exchange, so the protection
> that landed gets read back and compared against what the plan asked for. Five checks
> green. One hundred percent as published. That's a fact you can check, not a claim.

## S6 · How the author earns · 1:07–1:44 *(37s)* ← the core

> Now — how does the author get paid? Every mirror routes through Flash, and Flash charges
> an integrator fee, twenty-five basis points of the mirror's notional. Paid by the mirror.
> Not by the author. Night Desk passes sixty percent of that fee to whoever wrote the plan.
>
> It's a ledger of obligation, not a contract. Flash pays exactly one integrator, and we
> will not deploy a contract to fake a split.
>
> The money moves through three states. Estimated, while the order rests. Reconciled, once
> the fills settle. Claimed, once it's paid. An estimate is never withdrawable — the payout
> function cannot even see one.
>
> And a wallet mirroring its own plan is skipped, because you can't owe yourself.

## S7 · The board · 1:44–1:55 *(11s)*

> Plans rank on realised profit — money that settled, read back off the chain. The exchange
> closed four hours ago. The plan still ran.

---

## The answer to "how does the author earn", in one place

1. **Who pays.** The mirror's wallet, not the author's. Flash charges an integrator fee of
   **25 bps** on the mirror's notional.
2. **Who gets it.** Night Desk credits **60%** of that fee to the plan's author.
3. **How it's held.** An **off-chain ledger of obligation** — Flash pays exactly one
   integrator per order and cannot split a fee across many authors. No contract was
   deployed to fake that split.
4. **When it's real.** `estimated` (order resting — a forecast, **never payable**) →
   `reconciled` (fills settled; recomputed from the entry order **and** the bracket leg,
   which charges its own fee) → `claimed` (transfer broadcast, terminal).
5. **When it's skipped.** A wallet mirroring **its own** plan accrues nothing — you can't
   owe yourself. This is why the ledger reads $0.00 today: the one live mirror is
   self-mirrored.
6. **Why integer micro-USD.** A $0.25 mirror at 25 bps pays 625 µUSD; 60% is 375 µUSD.
   In float dollars that rounds to zero — which would silently pay authors nothing on
   exactly the small mirrors this product is built for.

**Worked example, at the live numbers.** The real $1.35 mirror was charged an integrator
fee of **3375 µUSD (0.34¢)**. If that mirror had come from *another* wallet, the author
would have been owed **2025 µUSD — 0.20¢** — a real, reconciled, withdrawable row.
