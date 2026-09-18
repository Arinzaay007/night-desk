import { NextResponse, type NextRequest } from 'next/server';
import { BASE_CHAIN, USDC, findEquity } from '@/lib/assets';
import { FlashError, describeFlashError, summariseFlashError, quote } from '@/lib/flash';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Allowance warm-up.
 *
 * A first bracket trade needs *two* onchain approvals — one for the spent
 * asset, one for the asset the protective pair is authorised to sell on exit.
 * That is two wallet confirmations before the trade even starts, which is
 * exactly the kind of thing that ruins a recorded take.
 *
 * This route quotes at minimum size and returns only the approvals. Send them
 * ahead of time, discard the quote, and the recorded trade becomes two
 * signature prompts with no onchain steps.
 *
 * Safe to repeat: an approval that already covers the order comes back null,
 * and Flash reports `approveTx: null` once the allowance is sufficient.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { assetAddress?: string; funderAddress?: string };
    const funderAddress = String(body.funderAddress ?? '');
    const assetAddress = String(body.assetAddress ?? '');

    if (!/^0x[a-fA-F0-9]{40}$/.test(funderAddress)) {
      return NextResponse.json({ ok: false, error: 'Connect a wallet first.' }, { status: 400 });
    }

    const equity = findEquity(assetAddress);
    if (!equity) {
      return NextResponse.json(
        { ok: false, error: 'That asset is not on our Base equity list.' },
        { status: 400 },
      );
    }

    /*
     * The quote is discarded — we only want the approval payloads, and an
     * approval is the same unlimited grant whatever size we quote at.
     *
     * But it still has to be large enough to quote AT ALL. Flash rejects a
     * trade whose fees would exceed its output, and that floor MOVES with
     * network conditions: measured $0.03 in September, and by 2026-09-18 the
     * network portion alone was $0.106, so a $0.05 probe came back
     * `trade size too small: fees would exceed output amount`.
     *
     * Do not hardcode a size here. Ladder up until one quotes, so the warm-up
     * keeps working as the floor drifts. A quote needs no balance — verified
     * against an empty wallet — so climbing is free and safe.
     */
    const SIZES = ['0.05', '1', '5', '25'];
    let result = null;
    let lastError: unknown = null;

    for (const qty of SIZES) {
      try {
        result = await quote({
          targetChain: BASE_CHAIN.slug,
          contraChain: BASE_CHAIN.slug,
          targetAsset: equity.address,
          contraAsset: USDC.address,
          side: 'buy',
          qty,
          orderType: 'market',
          funderAddress,
          maxSlippage: '0.03',
          attachedBracket: {
            // Wide, arbitrary levels: we are not placing this order.
            takeProfit: { notionalPrice: '999999' },
            stopLoss: { notionalPrice: '0.01' },
          },
        });
        break;
      } catch (error) {
        lastError = error;
      }
    }

    if (!result) throw lastError ?? new Error('Could not obtain an approval quote.');

    const approvals = [
      result.evm?.approveTx ? { ...result.evm.approveTx, purpose: 'spend USDC' } : null,
      result.attachedBracket?.evm?.approveTx
        ? { ...result.attachedBracket.evm.approveTx, purpose: `let the pair sell ${equity.symbol}` }
        : null,
    ].filter(Boolean) as { to: string; data: string; purpose: string }[];

    return NextResponse.json({
      ok: true,
      symbol: equity.symbol,
      approvals,
      alreadyWarm: approvals.length === 0,
      note:
        approvals.length === 0
          ? 'Both allowances are already in place — this asset is ready to trade with signatures only.'
          : `${approvals.length} approval${approvals.length > 1 ? 's' : ''} needed. Send them now and the trade itself will need only signatures.`,
      /** Deliberately not returning quoteId or order fields: this order is discarded. */
    });
  } catch (error) {
    const status = error instanceof FlashError ? error.status : 500;
    console.error(`[${request.method} ${request.nextUrl.pathname}]`, describeFlashError(error));
    return NextResponse.json({ ok: false, error: summariseFlashError(error) }, { status });
  }
}
