# Recording the demo

Target: **a 4–5 minute screen recording**, shot Saturday morning Lagos time, with the X post and the
submission form filled in by **6pm** — three hours before the 9pm deadline, so a failed upload is not
an emergency.

The recording window matters: the NYSE is shut, so the equities are ticking while every traditional
broker is dark. That is the product's whole point and it should be said out loud on camera.

---

## 1. Thirty minutes before you record

```bash
npm run demo:check -- --armed \
  --wallets 0xWALLET_A,0xWALLET_B \
  --plan "<the plan link you will open on camera>"
```

It exits non-zero on anything that would embarrass you live. The three it has already caught on this
deployment, in order of how much they would have hurt:

| It catches | Why it matters |
| --- | --- |
| **You are on the public Flash key** | Integrator fees on your mirrors would accrue to Definitive's demo integrator, not your org. The track asks for a monetised build — this is the difference between shipping the fee and merely describing it. Fix: `app.definitive.fi` → **More** → **Flash** → **Create Flash Key**. |
| **An empty wallet, or no ETH for gas** | Approvals are onchain. A wallet with USDC and no ETH fails at step 2 with the camera rolling. |
| **The ledger is not durable** | If you submit a *deployed* link, a redeploy empties the board a judge then sees. Set `UPSTASH_REDIS_REST_URL`/`_TOKEN`, or accept it and say so in the README. |

Then, in order:

- [ ] `NEXT_PUBLIC_DRY_RUN=0` in `.env.local`, restart the dev server. (It is `1` by default — this is
      the single easiest thing to forget, and it turns a real demo into a rehearsal.)
- [ ] Run it once **with dry run on** first. Free, and it puts the wallet prompts in your fingers.
- [ ] **Pre-warm both wallets** on `/create`: wallet A, then wallet B in its own profile, each pressing
      **Pre-warm NVDAc**. Two approvals now, for a few cents of gas, so the on-camera trade needs
      signatures only.
- [ ] Empty the board (`.data/store.json`) so the demo starts clean.
- [ ] Two browser profiles, wallet A in one and wallet B in the other. Never switch mid-recording.
- [ ] Plan link already open in a third tab, so beat 3 is a tab switch and not a paste.
- [ ] Notification silencing on, extensions off, 1080p, cursor visible.

---

## 2. The shot list

Each beat gives the exact control, what appears on screen, and what to say. The timings sum to about
4:30.

### Beat 1 — The claim (0:00–0:20) · `/`

> "The NYSE closed four hours ago. This is a tokenized NVDA on Base, and it's still trading. Here's
> what nobody has: a way to share a *plan* that someone else can actually run."

**On screen:** *"Publish a trade plan. Anyone can mirror it — with their own stop-loss."*

Say the last five words deliberately. They are the product.

### Beat 2 — Compose and publish (0:20–1:20) · `/create`

Wallet A connected. NVDAc, market entry, **20%**, **+8%**, **−5%**, one line of thesis.

1. Press **Preview levels**. **Expect a 3–8 second pause** — measured on this deployment at 2.8s to
   10.3s for the same call.
   > "While that quotes, the numbers come back pinned to *my* balance and the *live* price."

   The preview panel appears with the absolute stop and target.
2. Press **Sign, execute & publish**. If the approvals were pre-warmed, this is **two wallet prompts**
   and nothing else — the entry, then the protection pair. Say what each one is as it appears; a
   judge watching a signature prompt with no narration will assume it is a black box.
3. The confirmation card: order id, **bracket pending activation**, and the link.

The line that matters:
> "The bracket is *attached to this entry*. Take-profit and stop-loss are stored as percentages, so
> every mirror derives its own absolute levels from the price at *their* mirror time."

### Beat 3 — It is a link, not a post (1:20–1:50)

Switch to the tab with `/p/<id>`.

> "This is the whole social layer. There's no feed, no followers, no chat. There's a link. Everything
> needed to run this plan is in the URL — which is why it can't rot."

Scroll the plan card, then the **Mirror it** panel, then the **Proof** panel.

### Beat 4 — The second wallet (1:50–2:50)

In profile B: open the same link, connect wallet B, choose **their** size — deliberately different
(10%, not 20%) — then **Sign, execute & mirror**.

Then show the two positions, side by side or back to back on two screens.

> "Same plan. Different wallet. Different size. **Different absolute stop.**"

**Be honest about the stop numbers,** because a sharp judge will check: the levels are derived from
each mirror's own live reference price, so the two stops differ whenever the market has moved between
the two quotes and coincide when it has not. If they came out identical, say this:

> "The market didn't move between those two quotes, so the stops landed on the same number — the
> levels are a function of each wallet's own reference price. What's independent regardless is the
> size, the signature, and the exit cap: that pair can only ever sell what this wallet received."

That is the real claim, and it is stronger stated precisely.

### Beat 5 — Getting out (2:50–3:30) · `/desk`

> "A trade you can't exit isn't a product."

- Show a live position: entry status, **live** protection pill, **Show fills** → the fill and its
  transaction hash.
- Press **Cancel order** on any resting order, or **Close position** on a filled one.
- Name the subtlety while it runs: **Flash cancels a bracket pair separately from its entry.** So
  closing sells first, then cancels the pair — protection order matters, and a pair that fires
  mid-sell cannot oversell the position because its exit is capped.

### Beat 6 — The board (3:30–4:10) · `/board`

> "Ranked on realised profit and loss — money that actually settled, read back from the exchange. Not
> screenshots, not followers."

- Point at the **Realised P&L / Return % / Wallets** toggle and say why realised is the default and
  why Return % exists when every mirror picks its own size.
- Explain **what the columns will say today** before anyone reads them as a failure:
  > "Nothing has closed yet, so every plan books zero realised and the ranking falls through to open
  > performance. A plan whose fills haven't been read back yet sinks rather than being ranked flat —
  > unpriced is not the same as zero."

### Beat 7 — Proof (4:10–4:40) · back to the plan link

Open **Proof**: both mirrors read back by funder and order id — fills, venue, transaction hashes,
whether the protection activated and whether it fired.

> "Every number on this page can be clicked through to BaseScan. The whole point is that you don't
> have to take my word for any of it."

Close on the link itself.

---

## 3. Fallback beats

Recording a live market means something will eventually not cooperate. Decide the recovery **before**
it happens; the difference between a calm demo and a bad one is entirely preparation.

| If | Do | Say |
| --- | --- | --- |
| **A quote stalls past ~8s** | Wait. The client gives up at 15s, retries once, and tells you plainly what happened. If it still fails, press **Preview levels** again. | "That's a live quote against a real market — it's taking a while, and I'd rather show you the real latency than a canned number." |
| **The bracket sits at `pending activation`** | Nothing is wrong. The pair arms the moment the entry fills. | "Protection is attached and waiting — it goes live on the first fill. That's the venue's own status, not mine." |
| **Wallet B won't connect** | Switch it to **Use local key** with a pre-funded throwaway key. This is why profile B exists. | No narration needed — just do it quickly. |
| **Nothing fills while you're recording** | Do not fake it, and do not re-take hoping for a fill. Show the resting order and the proof panel, which is honest and still demonstrates the build. | "Entry is resting. The protection arms on the fill — that's rung 3 of our funded ladder." |
| **You want the money shot** | If a stop or target fires later, film a **30-second follow-up** with the app closed and cut it in. A trigger firing unattended is the strongest 30 seconds you can show. | — |

**The one thing never to do:** narrate a claimed outcome you did not show. This build's entire
advantage is that every claim is checkable on BaseScan. A single overstatement costs more than any
missing beat.

---

## 4. The submission

### The X post

Entry requires a post tagging **@DefinitiveFi** with a **`/status/` permalink** that goes into the
submission form. Publish ~1–2 hours before the deadline.

```
Night Desk — a trade plan you can actually run.

Someone publishes a plan as a link. You open it, and it's re-quoted against YOUR wallet,
at YOUR size, with YOUR OWN take-profit and stop-loss attached.

Every mirror is an independent bracket. The author cannot exit you out of your position.

Shareable plan links on tokenized equities, settled on Base. Built for @DefinitiveFi's
Flash track in Runtime Agent Week.

[link]
```

Then copy the **`/status/<id>` permalink** — not the profile URL, not the timestamp — and paste it
into the form.

### Checklist

- [ ] `npm run check`, `npm run rehearse`, and `npm run demo:check -- --armed` all pass
- [ ] Recording uploaded and the link plays in a private window (not just for you)
- [ ] README opens with what it is, how to run it, and a link to `TESTING.md`
- [ ] The advanced order type is **named in the post or the README** — an attached bracket, plus the
      limit and TWAP paths the preflight exercises
- [ ] Repo public, no secrets in it (`git log -p | grep -i dpka_` returns nothing)
- [ ] X post live, permalink copied
- [ ] Permalink pasted into the Runtime submission form
- [ ] Submitted **before Sat 19 Sep, 9:00pm Lagos** — aim for 6pm

### If you only have one hour

Rung 1 of `TESTING.md` — about four cents — plus a straight-through recording of beats 1, 2, 3 and 4.
That is a plan link, a real bracket, and a second wallet with its own protection. Everything else is
elaboration.
