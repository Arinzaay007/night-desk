import { NextResponse, type NextRequest } from 'next/server';
import { BASE_CHAIN } from '@/lib/assets';
import {
  FlashError,
  describeFlashError,
  integratorFeeBps,
  summariseFlashError,
  getOrder,
  searchAssets,
} from '@/lib/flash';
import { aggregatePnl, computePnl, type MirrorPnl } from '@/lib/pnl';
import { mirrorsForPlan, updateEarnings } from '@/lib/store';
import { reconcile } from '@/lib/earnings';
import { evaluateCompliance, summariseCompliance, type ComplianceVerdict } from '@/lib/verify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Proof for a plan: what actually happened, read back from the exchange.
 *
 * The board claims it is "scored on real fills, not screenshots" — this is the
 * endpoint that makes that true. For each wallet that mirrored a plan we read
 * the order back from Flash and surface its fills and transaction hashes, so a
 * reviewer can click through to BaseScan and verify every claim independently.
 *
 * Bounded on purpose: Flash allows 5 requests/sec per endpoint and order reads
 * are per-funder, so we cap the fan-out and space the calls.
 */
const MAX_MIRRORS = 6;

export async function GET(request: NextRequest) {
  const planKeyValue = request.nextUrl.searchParams.get('planKey');
  if (!planKeyValue) {
    return NextResponse.json({ ok: false, error: 'planKey is required.' }, { status: 400 });
  }

  try {
    const mirrors = (await mirrorsForPlan(planKeyValue)).slice(0, MAX_MIRRORS);

    // One price lookup for the whole plan — every mirror holds the same asset.
    let currentPrice: number | null = null;
    const symbol = mirrors[0]?.symbol;
    if (symbol) {
      try {
        const found = await searchAssets(symbol, BASE_CHAIN.slug, 1);
        const price = Number(found.assets?.[0]?.price ?? 0);
        currentPrice = price > 0 ? price : null;
      } catch {
        // A missing price costs us unrealised figures only; realised still works.
      }
    }

    const proof = [];
    const pnlRows: MirrorPnl[] = [];
    const complianceVerdicts: ComplianceVerdict[] = [];
    /** The integrator fee this plan has actually collected, integer micro-USD. */
    let revenueMicro = 0;
    let revenueFills = 0;

    for (const mirror of mirrors) {
      let entry = null;
      let bracket = null;

      try {
        const order = await getOrder(mirror.orderId, mirror.funder);
        entry = {
          orderId: order.orderId,
          status: order.status,
          closeReason: order.closeReason ?? null,
          ticker: order.targetAsset?.ticker ?? mirror.symbol,
          qty: order.qty,
          filledTarget: order.filled?.targetAmount ?? null,
          averagePrice: order.filled?.averageNotionalPrice ?? null,
          placedAt: order.placedAt ?? order.acceptedAt ?? null,
          bracketStatus: order.attachedBracket?.status ?? null,
          takeProfit: order.attachedBracket?.takeProfit?.notionalPrice ?? null,
          stopLoss: order.attachedBracket?.stopLoss?.notionalPrice ?? null,
          fills: (order.fills ?? []).map(fill => ({
            notional: fill.notional ?? null,
            fillPrice: fill.fillPrice ?? null,
            filledAt: fill.filledAt ?? null,
            txHash: fill.transactionId ?? null,
            integratorFee: fill.integratorFeeAmount ?? null,
            feeTicker: fill.feeTicker ?? null,
            venues: fill.venues ?? [],
          })),
        };

        // The protective pair is its own order; read it so the proof shows
        // whether protection actually went live rather than just promising it.
        let exitOrder = null;
        const bracketId = order.attachedBracket?.bracketOrderId;
        if (bracketId) {
          const leg = await getOrder(bracketId, mirror.funder);
          exitOrder = leg;
          bracket = {
            orderId: leg.orderId,
            status: leg.status,
            closeReason: leg.closeReason ?? null,
            fills: (leg.fills ?? []).map(fill => ({
              notional: fill.notional ?? null,
              filledAt: fill.filledAt ?? null,
              txHash: fill.transactionId ?? null,
            })),
          };
        }

        /*
         * Compliance, from data this route already fetched. The mirror record
         * holds the absolute levels this plan resolved to for THIS wallet; the
         * order holds what is actually resting on the exchange. Comparing them
         * is the difference between "3 wallets mirrored this" and "3 wallets
         * ran it as published".
         */
        const compliance = evaluateCompliance({
          tpPct: mirror.tpPct ?? 0,
          slPct: mirror.slPct ?? 0,
          plannedTakeProfit: mirror.takeProfitPrice,
          plannedStopLoss: mirror.stopLossPrice,
          actualTakeProfit: Number(order.attachedBracket?.takeProfit?.notionalPrice ?? '') || null,
          actualStopLoss: Number(order.attachedBracket?.stopLoss?.notionalPrice ?? '') || null,
          bracketOrderId: order.attachedBracket?.bracketOrderId ?? null,
          bracketStatus: order.attachedBracket?.status ?? null,
          entryPrice: Number(order.filled?.averageNotionalPrice ?? '') || null,
        });
        complianceVerdicts.push(compliance);

        // P&L from settled fills only.
        const pnl = computePnl({ entry: order, exit: exitOrder, currentPrice });
        pnlRows.push(pnl);

        /**
         * Turn the author's forecast into an obligation.
         *
         * ENTRY **AND** BRACKET LEG. The protective pair is a separate order and
         * charges its own fee, so reconciling from the entry alone would
         * underpay every author whose plan actually took profit — which is
         * exactly the author you most want to keep.
         *
         * Only settled fills reach here; `reconcile` drops the rest and leaves
         * the record as an unpayaable estimate.
         */
        for (const fill of [...(order.fills ?? []), ...(exitOrder?.fills ?? [])]) {
          const fee = Number(fill.integratorFeeNotional ?? fill.integratorFeeAmount ?? 0);
          if (Number.isFinite(fee) && fee > 0) {
            revenueMicro += Math.round(fee * 1_000_000);
            revenueFills += 1;
          }
        }

        const settledFills = [...(order.fills ?? []), ...(exitOrder?.fills ?? [])].map(fill => ({
          integratorFeeNotional: fill.integratorFeeNotional ?? null,
          integratorFeeAmount: fill.integratorFeeAmount ?? null,
          feeTicker: fill.feeTicker ?? null,
          notional: fill.notional ?? null,
          status: fill.status ?? null,
        }));
        if (settledFills.length > 0) {
          await updateEarnings(records => {
            reconcile(records, {
              planKey: mirror.planKey,
              orderId: mirror.orderId,
              fills: settledFills,
              bps: Number(integratorFeeBps()) || 0,
            });
            return records;
          });
        }

        proof.push({
          funder: mirror.funder,
          spendUsd: mirror.spendUsd,
          createdAt: mirror.createdAt,
          verified: true,
          compliance,
          pnl,
          entry,
          bracket,
        });
      } catch (error) {
        // A mirror we cannot read back is reported as unverified, never hidden.
        proof.push({
          funder: mirror.funder,
          spendUsd: mirror.spendUsd,
          createdAt: mirror.createdAt,
          verified: false,
          error: summariseFlashError(error, 140),
        });
        continue;
      }

      // Stay under 5 req/sec on the order-read endpoint.
      await new Promise(r => setTimeout(r, 220));
    }

    const verified = proof.filter(p => p.verified).length;
    const totalFilled = proof.reduce(
      (sum, p) => sum + Number((p as { entry?: { filledTarget?: string | null } }).entry?.filledTarget ?? 0),
      0,
    );

    return NextResponse.json({
      ok: true,
      planKey: planKeyValue,
      mirrors: proof.length,
      verified,
      totalFilled,
      currentPrice,
      pnl: aggregatePnl(pnlRows),
      /**
       * The headline the plan page leads with. "N wallets ran this as published"
       * is only sayable because it was read back from the exchange.
       */
      compliance: summariseCompliance(complianceVerdicts),
      /**
       * Revenue from this plan's execution flow. What the deployment collected
       * in integrator fees, read off the fills — the number the track asks
       * about, and a number most submissions can only estimate.
       */
      revenue: {
        integratorFeeMicro: revenueMicro,
        fills: revenueFills,
      },
      proof,
    });
  } catch (error) {
    const status = error instanceof FlashError ? error.status : 500;
    console.error(`[${request.method} ${request.nextUrl.pathname}]`, describeFlashError(error));
    return NextResponse.json({ ok: false, error: summariseFlashError(error) }, { status });
  }
}
