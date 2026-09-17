import { NextResponse, type NextRequest } from 'next/server';
import { BASE_CHAIN, USDC } from '@/lib/assets';
import { FlashError, describeFlashError, summariseFlashError, getBalances, normaliseBalances } from '@/lib/flash';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * What this wallet can actually deploy — and whether it has gas.
 *
 * Running out of ETH for gas while holding plenty of USDC is the classic way
 * to lose twenty minutes on demo day, so we surface it up front.
 */
export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get('address') ?? '';
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ ok: false, error: 'A valid address is required.' }, { status: 400 });
  }

  try {
    const raw = await getBalances(address);
    const rows = normaliseBalances(raw as never).filter(row => row.chain === BASE_CHAIN.slug);

    const usdc = rows.find(row => row.address?.toLowerCase() === USDC.address.toLowerCase());
    const eth = rows.find(row => row.isNative);

    return NextResponse.json({
      ok: true,
      usdc: Number(usdc?.notional ?? usdc?.balance ?? 0) || 0,
      eth: Number(eth?.balance ?? 0) || 0,
    });
  } catch (error) {
    const status = error instanceof FlashError ? error.status : 500;
    console.error(`[${request.method} ${request.nextUrl.pathname}]`, describeFlashError(error));
    return NextResponse.json({ ok: false, error: summariseFlashError(error) }, { status });
  }
}
