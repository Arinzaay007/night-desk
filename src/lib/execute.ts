'use client';

import { DRY_RUN } from './dryRun';
import { cancelMessageFor } from './orders';
import { encodePlan, type Plan } from './plan';
import type { QuoteResponse } from './types';
import type { Signer } from './wallet';

export interface QuoteMeta {
  symbol: string;
  balanceUsd: number;
  spendUsd: number;
  referencePrice: number;
  takeProfitPrice: number;
  stopLossPrice: number;
  estimatedFeeUsd: number;
  priceImpact: number;
  receiveEstimate: string;
  limitPrice?: number | null;
  /** Set when this size was quoted for a rehearsal rather than a real balance. */
  rehearsal?: boolean;
}

export interface QuoteBundle {
  quote: QuoteResponse;
  orderFields: Record<string, unknown>;
  meta: QuoteMeta;
}

export interface ProgressStep {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'done' | 'error';
  detail?: string;
}

export interface ExecuteResult {
  orderId: string;
  bracketStatus?: string | null;
  meta: QuoteMeta;
  /** True when this was a rehearsal: quoted for real, nothing submitted. */
  dryRun?: boolean;
}

export class ExecuteError extends Error {
  step: string;
  constructor(step: string, message: string) {
    super(message);
    this.name = 'ExecuteError';
    this.step = step;
  }
}

const DRY_RUN_SKIP = 'skipped (dry run)';

/** Thrown to leave a step in dry run without the catch treating it as a failure. */
class SkipStep extends Error {}

const json = async (response: Response) => {
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok || payload.ok === false) {
    throw new Error(typeof payload.error === 'string' ? payload.error : `Request failed (${response.status})`);
  }
  return payload;
};

/**
 * Asks the server for a parametric quote against this wallet's own balance.
 *
 * `rehearseSpendUsd` quotes a size the wallet does not hold so the flow can be
 * walked before funding. The server ignores it unless it is in dry run.
 */
export async function requestQuote(
  plan: Plan,
  funderAddress: string,
  rehearseSpendUsd?: number,
): Promise<QuoteBundle> {
  const response = await fetch('/api/quote', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      plan,
      funderAddress,
      ...(rehearseSpendUsd && rehearseSpendUsd > 0 ? { rehearseSpendUsd } : {}),
    }),
  });
  const payload = await json(response);
  return payload as unknown as QuoteBundle;
}

export interface CloseQuote {
  quote: QuoteResponse;
  orderFields: Record<string, unknown>;
  meta: { symbol: string; qty: string; proceedsUsd: number; estimatedFeeUsd: number; priceImpact: number };
}

/**
 * Cancels a resting order. The message is constructed identically on the client
 * (signed) and the server (validated), from one shared helper, because Flash
 * compares the bytes exactly.
 */
export async function cancelOpenOrder(
  orderId: string,
  signer: Signer,
): Promise<{ orderId: string; closeReason?: string }> {
  const cancelMessage = cancelMessageFor(orderId);
  const userSignature = await signer.signMessage(cancelMessage);

  const payload = (await json(
    await fetch('/api/cancel', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orderId, funderAddress: signer.address, cancelMessage, userSignature }),
    }),
  )) as { orderId: string; closeReason?: string };

  return payload;
}

/**
 * Sends the two approvals a first bracket trade needs, ahead of time, so the
 * recorded trade itself is signatures only.
 *
 * The quote used to obtain them is discarded — nothing is placed.
 */
export async function warmUpApprovals(
  assetAddress: string,
  symbol: string,
  signer: Signer,
  onStep?: (steps: ProgressStep[]) => void,
): Promise<{ sent: number; alreadyWarm: boolean; message: string }> {
  const steps: ProgressStep[] = [{ id: 'warmup', label: `Checking allowances for ${symbol}`, status: 'pending' }];
  const emit = () => onStep?.(steps.map(s => ({ ...s })));
  const set = (status: ProgressStep['status'], detail?: string) => {
    steps[0].status = status;
    if (detail) steps[0].detail = detail;
    emit();
  };
  emit();

  if (DRY_RUN) {
    set('done', `${DRY_RUN_SKIP} — approvals skipped`);
    return { sent: 0, alreadyWarm: true, message: 'Dry run: approvals were not sent.' };
  }

  try {
    set('active');
    const payload = (await json(
      await fetch('/api/warmup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ assetAddress, funderAddress: signer.address }),
      }),
    )) as { approvals: { to: string; data: string; purpose: string }[]; alreadyWarm: boolean; note: string };

    if (payload.alreadyWarm) {
      set('done', 'already authorised');
      return { sent: 0, alreadyWarm: true, message: payload.note };
    }

    for (let i = 0; i < payload.approvals.length; i += 1) {
      const approval = payload.approvals[i];
      set('active', `${i + 1}/${payload.approvals.length} — ${approval.purpose}`);
      const hash = await signer.sendTransaction({ to: approval.to, data: approval.data });
      await awaitReceipt(hash, 'Approval');
    }

    set('done', `${payload.approvals.length} confirmed`);
    return { sent: payload.approvals.length, alreadyWarm: false, message: payload.note };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Warm-up failed.';
    set('error', message);
    throw new ExecuteError('warmup', message);
  }
}

/**
 * Closes a filled position: sell the whole balance into USDC, then cancel the
 * protective pair.
 *
 * Order matters. The sell goes first, because cancelling the brackets first
 * would leave the position briefly unprotected; and if the sell fails we have
 * changed nothing. Flash caps a bracket's exit at `signedMaxFromAmount`, so a
 * pair that triggers during the sell cannot oversell — the worst case is a
 * redundant, capped exit attempt.
 */
export async function closePosition(
  assetAddress: string,
  symbol: string,
  signer: Signer,
  bracketOrderIds: string[] = [],
  onStep?: (steps: ProgressStep[]) => void,
): Promise<{ orderId: string; proceedsUsd: number; cancelledBrackets: string[]; warnings: string[] }> {
  const steps: ProgressStep[] = [
    { id: 'quote', label: 'Quote the exit', status: 'pending' },
    { id: 'sign', label: 'Sign the sell', status: 'pending' },
    { id: 'submit', label: 'Sell into USDC', status: 'pending' },
    { id: 'cleanup', label: 'Cancel the protective pair', status: 'pending' },
  ];
  const emit = () => onStep?.(steps.map(s => ({ ...s })));
  const set = (id: string, status: ProgressStep['status'], detail?: string) => {
    const step = steps.find(s => s.id === id);
    if (step) {
      step.status = status;
      if (detail) step.detail = detail;
    }
    emit();
  };
  const warnings: string[] = [];
  emit();

  if (DRY_RUN) {
    set('quote', 'done', DRY_RUN_SKIP);
    set('sign', 'done', DRY_RUN_SKIP);
    set('submit', 'done', DRY_RUN_SKIP);
    set('cleanup', 'done', DRY_RUN_SKIP);
    return { orderId: `dry-run-${Date.now().toString(36)}`, proceedsUsd: 0, cancelledBrackets: [], warnings };
  }

  // 1. Exit quote, sized from the live balance.
  set('quote', 'active');
  let bundle: CloseQuote;
  try {
    bundle = (await json(
      await fetch('/api/close', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ funderAddress: signer.address, assetAddress, symbol }),
      }),
    )) as unknown as CloseQuote;
    set('quote', 'done', `Selling ${Number(bundle.meta.qty).toFixed(6)} ${symbol}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not quote the exit.';
    set('quote', 'error', message);
    throw new ExecuteError('quote', message);
  }

  // 2. Sign.
  set('sign', 'active');
  let userSignature: string;
  try {
    if (!bundle.quote.evm?.orderTypedData) throw new Error('Flash did not return an order payload.');
    userSignature = await signer.signTypedData(bundle.quote.evm.orderTypedData);
    set('sign', 'done');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Signing failed.';
    set('sign', 'error', message);
    throw new ExecuteError('sign', message);
  }

  // 3. Sell.
  set('submit', 'active');
  let orderId: string;
  try {
    const payload = (await json(
      await fetch('/api/order', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          orderFields: bundle.orderFields,
          quoteId: bundle.quote.quoteId,
          userSignature,
          evmOrderTypedData: bundle.quote.evm?.orderTypedData,
        }),
      }),
    )) as { orderId: string };
    orderId = payload.orderId;
    set('submit', 'done', `Exit ${orderId.slice(0, 8)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sell failed.';
    set('submit', 'error', message);
    throw new ExecuteError('submit', message);
  }

  // 4. Cancel the protective pair. Flash treats a bracket as a separate order,
  //    so a closed position would otherwise leave a live order behind.
  set('cleanup', 'active');
  const cancelledBrackets: string[] = [];
  for (const bracketId of bracketOrderIds) {
    try {
      await cancelOpenOrder(bracketId, signer);
      cancelledBrackets.push(bracketId);
    } catch (error) {
      warnings.push(
        `Exit filled, but the protective pair ${bracketId.slice(0, 8)} could not be cancelled: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }
  if (warnings.length) set('cleanup', 'error', `${warnings.length} pair(s) left live`);
  else if (cancelledBrackets.length) set('cleanup', 'done', `${cancelledBrackets.length} pair(s) cancelled`);
  else set('cleanup', 'done', 'No pair to cancel');

  return { orderId, proceedsUsd: bundle.meta.proceedsUsd, cancelledBrackets, warnings };
}

async function awaitReceipt(hash: string, label: string): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await fetch(`/api/receipt?hash=${hash}`);
    const payload = (await response.json().catch(() => ({}))) as { status?: string; ok?: boolean };
    if (payload.status === 'success') return;
    if (payload.status === 'reverted') throw new Error(`${label} reverted onchain.`);
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error(`${label} is taking unusually long to confirm. Check BaseScan and try again.`);
}

/**
 * The full trade: quote → approvals → sign (twice for a bracket) → submit.
 *
 * Every mirror is quoted fresh for the mirroring wallet, which is why plans
 * are parametric and why one plan produces independent brackets rather than a
 * single shared position.
 */
export async function executePlan(
  plan: Plan,
  signer: Signer,
  onStep?: (steps: ProgressStep[]) => void,
  options?: { rehearseSpendUsd?: number },
): Promise<ExecuteResult> {
  const steps: ProgressStep[] = [
    { id: 'quote', label: 'Quote against your wallet', status: 'pending' },
    { id: 'approve', label: 'Authorise tokens', status: 'pending' },
    { id: 'sign', label: 'Sign entry + protection', status: 'pending' },
    { id: 'submit', label: 'Submit to Flash', status: 'pending' },
  ];
  const emit = () => onStep?.(steps.map(s => ({ ...s })));
  const set = (id: string, status: ProgressStep['status'], detail?: string) => {
    const step = steps.find(s => s.id === id);
    if (step) {
      step.status = status;
      if (detail) step.detail = detail;
    }
    emit();
  };

  emit();

  // 1. Quote (fresh, against this wallet's balance)
  set('quote', 'active');
  const bundle = await requestQuote(plan, signer.address, options?.rehearseSpendUsd).catch(error => {
    set('quote', 'error', error.message);
    throw new ExecuteError('quote', error.message);
  });
  set('quote', 'done', `Spending ${bundle.meta.spendUsd.toFixed(2)} USDC`);

  const { quote, orderFields } = bundle;

  // 2. Approvals. A first bracket trade needs two: the spent asset and, for
  //    the exit pair, the received asset the bracket is allowed to sell.
  //
  //    Rehearsal: this is the only step dry run skips, because it is the only
  //    one that moves money and costs gas. Signing and submission are free, so
  //    they run for real below — an earlier version skipped those too, which
  //    meant the rehearsal carefully avoided the two steps most likely to fail
  //    on camera. `POST /api/order` recognises the rehearsal and stops just
  //    short of Flash.
  set('approve', DRY_RUN ? 'done' : 'active', DRY_RUN ? `${DRY_RUN_SKIP} — onchain, costs gas` : undefined);
  try {
    if (DRY_RUN) throw new SkipStep();
    const approvals = [
      quote.evm?.approveTx ?? null,
      quote.attachedBracket?.evm?.approveTx ?? null,
    ].filter(Boolean) as { to: string; data: string }[];

    if (!approvals.length) {
      set('approve', 'done', 'Already authorised');
    } else {
      for (let i = 0; i < approvals.length; i += 1) {
        set('approve', 'active', `Transaction ${i + 1} of ${approvals.length}`);
        const hash = await signer.sendTransaction({ to: approvals[i].to, data: approvals[i].data });
        await awaitReceipt(hash, 'Token approval');
      }
      set('approve', 'done', `${approvals.length} approval${approvals.length > 1 ? 's' : ''} confirmed`);
    }
  } catch (error) {
    if (error instanceof SkipStep) {
      // Deliberate: the approvals were skipped above.
    } else {
      const message = error instanceof Error ? error.message : 'Approval failed.';
      set('approve', 'error', message);
      throw new ExecuteError('approve', message);
    }
  }

  // 3. Signatures — entry first, then the protection pair.
  set('sign', 'active');
  let userSignature: string;
  let evmOrderTypedData: string | undefined;
  let evmPermitSignature: string | undefined;
  let evmPermitTypedData: string | undefined;
  let attachedBracket: Record<string, unknown> | undefined;

  try {
    if (!quote.evm?.orderTypedData) throw new Error('Flash did not return an order payload.');

    userSignature = await signer.signTypedData(quote.evm.orderTypedData);
    evmOrderTypedData = quote.evm.orderTypedData;

    if (quote.evm.permitTypedData) {
      evmPermitSignature = await signer.signTypedData(quote.evm.permitTypedData);
      evmPermitTypedData = quote.evm.permitTypedData;
    }

    if (quote.attachedBracket?.evm?.orderTypedData) {
      // Second signature: the take-profit / stop-loss pair. The pair is
      // good-til-cancelled and lives independently of the author's exit.
      const bracketSignature = await signer.signTypedData(quote.attachedBracket.evm.orderTypedData);
      attachedBracket = {
        takeProfit: orderFields.attachedBracketTakeProfit,
        stopLoss: orderFields.attachedBracketStopLoss,
        userSignature: bracketSignature,
        salt: quote.attachedBracket.salt,
        deadline: quote.attachedBracket.deadline,
        signedMaxFromAmount: quote.attachedBracket.signedMaxFromAmount,
      };

      if (quote.attachedBracket.evm.permitTypedData) {
        (attachedBracket as Record<string, unknown>).evmPermitSignature =
          await signer.signTypedData(quote.attachedBracket.evm.permitTypedData);
        (attachedBracket as Record<string, unknown>).evmPermitTypedData =
          quote.attachedBracket.evm.permitTypedData;
      }
    }
    set('sign', 'done', attachedBracket ? 'Entry + bracket signed' : 'Entry signed');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Signing failed.';
    set('sign', 'error', message);
    throw new ExecuteError('sign', message);
  }

  // 4. Submit. The server echoes our order fields straight back to Flash.
  set('submit', 'active');
  try {
    const payload = (await json(
      await fetch('/api/order', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          orderFields,
          quoteId: quote.quoteId,
          bridgeQuoteId: quote.bridgeQuoteId ?? undefined,
          userSignature,
          evmOrderTypedData,
          evmPermitSignature,
          evmPermitTypedData,
          attachedBracket,
          ledger: {
            planKey: (orderFields as { planKey?: string }).planKey,
            /*
             * The shareable link itself. Plans live entirely in their URL, and the
             * planKey is only a grouping hash — so without this the board could
             * rank a plan but not link back to it.
             */
            planId: encodePlan(plan),
            symbol: bundle.meta.symbol,
            author: plan.a,
            note: plan.m,
            sizePct: plan.z,
            tpPct: plan.tp,
            slPct: plan.sl,
            spendUsd: bundle.meta.spendUsd,
            takeProfitPrice: bundle.meta.takeProfitPrice,
            stopLossPrice: bundle.meta.stopLossPrice,
          },
        }),
      }),
    )) as { orderId: string; bracketStatus?: string | null; dryRun?: boolean };

    set(
      'submit',
      'done',
      payload.dryRun ? 'Rehearsed in full — nothing sent' : `Order ${payload.orderId.slice(0, 8)}`,
    );
    return {
      orderId: payload.orderId,
      bracketStatus: payload.bracketStatus,
      meta: bundle.meta,
      dryRun: payload.dryRun === true,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Submit failed.';
    set('submit', 'error', message);
    throw new ExecuteError('submit', message);
  }
}
