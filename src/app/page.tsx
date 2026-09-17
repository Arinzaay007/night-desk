import Link from 'next/link';
import { Header } from '@/components/Header';
export default function HomePage() {
  return (
    <>
      <Header />
      <main className="shell">
        <section className="hero">
          <p className="eyebrow">Runtime Agent Week · Definitive Flash track</p>
          <h1>
            Publish a trade plan.
            <br />
            Anyone can mirror it —<br />
            with their own stop-loss.
          </h1>
          <p className="lede">
            Night Desk turns a plan into a link. Someone opens it, and it is re-quoted against{' '}
            <em>their</em> wallet and balance, with their own take-profit and stop-loss attached. The
            author cannot exit you out of your position.
          </p>
          <div className="row" style={{ marginTop: 26 }}>
            <Link className="button" href="/create">
              Compose a plan
            </Link>
            <Link className="button secondary" href="/board">
              See published plans
            </Link>
          </div>
        </section>

        <section className="section">
          <div className="grid grid-3">
            <div className="card">
              <h3>Parametric by construction</h3>
              <p className="tiny">
                A plan is a <strong>percentage of the wallet</strong>, not a copy of someone&apos;s
                position. Every mirror needs a fresh quote against a different balance, so a follower
                with $50 gets a proportional position instead of inheriting a whale&apos;s size.
              </p>
            </div>
            <div className="card">
              <h3>Brackets that stand alone</h3>
              <p className="tiny">
                Each mirror signs its own take-profit and stop-loss pair, good-til-cancelled. When the
                author closes, your protection stays on. That is the difference between a signal and a
                shared exit.
              </p>
            </div>
            <div className="card">
              <h3>Scored on real fills</h3>
              <p className="tiny">
                The board is ranked on realised P&amp;L — profit that actually settled, read back
                from the exchange rather than from a screenshot. A plan that booked money outranks a
                plan forty wallets copied into a loss. Reputation you can audit, and an author fee
                paid out of the trade fee on every mirror.
              </p>
            </div>
          </div>
        </section>

        <section className="section">
          <h2>Why tokenized equities</h2>
          <div className="grid grid-2">
            <div>
              <p>
                The NYSE closes at 4pm. Tokenized equities on Base do not. A plan published at midnight
                can still be entered, and a stop-loss can still fire, while every traditional broker is
                dark — a twenty-four hour market where the protection matters more, not less.
              </p>
              <p className="tiny dim">
                Night Desk trades tokenized equities (NVDAc, METAc, GOOGLc, AAPLc, TSLAc, AMZNc, MSFTc)
                against USDC on Base through the Definitive Flash API.
              </p>
            </div>
            <div className="card card-tight">
              <h3>The mechanics, plainly</h3>
              <p className="tiny" style={{ marginBottom: 10 }}>
                <strong>1.</strong> Compose — asset, entry, size, take-profit and stop-loss.
              </p>
              <p className="tiny" style={{ marginBottom: 10 }}>
                <strong>2.</strong> Sign twice — the entry, then the protective pair. One order lands.
              </p>
              <p className="tiny" style={{ marginBottom: 10 }}>
                <strong>3.</strong> Publish — the plan becomes a link. That link is the post.
              </p>
              <p className="tiny" style={{ marginBottom: 0 }}>
                <strong>4.</strong> Mirror — one tap, your size, your own brackets.
              </p>
            </div>
          </div>
        </section>

        <footer className="footer">
          <span>
            Built for Runtime Agent Week · execution by Definitive Flash advanced orders (Bracket,
            Limit, TWAP, Trigger) on Base.
          </span>
          <span className="dim">Demo software. Not financial advice.</span>
        </footer>
      </main>
    </>
  );
}
