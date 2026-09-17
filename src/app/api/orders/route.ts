import { NextResponse, type NextRequest } from 'next/server';
import { FlashError, describeFlashError, summariseFlashError, getOrder, listOrders } from '@/lib/flash';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/orders?funder=0x…
 * GET /api/orders?funder=0x…&orderId=…   (adds fills)
 *
 * Flash scopes order reads to a funder address, so there is no global feed of
 * trades to index — one reason a plan has to be published to be shareable.
 */
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const funder = params.get('funder') ?? '';
    const orderId = params.get('orderId');

    if (!/^0x[a-fA-F0-9]{40}$/.test(funder)) {
      return NextResponse.json({ ok: false, error: 'A valid funder address is required.' }, { status: 400 });
    }

    if (orderId) {
      const detail = await getOrder(orderId, funder);
      return NextResponse.json({ ok: true, order: detail });
    }

    const result = await listOrders(funder, 50);
    const orders = (result?.orders ?? []).slice().sort((a, b) => {
      const aTime = Date.parse(a.acceptedAt ?? a.placedAt ?? '') || 0;
      const bTime = Date.parse(b.acceptedAt ?? b.placedAt ?? '') || 0;
      return bTime - aTime;
    });

    return NextResponse.json({ ok: true, orders });
  } catch (error) {
    const status = error instanceof FlashError ? error.status : 500;
    console.error(`[${request.method} ${request.nextUrl.pathname}]`, describeFlashError(error));
    return NextResponse.json({ ok: false, error: summariseFlashError(error) }, { status });
  }
}
