# Track requirements: box by box

Measured against the Definitive Flash track text, as written. ✅ ticked · ⚠️ ticked but blocked or
unfinished · ❌ not done.

**Short version: every hard requirement is either done or blocked on an account-level action that
only you can take. Nothing is blocked on code.** Three of the four open items are free.

---

## Hard requirements

### ✅ Use one or more Flash advanced order types

**Bracket orders** — the core primitive, not a decoration. One quote returns **two signing payloads**:
the entry, and the take-profit / stop-loss pair. Both are signed by the funder and submitted together,
so one submit lands the position *with its protection attached*.

The README has a dedicated section (`Definitive Flash advanced orders used`) naming Bracket, the TP
and SL legs, Limit, and TWAP — because the submission form asks you to *explain which advanced order
types power the social experience*. Have that sentence ready for the form and the X post.

The product argument: **there is no path through the UI that produces an entry without its exit.** A
mirror cannot be made unprotected, because the bracket ships in the same quote.

### ⚠️ Build a new open-source project

New build ✅ · **open source — was not, now is.** As of this pass:

- `LICENSE` (MIT) added — *edit line 3 to your name or handle before you push*
- `git init` + an initial commit, **56 tracked files**, `.env.local` and `.data/` correctly ignored,
  verified no key in the tree
- `.env.example` now ships `NEXT_PUBLIC_DRY_RUN=1` (rehearsal). It shipped `0` (armed), which is the
  wrong greeting for someone who just cloned a repo they have never run.

**Still yours to do:** push it to GitHub and make it public. That is the *project link* the form asks
for, and right now it does not exist.

### ⚠️ Add Flash to an existing product, or build new for Runtime

New build specifically for Runtime ✅.

### ⚠️ Monetize the integration

The fee is real and verified: `flashIntegratorFeeBps` 25 rides on every order and appears in the
submission payload as `wouldSubmit.flashIntegratorFeeBps` — 25 bps, asserted in the rehearsal.

**But the box is not truly ticked yet.** You are on the public key from Definitive's docs, so those
fees accrue to their demo integrator rather than to you. `npm run demo:check -- --armed` reports this
as a blocker. It is the single highest-value five minutes left:

```
app.definitive.fi → More → Flash → Create Flash Key → paste into .env.local → restart
```

### ⚠️ Submit through Runtime

Yours to do. Select **Definitive Flash** under Sponsor track prizes.

### ⚠️ Post on X tagging @DefinitiveFi, with the post link in the form

The app has a **Post to X (tags @DefinitiveFi)** button that pre-fills the description, so this is a
click, a review, and a copy of the `/status/` permalink. Not done yet.

### ⚠️ Recorded demo (required for online submissions)

Required, not encouraged, because you are submitting remotely. `DEMO.md` has the shot list, the
fallback beats, and `npm run demo:check` to catch what would otherwise be discovered on camera.

### ⚠️ Share the project and demo links

The form asks for both. Neither exists yet:

| Link | What it should be | Cost |
| --- | --- | --- |
| Project | the public GitHub repo | free |
| Demo | the recording, or a deployed URL | free (Vercel) |

---

## Themes the track raises

### ✅ Trading as a shared experience

The track's own framing — *"follow other traders, exchange signals"* — is the thing this build
deliberately inverts. Copy trading makes the follower a passenger: the leader's size, the leader's
stop, and the leader exits you when they exit. Night Desk's plan carries **percentages, not prices**,
so nothing resolves until you know *whose* wallet and *what* price. Every mirror gets its own
quantity, its own absolute stop, its own signature. **The author has no ability to exit you.**

The rehearsal proves it rather than asserting it: two wallets, exit caps scaled to their own sizes,
distinct salts, distinct signatures.

### ✅ Leaderboards

`/board` ranks on **realised P&L from settled fills** read back from the exchange, with Return % and
Wallets a click away. Not followers, not screenshots. Unpriced plans sink rather than being ranked
flat, and unreadable ones say so.

### ❌ An agent

**We have no agent, and this is deliberate.** Your call in the original brainstorm was *"human
composes, agent demoted to optional plan author"* — and the agent never got built, not even the
optional-author version.

Worth being precise about what that costs us. The track text mentions agents three times: in the
opening sentence (*"build around an agent together"*), as a Flash capability (*MCP server, LLM-optimized
docs*), and as one idea bullet (*"an agent-run trading product that other users can follow"*). None of
those are in the **hard requirements** list, which asks only for an advanced order type, an
open-source project, a submission and an X post.

**My call: do not bolt one on.** The track's requirements don't ask for it, and a thin agent layer added
two days out would dilute the strongest thing this build has — a single coherent argument that a plan
is a link and a mirror is an independent bracket. Judges reward a sharp idea executed completely over a
broad idea executed thinly.

If you disagree and want the cheap hedge, it is genuinely about an hour: a plan is already just
base64 JSON, so add a `POST /api/plan` that accepts a plan object and returns the link, plus a README
section pointing Flash's MCP server at the plan schema. That makes *"an agent can author the plan; a
human still has to sign for it"* true, which is a defensible position — the agent proposes, the human
disposes. It is a real gap only if a judge reads "build around an agent" as mandatory.

---

## The one thing no checklist captures

Five things remain unproven and only money proves them: the settlement contract accepting our
signature, approvals landing, an entry filling, the bracket arming, a trigger firing.

Everything else is verified — **201 assertions**, a clean production build, and both dry-run and armed
states checked end to end. Rung 1 of `TESTING.md` costs **about four cents** and collapses that entire
list to one experiment.

If the money genuinely isn't there, submit anyway and let `README.md` say plainly what was and was not
verified. That is a defensible submission. What it costs is the end-to-end claim.

---

## Order of operations

1. **Swap the Flash key** — 5 min, free, and it is the difference between *shipping* the 25 bps fee
   and *describing* it.
2. **Push to GitHub, make it public, edit the LICENSE holder** — free.
3. **Deploy to Vercel** — free. Set `FLASH_API_KEY`, `INTEGRATOR_FEE_BPS=25`, `MIN_SPEND_USD`,
   `MAX_SPEND_USD`, `NEXT_PUBLIC_DRY_RUN=0`. Set `UPSTASH_REDIS_REST_URL`/`_TOKEN` too, or the board
   empties on the next redeploy — `demo:check` will remind you.
4. **Rung 1** — four cents, and it answers the five open questions.
5. **Record** — `DEMO.md`.
6. **Post on X, copy the `/status/` permalink.**
7. **Submit the form** — sponsor track, project link, demo link, advanced order types explained.
   Aim for **6pm Lagos**; the deadline is 9pm.
