import { NextResponse, type NextRequest } from 'next/server';
import {
  BASE_CHAIN,
  MAX_SPEND_USD,
  USDC,
  effectiveMinSpend,
  findEquity,
} from '@/lib/assets';
import {
  FlashError,
  attributionCode,
  describeFlashError, summariseFlashError,
  getBalances,
  integratorFeeBps,
  normaliseBalances,
  quote,
} from '@/lib/flash';
import { planKey, validatePlan, type Plan } from '@/lib/plan';
import type { QuoteResponse } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Nobody should be able to widen our slippage guard from the client. */
const MAX_SLIPPAGE = '0.03';

/**
 * Is this deployment rehearsing?
 *
 * Read from the server env rather than `lib/dryRun.ts`, which is a client
 * boundary. This decides whether a rehearsal size may be quoted for a wallet
 * that does not actually hold the money.
 */
const SERVER_DRY_RUN = process.env.NEXT_PUBLIC_DRY_RUN === '1';

const round2 = (n: number) => Number(n.toFixed(2));

async function usdcBalance(address: string): Promise<number> {
  const raw = await getBalances(address);
  const rows = normaliseBalances(raw as never);
  const match = rows.find(
    row => row.chain === BASE_CHAIN.slug && row.address?.toLowerCase() === USDC.address.toLowerCase(),
  );
  if (!match) return 0;
  return Number(match.notional ?? match.balance ?? 0) || 0;
}

/**
 * Turns a parametric plan into a concrete, funder-specific quote.
 *
 * Order of operations matters:
 *   1. work out what this wallet can actually spend (size % of its balance)
 *   2. establish a reference price (a tiny probe quote, or the plan's limit)
 *   3. convert the plan's TP/SL percentages into the absolute prices the
 *      bracket legs need
 *   4. ask for the real quote with the bracket attached
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      plan?: Plan;
      funderAddress?: string;
      /**
       * Rehearsal only. Quotes a size the wallet does not actually hold, so the
       * two-wallet mirror story — same plan, two wallets, different sizes, two
       * independent brackets — can be rehearsed before either wallet is funded.
       * Ignored entirely unless the server is in dry run, and clamped to the
       * same floor and ceiling a real order gets.
       */
      rehearseSpendUsd?: number;
    };
    const { plan, errors } = validatePlan(body.plan);
    const funderAddress = String(body.funderAddress ?? '');

    if (!plan) return NextResponse.json({ ok: false, error: errors.join(' ') }, { status: 400 });
    if (!/^0x[a-fA-F0-9]{40}$/.test(funderAddress)) {
      return NextResponse.json({ ok: false, error: 'Connect a wallet first.' }, { status: 400 });
    }

    const equity = findEquity(plan.s);
    if (!equity) {
      return NextResponse.json(
        { ok: false, error: `${plan.s} is not on our Base equity list.` },
        { status: 400 },
      );
    }

    const balance = await usdcBalance(funderAddress);
    const floor = effectiveMinSpend();

    const rehearseRaw = Number(body.rehearseSpendUsd);
    const rehearsing = SERVER_DRY_RUN && Number.isFinite(rehearseRaw) && rehearseRaw > 0;

    if (!rehearsing && balance < floor) {
      return NextResponse.json(
        {
          ok: false,
          error: `You need at least ${floor} USDC on Base to mirror a plan. This wallet holds ${balance.toFixed(2)}.`,
        },
        { status: 400 },
      );
    }

    const spendUsd = rehearsing
      ? round2(Math.min(Math.max(rehearseRaw, floor), MAX_SPEND_USD))
      : round2(Math.min(Math.max((balance * plan.z) / 100, floor), balance, MAX_SPEND_USD));
    const spendQty = spendUsd.toFixed(2);

    // 2. Reference price.
    let referencePrice: number;
    if (plan.e === 'limit' && plan.lp) {
      referencePrice = plan.lp;
    } else {
      const probe = await quote({
        targetChain: BASE_CHAIN.slug,
        contraChain: BASE_CHAIN.slug,
        targetAsset: equity.address,
        contraAsset: USDC.address,
        side: 'buy',
        qty: '20',
        orderType: 'market',
        funderAddress,
      });
      referencePrice = Number(probe.to.notional) / Number(probe.to.amount);
    }

    if (!Number.isFinite(referencePrice) || referencePrice <= 0) {
      return NextResponse.json({ ok: false, error: 'Could not establish a reference price.' }, { status: 502 });
    }

    // 3. Plan percentages -> absolute trigger prices.
    const takeProfitPrice = round2(referencePrice * (1 + plan.tp / 100));
    const stopLossPrice = round2(referencePrice * (1 - plan.sl / 100));

    if (stopLossPrice <= 0 || takeProfitPrice <= stopLossPrice) {
      return NextResponse.json(
        { ok: false, error: 'Those TP/SL levels are not a valid pair (take-profit must sit above stop-loss).' },
        { status: 400 },
      );
    }

    const feeBps = integratorFeeBps();

    /*
     * A bracketed limit entry is a special case. Flash rejects
     * `limitNotionalPrice` when the bracket block is attached:
     *
     *   "attached_bracket limit entries require limit_cross_price in v1
     *    (limit_notional_price is not supported with the block)"
     *
     * `limitCrossPrice` is the pair rate — target priced in the contra asset —
     * whereas `limitNotionalPrice` is the USD price of the target. Because the
     * contra asset here is USDC, the two are numerically the same for any
     * sensible peg, so the price the user typed is correct either way; only the
     * field name changes. Undocumented, and only found by exercising the real
     * API — see scripts/preflight.mjs.
     */
    const limitFields =
      plan.e === 'limit' && plan.lp
        ? { limitCrossPrice: String(plan.lp) }
        : {};

    // 4. The real quote, with protection attached.
    const quoteBody: Record<string, unknown> = {
      targetChain: BASE_CHAIN.slug,
      contraChain: BASE_CHAIN.slug,
      targetAsset: equity.address,
      contraAsset: USDC.address,
      side: 'buy',
      qty: spendQty,
      orderType: plan.e,
      funderAddress,
      maxSlippage: MAX_SLIPPAGE,
      flashIntegratorFeeBps: feeBps,
      attachedBracket: {
        takeProfit: { notionalPrice: takeProfitPrice.toString() },
        stopLoss: { notionalPrice: stopLossPrice.toString() },
      },
      ...limitFields,
    };

    const result = await quote(quoteBody);

    // The exact fields we must echo on submit. Built once, on the server, so
    // the client can never drift from the quote.
    const orderFields: Record<string, unknown> = {
      targetChain: BASE_CHAIN.slug,
      contraChain: BASE_CHAIN.slug,
      targetAsset: equity.address,
      contraAsset: USDC.address,
      side: 'buy',
      qty: spendQty,
      orderType: plan.e,
      funderAddress,
      flashIntegratorFeeBps: feeBps,
      maxSlippage: MAX_SLIPPAGE,
      planKey: planKey(plan),
      attachedBracketTakeProfit: { notionalPrice: takeProfitPrice.toString() },
      attachedBracketStopLoss: { notionalPrice: stopLossPrice.toString() },
      ...limitFields,
    };
    const code = attributionCode();
    if (code) orderFields.erc8021AttributionCode = code;

    const typed = result as QuoteResponse;

    return NextResponse.json({
      ok: true,
      quote: typed,
      orderFields,
      meta: {
        symbol: equity.symbol,
        balanceUsd: round2(balance),
        spendUsd,
        referencePrice: round2(referencePrice),
        takeProfitPrice,
        stopLossPrice,
        estimatedFeeUsd: Number(typed.fees?.estimatedFeeNotional ?? 0),
        priceImpact: Number(typed.estimatedPriceImpact ?? 0),
        receiveEstimate: typed.to?.amount ?? '0',
        limitPrice: plan.e === 'limit' ? plan.lp : null,
        /** True when the size was quoted for a rehearsal rather than a real balance. */
        rehearsal: rehearsing,
      },
    });
  } catch (error) {
    const status = error instanceof FlashError ? error.status : 500;
    console.error(`[${request.method} ${request.nextUrl.pathname}]`, describeFlashError(error));
    return NextResponse.json({ ok: false, error: summariseFlashError(error) }, { status });
  }
}
