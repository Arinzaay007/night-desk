# Night Desk — the pitch

Everything needed to write the X post, answer a judge, or fill in the form.
Short version first; the rest is ammunition.

---

## Ten seconds

**Night Desk turns a trade plan into a link someone else can actually run — with their own stop-loss.**

## Where it sits in the builder brief

| Category | Fit |
| --- | --- |
| **#2 New Trading Products & Interfaces** | **Home.** The brief names *social trading* and *copy trading* explicitly. |
| **#1 Tokenized Stocks & 24/7 Markets** | **The premise.** The brief asks for *"strategies that take advantage of the gap between traditional market hours and 24/7 crypto markets."* That is literally the night desk — the plan in the demo was published at midnight and is still runnable when the NYSE is shut. |
| **#14 Onchain Content & Creator Businesses** | **The business model.** *"Social products where creators and users can own, fund, trade or participate in the networks they help grow."* A plan that gets mirrored pays the person who wrote it. |

If the form asks for one: **#2**.

---

## The inversion (the real answer)

Every copy-trading product copies the **trade**. You follow someone, and when they exit, you exit.
You are on their schedule, at their size, in their risk.

Night Desk copies the **plan**. Each person who opens the link runs it themselves — their own size,
their own take-profit, their own stop-loss, their own money.

**The author cannot exit you.**

### Why it works: percentages, not prices

A plan never says "buy NVDA at $240, stop at $202." It says *20% of the wallet, +20% take-profit,
−8% stop-loss.*

Nothing is absolute until a wallet and a moment resolve it, so your $1.35 and a whale's $5,000
produce two genuinely different positions with two genuinely different stop prices — **not one trade
split two ways.**

That is why a mirror is a real, independent, exchange-held order rather than an instruction someone
has to trust.

---

## How Definitive comes in

**Flash is the execution layer. Night Desk is the social layer.** We don't touch order mechanics.

| Definitive Flash | Night Desk |
| --- | --- |
| Live pricing and routing | The link format |
| Order-signing payloads | Re-quoting per wallet |
| **Holding the bracket and firing it** | The board, proof, P&L |
| Landing the tx, MEV protection, gas, retries | The author earnings ledger |
| Non-custodial — nobody holds funds | Non-custodial — same |

**The four things the pitch actually depends on:**

1. **The bracket *is* a Flash order.** "You get your own stop-loss" is not a promise in a UI — it is
   a resting order on their engine, signed by your key. Without `attachedBracket` there is no product.
2. **Per-wallet quoting.** `/quote` prices against a specific funder and size, so a month-old link
   still resolves to a correct position the moment it is opened.
3. **Settlement and non-custody.** Approval-based, so nobody holds your money — which is what makes
   it safe to open a link from a stranger.
4. **Tokenized equities on Base.** They trade after the NYSE shuts. That is the whole premise.

**And it is load-bearing, not decorative:** the track is *Best Social Trading Build*, and the honest
point is that the social experience is only possible *because* the advanced orders exist. A shareable
plan with a real per-person stop-loss cannot be built on a spot swap.

---

## Is this "a demo built around a sponsor API"?

That is the bar the brief sets, so answer it head-on.

**What is genuinely ours:** the plan format, per-wallet re-pricing, the guarantee that no code path
produces an entry without its exit pair, the board ranked on realised P&L read back from real fills,
and the author share.

**What is genuinely theirs:** every order mechanic. Remove Flash and this does not exist.

**Why that is a business and not an integration:** a trading terminal is not "a demo built around a
brokerage API" even though it dies without the brokerage. The question is whether the *product* is
the value or the *plugin* is. Here the product is the link, the exit, and the creator payout.

**And the thing most hackathon entries cannot say:** this has real, verifiable revenue.
25 bps on every execution, collected on a live mainnet fill — `0.003375 USDC` on a $1.35 trade,
confirmed in the fill data. Most submissions have no revenue at all.

---

## The flywheel (why it could be a company)

```
author publishes a plan
      ↓
someone opens the link and runs it        ← the link is the distribution
      ↓
their bracket is theirs; you cannot exit them
      ↓
60% of the 25 bps fee is credited to the author
      ↓
author has a reason to publish the next one
```

Every mechanical part of that loop is built and tested: accrual, reconciliation against settled
fills (entry **and** bracket leg), an integer micro-USD ledger, and a two-step payout.

**The category this really is: a creator economy for trade plans.** Not a copy-trading app. The
author's work is verifiable onchain and they get paid per use.

### On a token (the brief raises it)

**Deliberately none.** The fee *is* the business model, and it is live. A token here would be a
shortcut to a headline rather than a product decision.

If it ever made sense, the shape is obvious: stake to publish, earn from mirrors, with the ledger
that already exists as the accounting. That is a v2 conversation, and saying so is stronger than
bolting one on in a weekend.

---

## Known limitations — say these before a judge finds them

Honest limits make a submission stronger. These are already in `README.md`; keep them there.

- **The plan is not enforced.** A mirrorer *chooses* to run the plan; nothing makes them. "Mirror" is
  guided execution, and compliance is social rather than technical.
- **No skin in the game, no slashing, no stake.** A bad author can post nonsense indefinitely; the
  only cost is that nobody mirrors them.
- **The author share is an off-chain obligation, not a contract.** Flash pays one integrator per
  order, so it cannot split a fee across many authors. The ledger records what is owed; `/payouts`
  settles it as a plain USDC transfer.
- **Small trades are fee-heavy.** On $1.35 the all-in cost was 8.2% — mostly the fixed network
  portion. At $25 it is under a percent. This is a floor problem, not a product problem.
- **One integration partner.** Every order mechanic is Flash's.

---

## Q&A for sharp questions

**"Isn't this just copy trading?"**
> No — copy trading gives you someone else's exit. This gives you your own. The author has no
> position over you and cannot take your money out. You sign every order with your own key.

**"What stops a bad author dumping on followers?"**
> Nothing to dump. Your bracket is signed by your key over your levels and fires on price, not on
> their say-so.

**"Why does this need advanced orders?"**
> The bracket *is* the product. Without a real take-profit/stop-loss pair per mirror, "your own exit"
> is just a promise in a UI.

**"How do you make money?"**
> 25 bps per execution, of which 60% goes to the plan's author. Verified live: 0.003375 USDC on a
> $1.35 fill.

**"What's the moat?"**
> Today, none — that is the honest answer. The wedge is that the fee pays creators, which is what
> makes there be plans worth running. The moat is the plan supply that produces.

---

## One line if you are truly squeezed

> **A trade plan you can share as a link, where everyone who opens it gets their own version.**
