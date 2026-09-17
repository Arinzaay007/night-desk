import { NextResponse, type NextRequest } from 'next/server';
import { createPublicClient, http, type Hex } from 'viem';
import { base } from 'viem/chains';
import { BASE_CHAIN } from '@/lib/assets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Approval receipts, checked server-side so the browser never needs to talk to
 * an RPC directly (and never trips a CORS wall mid-demo).
 */
export async function GET(request: NextRequest) {
  const hash = request.nextUrl.searchParams.get('hash');
  if (!hash || !/^0x[a-fA-F0-9]{64}$/.test(hash)) {
    return NextResponse.json({ ok: false, error: 'A transaction hash is required.' }, { status: 400 });
  }

  try {
    const client = createPublicClient({
      chain: base,
      transport: http(BASE_CHAIN.rpc, { timeout: 20_000 }),
    });

    const receipt = await client
      .getTransactionReceipt({ hash: hash as Hex })
      .catch(() => null);

    if (!receipt) return NextResponse.json({ ok: true, status: 'pending' });
    return NextResponse.json({
      ok: true,
      status: receipt.status === 'success' ? 'success' : 'reverted',
      blockNumber: Number(receipt.blockNumber),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Receipt lookup failed.' },
      { status: 500 },
    );
  }
}
