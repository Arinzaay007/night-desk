'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Steps } from '@/components/Steps';
import { WalletBar } from '@/components/WalletBar';
import { EQUITIES } from '@/lib/assets';
import {
  executePlan,
  requestQuote,
  warmUpApprovals,
  type ProgressStep,
  type QuoteMeta,
} from '@/lib/execute';
import { DRY_RUN } from '@/lib/dryRun';
import { usd } from '@/lib/format';
import { encodePlan, type Plan } from '@/lib/plan';
import type { WalletState } from '@/lib/useWallet';

interface AssetRow {
  symbol: string;
  name: string;
  address: string;
  price: number;
  volume24h: number;
}

interface PlanFormProps {
  mode: 'create' | 'mirror';
  initial?: Partial<Plan>;
  wallet: WalletState;
  /** Mirror mode: the author's address, shown for context. */
  authorLabel?: string;
}

export function PlanForm({ mode, initial, wallet, authorLabel }: PlanFormProps) {
  const [assets, setAssets] = useState<AssetRow[]>(
    EQUITIES.map(e => ({ symbol: e.symbol, name: e.name, address: e.address, price: 0, volume24h: 0 })),
  );
  const [symbol, setSymbol] = useState(initial?.s ?? 'NVDAc');
  const [entry, setEntry] = useState<'market' | 'limit'>(initial?.e ?? 'market');
  const [limitPrice, setLimitPrice] = useState(String(initial?.lp ?? ''));
  const [sizePct, setSizePct] = useState(String(initial?.z ?? 25));
  const [tpPct, setTpPct] = useState(String(initial?.tp ?? 20));
  const [slPct, setSlPct] = useState(String(initial?.sl ?? 8));
  const [note, setNote] = useState(initial?.m ?? '');

  const [preview, setPreview] = useState<QuoteMeta | null>(null);
  const [steps, setSteps] = useState<ProgressStep[]>([]);
  const [busy, setBusy] = useState<'idle' | 'preview' | 'execute' | 'warmup'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    orderId: string;
    bracketStatus?: string | null;
    link?: string;
    dryRun?: boolean;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  /**
   * Rehearsal size. Dry run only, and the whole point of it is that the mirror
   * flow can be walked — wallet prompts included — before either wallet holds
   * anything. The server ignores it outside dry run.
   */
  const [rehearseUsd, setRehearseUsd] = useState('1');

  useEffect(() => {
    fetch('/api/assets')
      .then(r => r.json())
      .then((payload: { ok?: boolean; assets?: AssetRow[] }) => {
        if (payload.ok && payload.assets?.length) setAssets(payload.assets);
      })
      .catch(() => undefined);
  }, []);

  const selected = useMemo(
    () => assets.find(a => a.symbol === symbol) ?? assets[0],
    [assets, symbol],
  );

  const buildPlan = (): Plan | null => {
    if (!wallet.address) return null;
    return {
      v: 1,
      a: wallet.address,
      n: initial?.n,
      t: selected?.address ?? '',
      s: symbol,
      e: entry,
      lp: entry === 'limit' ? Number(limitPrice || 0) : undefined,
      z: Number(sizePct),
      tp: Number(tpPct),
      sl: Number(slPct),
      m: note.trim() || undefined,
      ts: initial?.ts ?? Date.now(),
    };
  };

  const guard = (): string | null => {
    if (!wallet.signer) return 'Connect a wallet first.';
    if (!selected) return 'Pick an asset.';
    if (!(Number(sizePct) > 0)) return 'Size must be greater than zero.';
    if (entry === 'limit' && !(Number(limitPrice) > 0)) return 'Enter a limit price.';
    if (!(Number(tpPct) > 0) || !(Number(slPct) > 0)) return 'Set both a take-profit and a stop-loss.';
    /*
     * The floor is enforced by the server, which knows the policy and can quote
     * against the real balance. Hard-coding a higher bar here just blocked
     * wallets that were perfectly able to trade: this check used to demand $5,
     * which would have refused a $2 wallet on a deployment whose actual minimum
     * is the policy floor. So only an empty wallet is turned away.
     */
    if (!DRY_RUN && wallet.balance && wallet.balance.usdc <= 0) {
      return `This wallet holds ${usd(wallet.balance.usdc)} USDC on Base. Bridge or buy USDC on Base, or leave dry run on to rehearse the flow first.`;
    }
    return null;
  };

  const onPreview = async () => {
    const problem = guard();
    if (problem) return setError(problem);
    const plan = buildPlan();
    if (!plan) return;
    setError(null);
    setBusy('preview');
    setPreview(null);
    try {
      const bundle = await requestQuote(
        plan,
        wallet.address!,
        DRY_RUN ? Number(rehearseUsd) : undefined,
      );
      setPreview(bundle.meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not quote.');
    } finally {
      setBusy('idle');
    }
  };

  const onWarmUp = async () => {
    if (!wallet.signer || !selected) return;
    setError(null);
    setBusy('warmup');
    setSteps([]);
    try {
      const result = await warmUpApprovals(selected.address, symbol, wallet.signer, setSteps);
      setError(
        result.alreadyWarm
          ? null
          : `Approvals confirmed. ${symbol} is ready — the next trade needs signatures only.`,
      );
      await wallet.refreshBalance();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Warm-up failed.');
    } finally {
      setBusy('idle');
    }
  };

  const onExecute = async () => {
    const problem = guard();
    if (problem) return setError(problem);
    const plan = buildPlan();
    if (!plan || !wallet.signer) return;
    setError(null);
    setBusy('execute');
    setResult(null);
    try {
      const outcome = await executePlan(plan, wallet.signer, setSteps, {
        rehearseSpendUsd: DRY_RUN ? Number(rehearseUsd) : undefined,
      });
      const link =
        mode === 'create' ? `${window.location.origin}/p/${encodePlan(plan)}` : undefined;
      setResult({
        orderId: outcome.orderId,
        bracketStatus: outcome.bracketStatus,
        link,
        dryRun: outcome.dryRun,
      });
      await wallet.refreshBalance();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Execution failed.');
    } finally {
      setBusy('idle');
    }
  };

  const xText = result?.link
    ? `Published a trade plan on Night Desk.\n\n${symbol}: buy with ${sizePct}% of the wallet, ` +
      `take-profit +${tpPct}% / stop-loss -${slPct}% — and every mirror gets its OWN bracket, so the author exiting can't dump followers.\n\n` +
      `Mirror it (wallet on Base):\n${result.link}\n\nBuilt on @DefinitiveFi Flash advanced orders for @bankrbot Runtime Agent Week.`
    : '';

  /* ------------------------- success states ------------------------- */

  if (result?.link) {
    return (
      <div className="card card-accent">
        <span className={result.dryRun ? 'pill accent' : 'pill good'}>
          <span className="dot" />
          {result.dryRun ? 'Rehearsed — nothing submitted' : 'Plan live'}
        </span>
        <h2 style={{ marginTop: 14 }}>
          {result.dryRun ? 'Rehearsal complete. The link still works.' : 'Your plan is a link now.'}
        </h2>
        {result.dryRun && (
          <div className="notice warn" style={{ marginBottom: 14 }}>
            <strong>Dry run.</strong> The quote, the clamp, the reference price and both trigger
            levels above are real and live. Approvals, signatures and submission were skipped, so no
            money moved. Turn off <span className="mono">NEXT_PUBLIC_DRY_RUN</span> to place this for
            real.
          </div>
        )}
        <p>
          Anyone who opens it gets it re-quoted against <em>their</em> wallet and balance, with their
          own take-profit and stop-loss attached. Order{' '}
          <span className="mono">{result.orderId.slice(0, 8)}</span>
          {result.bracketStatus && !result.dryRun
            ? ` · bracket ${result.bracketStatus.replace(/_/g, ' ')}`
            : ''}
          .
        </p>
        <div className="share-box">{result.link}</div>
        <div className="row" style={{ marginTop: 12 }}>
          <button
            className="button small"
            onClick={() => {
              navigator.clipboard.writeText(result.link!);
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            }}
          >
            {copied ? 'Copied' : 'Copy link'}
          </button>
          <a
            className="button secondary small"
            href={`https://x.com/intent/post?text=${encodeURIComponent(xText)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Post to X (tags @DefinitiveFi)
          </a>
          <Link className="button ghost small" href="/desk">
            My desk
          </Link>
        </div>
        <p className="tiny dim" style={{ marginTop: 12 }}>
          Take-profit and stop-loss are stored as percentages, so every mirror sets its own absolute
          levels from the live price at mirror time. That is what makes the brackets independent.
        </p>
      </div>
    );
  }

  if (result && mode === 'mirror') {
    return (
      <div className="card card-accent">
        <span className={result.dryRun ? 'pill accent' : 'pill good'}>
          <span className="dot" />
          {result.dryRun ? 'Rehearsed — nothing submitted' : 'Mirror live'}
        </span>
        <h2 style={{ marginTop: 14 }}>
          {result.dryRun
            ? 'Rehearsal complete — this is the exact flow.'
            : 'You are in — with your own protection.'}
        </h2>
        {result.dryRun && (
          <div className="notice warn" style={{ marginBottom: 14 }}>
            <strong>Dry run.</strong> The quote, both signatures and the order payload were real —
            the signatures were made against live market levels. What was withheld is the onchain
            approvals, because they cost gas, and the outbound call to the exchange. Nothing was
            spent and nothing was submitted.
          </div>
        )}
        <p>
          Order <span className="mono">{result.orderId.slice(0, 8)}</span>
          {result.bracketStatus && !result.dryRun
            ? ` · bracket ${result.bracketStatus.replace(/_/g, ' ')}`
            : ''}
          . Your take-profit and stop-loss are attached to your position, not shared with the author.
        </p>
        {!result.dryRun && (
          <p className="tiny dim">
            Bracket status <span className="mono">pending activation</span> means the pair goes live
            the moment the entry fills.
          </p>
        )}
        <div className="row" style={{ marginTop: 12 }}>
          <Link className="button small" href="/desk">
            See it on my desk
          </Link>
          <button className="button ghost small" onClick={() => setResult(null)}>
            Mirror again
          </button>
        </div>
      </div>
    );
  }

  /* --------------------------- the form --------------------------- */

  const running = busy !== 'idle';

  return (
    <div className="grid grid-2">
      <div className="card">
        <div className="spread" style={{ marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>{mode === 'create' ? 'Compose a plan' : 'Mirror at your size'}</h3>
          {mode === 'mirror' && authorLabel && <span className="pill mono">{authorLabel}</span>}
        </div>

        <div className="field">
          <label className="label">Asset — tokenized equity on Base</label>
          <select
            className="select"
            value={symbol}
            onChange={e => setSymbol(e.target.value)}
            disabled={mode === 'mirror'}
          >
            {assets.map(asset => (
              <option key={asset.symbol} value={asset.symbol}>
                {asset.symbol} · {asset.name}
                {asset.price ? ` — ${usd(asset.price)}` : ''}
              </option>
            ))}
          </select>
          {selected?.volume24h ? (
            <p className="hint">
              {usd(selected.volume24h, 0)} traded in 24h · trades around the clock, including when
              the NYSE is shut
            </p>
          ) : null}
        </div>

        <div className="field">
          <label className="label">Entry</label>
          <div className="inline-fields">
            <select
              className="select"
              value={entry}
              onChange={e => setEntry(e.target.value as 'market' | 'limit')}
              disabled={mode === 'mirror'}
            >
              <option value="market">Market — now</option>
              <option value="limit">Limit — at a price</option>
            </select>
            {entry === 'limit' && (
              <input
                className="input num"
                inputMode="decimal"
                placeholder="Limit price, USD"
                value={limitPrice}
                onChange={e => setLimitPrice(e.target.value)}
              />
            )}
          </div>
        </div>

        <div className="field">
          <label className="label">
            Size — percent of the mirroring wallet, never a fixed amount
          </label>
          <input
            className="input num"
            inputMode="decimal"
            value={sizePct}
            onChange={e => setSizePct(e.target.value)}
            disabled={mode === 'mirror'}
          />
          <p className="hint">
            {wallet.balance
              ? `${sizePct || 0}% of your ${usd(wallet.balance.usdc)} ≈ ${usd((wallet.balance.usdc * Number(sizePct || 0)) / 100)}`
              : 'Connect a wallet to see what that comes to.'}
          </p>
        </div>

        <div className="inline-fields">
          <div className="field">
            <label className="label">Take-profit %</label>
            <input
              className="input num"
              inputMode="decimal"
              value={tpPct}
              onChange={e => setTpPct(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="label">Stop-loss %</label>
            <input
              className="input num"
              inputMode="decimal"
              value={slPct}
              onChange={e => setSlPct(e.target.value)}
            />
          </div>
        </div>

        {mode === 'create' && (
          <div className="field">
            <label className="label">Note — the thesis, optional</label>
            <textarea
              className="textarea"
              maxLength={280}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Why this trade, in one or two lines."
            />
          </div>
        )}

        <div className="row">
          <button className="button secondary" onClick={onPreview} disabled={running || !wallet.signer}>
            {busy === 'preview' ? 'Quoting…' : 'Preview levels'}
          </button>
          <button className="button" onClick={onExecute} disabled={running || !wallet.signer}>
            {busy === 'execute'
              ? 'Working…'
              : `${mode === 'create' ? 'Sign, execute & publish' : 'Sign, execute & mirror'}`}
          </button>
          {wallet.signer && selected && (
            <button
              className="button ghost small"
              onClick={onWarmUp}
              disabled={running}
              title="Send the two token approvals now so the trade itself needs only signatures"
            >
              Pre-warm {symbol}
            </button>
          )}
          {DRY_RUN && (
            <label
              className="row tiny dim"
              style={{ gap: 6, alignItems: 'center', marginLeft: 'auto' }}
              title="Dry run only: quote this size instead of your real balance, so the whole flow can be walked before either wallet is funded."
            >
              rehearse at
              <input
                className="input"
                style={{ width: 72 }}
                inputMode="decimal"
                value={rehearseUsd}
                onChange={e => setRehearseUsd(e.target.value)}
              />
              USDC
            </label>
          )}
        </div>

        {DRY_RUN && (
          <p className="tiny dim" style={{ marginTop: 10 }}>
            <strong>Rehearsal.</strong> The quote, both signatures and the order payload are all
            real; the approvals are skipped because they cost gas, and nothing is sent to the
            exchange. Set the size above to anything you like — your balance is not touched, and
            nothing lands on the board.
          </p>
        )}

        <p className="tiny dim" style={{ marginTop: 10 }}>
          A first bracket trade needs two onchain approvals. <strong>Pre-warm</strong> sends them
          now so the trade itself is two signature prompts — worth doing before you record.
        </p>

        {!wallet.signer && (
          <div style={{ marginTop: 16 }}>
            <WalletBar wallet={wallet} />
          </div>
        )}

        {error && (
          <div className="notice bad" style={{ marginTop: 14 }}>
            {error}
          </div>
        )}
      </div>

      <div className="card">
        <h3>What you are about to sign</h3>

        {preview ? (
          <dl style={{ margin: '4px 0 0' }}>
            <div className="kv">
              <dt>Spend</dt>
              <dd>{usd(preview.spendUsd)}</dd>
            </div>
            <div className="kv">
              <dt>Reference price</dt>
              <dd>{usd(preview.referencePrice)}</dd>
            </div>
            <div className="kv">
              <dt>Take-profit level</dt>
              <dd style={{ color: 'var(--good)' }}>
                {usd(preview.takeProfitPrice)} (+{tpPct}%)
              </dd>
            </div>
            <div className="kv">
              <dt>Stop-loss level</dt>
              <dd style={{ color: 'var(--bad)' }}>
                {usd(preview.stopLossPrice)} (−{slPct}%)
              </dd>
            </div>
            <div className="kv">
              <dt>Est. receive</dt>
              <dd>
                {Number(preview.receiveEstimate).toFixed(6)} {preview.symbol}
              </dd>
            </div>
            <div className="kv">
              <dt>Price impact</dt>
              <dd>{(preview.priceImpact * 100).toFixed(3)}%</dd>
            </div>
            <div className="kv">
              <dt>All-in est. fee</dt>
              <dd>
                {usd(preview.estimatedFeeUsd)}
                <span className="dim tiny">
                  {' '}
                  ({((preview.estimatedFeeUsd / preview.spendUsd) * 100).toFixed(1)}%)
                </span>
              </dd>
            </div>
          </dl>
        ) : (
          <p className="tiny dim">
            Preview to see the exact spend, the two trigger levels and the all-in fee before you sign
            anything.
          </p>
        )}

        <div className="divider" />

        <h3>Two signatures, one position</h3>
        <p className="tiny">
          The first signature is the entry. The second is the take-profit / stop-loss pair, signed
          good-til-cancelled. Because the pair is its own order, <strong>your exit does not depend on
          anyone else&apos;s</strong> — if the author closes their position, your bracket stays live.
        </p>

        {steps.length > 0 && (
          <>
            <div className="divider" />
            <Steps steps={steps} />
          </>
        )}
      </div>
    </div>
  );
}
