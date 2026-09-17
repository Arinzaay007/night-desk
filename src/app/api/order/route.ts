import { NextResponse, type NextRequest } from 'next/server';
import { FlashError, describeFlashError, summariseFlashError, submitOrder } from '@/lib/flash';
import { recordMirror } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface OrderBody {
  orderFields?: Record<string, unknown>;
  quoteId?: string;
  bridgeQuoteId?: string;
  userSignature?: string;
  evmOrderTypedData?: string;
  evmPermitSignature?: string;
  evmPermitTypedData?: string;
  attachedBracket?: Record<string, unknown>;
  ledger?: {
    planKey?: string;
    planId?: string;
    symbol?: string;
    author?: string;
    note?: string;
    sizePct?: number;
    tpPct?: number;
    slPct?: number;
    spendUsd?: number;
    takeProfitPrice?: number;
    stopLossPrice?: number;
  };
}

/**
 * Is this deployment rehearsing?
 *
 * Read from the server env rather than importing `lib/dryRun.ts`, because that
 * module is a client boundary and this decision has to be made on the server,
 * where the trade would actually be sent.
 */
const SERVER_DRY_RUN = process.env.NEXT_PUBLIC_DRY_RUN === '1';

/**
 * What a rehearsal reports back.
 *
 * Dry run stops *after* every validation and after the body has been assembled,
 * and exactly before the network call. That is deliberate: the point of a
 * rehearsal is to exercise the routes the demo will really use, so the version
 * that skipped this route entirely was testing the one thing that could not
 * break. Signatures are summarised, never echoed — they are large and there is
 * no reason to hand them back.
 */
function rehearsalSummary(submitBody: Record<string, unknown>, planKey?: string) {
  const bracket = submitBody.attachedBracket as
    | { takeProfit?: Record<string, unknown>; stopLoss?: Record<string, unknown> }
    | undefined;

  return {
    planKey: planKey ?? null,
    orderType: submitBody.orderType ?? null,
    side: submitBody.side ?? null,
    targetAsset: submitBody.targetAsset ?? null,
    contraAsset: submitBody.contraAsset ?? null,
    targetChain: submitBody.targetChain ?? null,
    qty: submitBody.qty ?? null,
    funderAddress: submitBody.funderAddress ?? null,
    limitCrossPrice: submitBody.limitCrossPrice ?? null,
    maxSlippage: submitBody.maxSlippage ?? null,
    maxPriceImpact: submitBody.maxPriceImpact ?? null,
    flashIntegratorFeeBps: submitBody.flashIntegratorFeeBps ?? null,
    erc8021AttributionCode: submitBody.erc8021AttributionCode ?? null,
    twapBucketCount: submitBody.twapBucketCount ?? null,
    startTime: submitBody.startTime ?? null,
    triggerCount: Array.isArray(submitBody.triggers) ? submitBody.triggers.length : 0,
    bracket: bracket
      ? {
          hasTakeProfit: Boolean(bracket.takeProfit),
          hasStopLoss: Boolean(bracket.stopLoss),
          takeProfit: bracket.takeProfit ?? null,
          stopLoss: bracket.stopLoss ?? null,
        }
      : null,
    signed: {
      entry: typeof submitBody.userSignature === 'string' && submitBody.userSignature.startsWith('0x'),
      evmOrderTypedData: typeof submitBody.evmOrderTypedData === 'string',
      permit: typeof submitBody.evmPermitSignature === 'string',
    },
    quoteId: submitBody.quoteId ?? null,
  };
}

/**
 * Submits a signed order. The trade fields come back from /api/quote verbatim,
 * so the only thing the client contributes is signature material.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as OrderBody;
    const { orderFields, quoteId, userSignature, evmOrderTypedData } = body;

    if (!orderFields || typeof orderFields !== 'object') {
      return NextResponse.json({ ok: false, error: 'Missing order fields.' }, { status: 400 });
    }
    if (!quoteId) return NextResponse.json({ ok: false, error: 'Missing quoteId.' }, { status: 400 });
    if (!userSignature) return NextResponse.json({ ok: false, error: 'Missing signature.' }, { status: 400 });

    const {
      attachedBracketTakeProfit,
      attachedBracketStopLoss,
      planKey: planKeyValue,
      ...tradeFields
    } = orderFields as Record<string, unknown> & {
      attachedBracketTakeProfit?: unknown;
      attachedBracketStopLoss?: unknown;
      planKey?: string;
    };

    const submitBody: Record<string, unknown> = {
      ...tradeFields,
      quoteId,
      userSignature,
      evmOrderTypedData,
    };
    if (body.bridgeQuoteId) submitBody.bridgeQuoteId = body.bridgeQuoteId;
    if (body.evmPermitSignature) submitBody.evmPermitSignature = body.evmPermitSignature;
    if (body.evmPermitTypedData) submitBody.evmPermitTypedData = body.evmPermitTypedData;

    if (attachedBracketTakeProfit && attachedBracketStopLoss && body.attachedBracket) {
      submitBody.attachedBracket = {
        takeProfit: attachedBracketTakeProfit,
        stopLoss: attachedBracketStopLoss,
        ...body.attachedBracket,
      };
    }

    /*
     * The rehearsal stops here.
     *
     * Everything above this line has run for real: the route parsed the body,
     * rejected anything unsigned, and assembled the exact payload Flash would
     * receive. This branch replaces the single outbound call. Note that it does
     * NOT write the ledger — a rehearsal must never leave a row on the real
     * board for somebody else to read as a real position.
     */
    if (SERVER_DRY_RUN) {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        orderId: `dry-run-${Date.now().toString(36)}`,
        bracketStatus: submitBody.attachedBracket ? 'SIMULATED' : null,
        wouldSubmit: rehearsalSummary(submitBody, planKeyValue),
        note: 'Rehearsal: validated and assembled in full, nothing sent to Flash, nothing written to the board.',
      });
    }

    const result = await submitOrder(submitBody);

    // Best-effort ledger write, for the board. Never allowed to fail the order.
    if (planKeyValue && result?.orderId) {
      try {
        const ledger = body.ledger ?? {};
        await recordMirror({
          planKey: planKeyValue,
          planId: typeof ledger.planId === 'string' ? ledger.planId : undefined,
          symbol: ledger.symbol ?? '—',
          funder: String(tradeFields.funderAddress ?? ''),
          orderId: result.orderId,
          bracketOrderId:
            (result.attachedBracket as { bracketOrderId?: string } | undefined)?.bracketOrderId ?? null,
          spendUsd: Number(ledger.spendUsd ?? 0),
          takeProfitPrice: Number(ledger.takeProfitPrice ?? 0),
          stopLossPrice: Number(ledger.stopLossPrice ?? 0),
          createdAt: Date.now(),
          author: ledger.author,
          note: ledger.note,
          sizePct: ledger.sizePct,
          tpPct: ledger.tpPct,
          slPct: ledger.slPct,
        });
      } catch {
        /* ledger is a convenience, not the source of truth (Flash is) */
      }
    }

    return NextResponse.json({
      ok: true,
      orderId: result.orderId,
      bracketStatus: (result.attachedBracket as { status?: string } | undefined)?.status ?? null,
    });
  } catch (error) {
    const status = error instanceof FlashError ? error.status : 500;
    console.error(`[${request.method} ${request.nextUrl.pathname}]`, describeFlashError(error));
    return NextResponse.json({ ok: false, error: summariseFlashError(error) }, { status });
  }
}
