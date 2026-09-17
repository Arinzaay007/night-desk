import { NextResponse, type NextRequest } from 'next/server';
import { BASE_CHAIN, USDC } from '@/lib/assets';
import {
  FlashError,
  describeFlashError, summariseFlashError,
  getBalances,
  integratorFeeBps,
  normaliseBalances,
  quote,
} from '@/lib/flash';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Builds an exit quote: sell the wallet's entire balance of a tokenised equity
 * into USDC at market.
 *
 * This is how a position is closed. It is deliberately *not* a bracket — there
 * is nothing to protect once you have exited — and it is separate from
 * cancelling an order, which only applies to orders that haven't filled.
 *
 * We size off the wallet's live onchain balance rather than the entry's filled
 * amount, because the two can differ: a partial fill, a TWAP still running, or
 * an existing holding of the same token.
 */
const MAX_SLIPPAGE = '0.03';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      funderAddress?: string;
      assetAddress?: string;
      symbol?: string;
    };

    const funderAddress = String(body.funderAddress ?? '');
    const assetAddress = String(body.assetAddress ?? '');

    if (!/^0x[a-fA-F0-9]{40}$/.test(funderAddress)) {
      return NextResponse.json({ ok: false, error: 'Connect a wallet first.' }, { status: 400 });
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(assetAddress)) {
      return NextResponse.json({ ok: false, error: 'Missing asset address.' }, { status: 400 });
    }

    const raw = await getBalances(funderAddress);
    const rows = normaliseBalances(raw as never);
    const holding = rows.find(
      row =>
        row.chain === BASE_CHAIN.slug && row.address?.toLowerCase() === assetAddress.toLowerCase(),
    );

    const balance = Number(holding?.balance ?? 0);
    if (!(balance > 0)) {
      return NextResponse.json(
        {
          ok: false,
          error: `This wallet holds no ${body.symbol ?? 'tokens'} on Base, so there is nothing to close.`,
        },
        { status: 400 },
      );
    }

    // Quote the full balance as a decimal string. Flash takes the sell qty in
    // target-asset units, which is exactly what /balances reports.
    const qty = String(holding?.balance);

    const result = await quote({
      targetChain: BASE_CHAIN.slug,
      contraChain: BASE_CHAIN.slug,
      targetAsset: assetAddress,
      contraAsset: USDC.address,
      side: 'sell',
      qty,
      orderType: 'market',
      funderAddress,
      maxSlippage: MAX_SLIPPAGE,
      flashIntegratorFeeBps: integratorFeeBps(),
    });

    const orderFields: Record<string, unknown> = {
      targetChain: BASE_CHAIN.slug,
      contraChain: BASE_CHAIN.slug,
      targetAsset: assetAddress,
      contraAsset: USDC.address,
      side: 'sell',
      qty,
      orderType: 'market',
      funderAddress,
      maxSlippage: MAX_SLIPPAGE,
      flashIntegratorFeeBps: integratorFeeBps(),
    };

    return NextResponse.json({
      ok: true,
      quote: result,
      orderFields,
      meta: {
        symbol: body.symbol ?? '—',
        qty,
        // What we expect back in USDC.
        proceedsUsd: Number(result.to?.notional ?? 0),
        estimatedFeeUsd: Number(result.fees?.estimatedFeeNotional ?? 0),
        priceImpact: Number(result.estimatedPriceImpact ?? 0),
      },
    });
  } catch (error) {
    const status = error instanceof FlashError ? error.status : 500;
    console.error(`[${request.method} ${request.nextUrl.pathname}]`, describeFlashError(error));
    return NextResponse.json({ ok: false, error: summariseFlashError(error) }, { status });
  }
}
