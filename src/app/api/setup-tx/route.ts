import { NextResponse, type NextRequest } from 'next/server';
import { createPublicClient, http, type Hex } from 'viem';
import { base } from 'viem/chains';
import { BASE_CHAIN } from '@/lib/assets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Setup-transaction plumbing for the *local key* wallet in a two-wallet demo.
 *
 * The private key stays in the browser: the server only prepares nonce/gas,
 * the client signs, and the signed raw transaction comes back to broadcast.
 * An injected wallet never touches this route.
 */
function rpc() {
  return createPublicClient({
    chain: base,
    transport: http(BASE_CHAIN.rpc, { timeout: 20_000 }),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      stage?: 'prepare' | 'broadcast';
      from?: string;
      to?: string;
      data?: string;
      value?: string;
      rawTransaction?: string;
    };

    if (body.stage === 'prepare') {
      const { from, to, data } = body;
      if (!from || !to || !data) {
        return NextResponse.json({ ok: false, error: 'from, to and data are required.' }, { status: 400 });
      }

      const client = rpc();
      const [nonce, gas, fees] = await Promise.all([
        client.getTransactionCount({ address: from as Hex }),
        client.estimateGas({ account: from as Hex, to: to as Hex, data: data as Hex, value: 0n }),
        client.estimateFeesPerGas(),
      ]);

      return NextResponse.json({
        ok: true,
        tx: {
          to,
          data,
          value: 0,
          chainId: BASE_CHAIN.id,
          type: 'eip1559',
          nonce,
          // 25% headroom on gas, so an approval does not fail on estimation drift.
          gas: Math.ceil(Number(gas) * 1.25),
          maxFeePerGas: Number(fees.maxFeePerGas ?? 1_000_000_000n),
          maxPriorityFeePerGas: Number(fees.maxPriorityFeePerGas ?? 0n),
        },
      });
    }

    if (body.stage === 'broadcast') {
      if (!body.rawTransaction) {
        return NextResponse.json({ ok: false, error: 'rawTransaction is required.' }, { status: 400 });
      }
      const hash = await rpc().sendRawTransaction({ serializedTransaction: body.rawTransaction as Hex });
      return NextResponse.json({ ok: true, hash });
    }

    return NextResponse.json({ ok: false, error: 'Unknown stage.' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Setup transaction failed.' },
      { status: 500 },
    );
  }
}
