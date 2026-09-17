import { NextResponse, type NextRequest } from 'next/server';
import { FlashError, cancelOrder, describeFlashError, summariseFlashError, getOrder } from '@/lib/flash';
import { isValidCancelMessage } from '@/lib/orders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Cancel a resting order.
 *
 * Flash requires a wallet signature over an exact plaintext message in addition
 * to the API key. We re-validate that the message matches the order id before
 * forwarding, so a malformed message fails here with a clear error rather than
 * as an opaque signature rejection from the API.
 *
 * Note: cancelling an entry does NOT cancel its attached bracket pair — those
 * are separate orders with their own ids. Callers that want both must cancel
 * both. See src/lib/execute.ts.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      orderId?: string;
      funderAddress?: string;
      cancelMessage?: string;
      userSignature?: string;
    };

    const { orderId, funderAddress, cancelMessage, userSignature } = body;

    if (!orderId) return NextResponse.json({ ok: false, error: 'Missing orderId.' }, { status: 400 });
    if (!userSignature) {
      return NextResponse.json({ ok: false, error: 'Missing cancel signature.' }, { status: 400 });
    }
    if (!cancelMessage || !isValidCancelMessage(orderId, cancelMessage)) {
      return NextResponse.json(
        { ok: false, error: 'Cancel message does not match this order id.' },
        { status: 400 },
      );
    }

    const result = await cancelOrder(orderId, { cancelMessage, userSignature });

    return NextResponse.json({
      ok: true,
      orderId,
      /** Why the order closed, read back so the UI can confirm the cancel landed. */
      closeReason: (result as { closeReason?: string } | undefined)?.closeReason ?? 'REASON_USER_REQUESTED',
    });
  } catch (error) {
    // A cancel can race a fill. Flash answers 422 with "order already filled":
    // that is the order having executed, not a failed cancel, so surface it as
    // such rather than telling the user to retry.
    if (error instanceof FlashError) {
      const alreadyFilled = error.status === 422 && /already filled/i.test(error.message);
      return NextResponse.json(
        {
          ok: false,
          raced: alreadyFilled,
          error: alreadyFilled
            ? 'This order filled before the cancel landed — treat it as executed, not as a failure.'
            : summariseFlashError(error),
        },
        { status: alreadyFilled ? 409 : error.status },
      );
    }
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Cancel failed.' },
      { status: 500 },
    );
  }
}

/** Convenience: read an order's current status before offering a cancel. */
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const orderId = params.get('orderId') ?? '';
    const funder = params.get('funder') ?? '';
    if (!orderId || !/^0x[a-fA-F0-9]{40}$/.test(funder)) {
      return NextResponse.json({ ok: false, error: 'orderId and funder are required.' }, { status: 400 });
    }
    const order = await getOrder(orderId, funder);
    return NextResponse.json({ ok: true, order });
  } catch (error) {
    const status = error instanceof FlashError ? error.status : 500;
    console.error(`[${request.method} ${request.nextUrl.pathname}]`, describeFlashError(error));
    return NextResponse.json({ ok: false, error: summariseFlashError(error) }, { status });
  }
}
