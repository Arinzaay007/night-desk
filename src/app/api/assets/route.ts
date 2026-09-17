import { NextResponse } from 'next/server';
import { BASE_CHAIN, EQUITIES } from '@/lib/assets';
import { FlashError, describeFlashError, summariseFlashError, searchAssets } from '@/lib/flash';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Live prices for the equity picker.
 *
 * Flash allows 5 requests/sec per endpoint per key, so these go out
 * sequentially rather than in one burst, and the result is cached briefly.
 */
let cache: { at: number; payload: unknown } | null = null;
const TTL_MS = 20_000;

export async function GET() {
  if (cache && Date.now() - cache.at < TTL_MS) {
    return NextResponse.json(cache.payload);
  }

  try {
    const assets = [];
    for (const equity of EQUITIES) {
      const result = await searchAssets(equity.symbol, BASE_CHAIN.slug, 1);
      const match =
        result.assets?.find(a => a.address.toLowerCase() === equity.address.toLowerCase()) ??
        result.assets?.[0];
      assets.push({
        ...equity,
        price: Number(match?.price ?? 0),
        liquidity: Number(match?.liquidity ?? 0),
        volume24h: Number(match?.volume24h ?? 0),
        riskFlagged: match?.riskFlagged ?? false,
      });
      await new Promise(r => setTimeout(r, 150));
    }

    const payload = { ok: true, assets };
    cache = { at: Date.now(), payload };
    return NextResponse.json(payload);
  } catch (error) {
    const status = error instanceof FlashError ? error.status : 500;
    console.error('[GET /api/assets]', describeFlashError(error));
    return NextResponse.json({ ok: false, error: summariseFlashError(error) }, { status });
  }
}
