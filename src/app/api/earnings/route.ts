import { NextResponse, type NextRequest } from 'next/server';
import { createPublicClient, http, encodeFunctionData, parseAbi, type Hex } from 'viem';
import { base } from 'viem/chains';
import { BASE_CHAIN, USDC } from '@/lib/assets';
import { integratorFeeBps, quote } from '@/lib/flash';
import {
  authorSharePct,
  claimable,
  formatMicro,
  markClaimed,
  summariseAllAuthors,
  summariseForAuthor,
  type EarningRecord,
} from '@/lib/earnings';
import { sameAddress } from '@/lib/address';
import { judgePayout } from '@/lib/payout-verify';
import { listEarnings, updateEarnings } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The payout side of the author ledger.
 *
 * Flash pays ONE integrator per order — us — and cannot split a fee across the
 * many authors whose plans were mirrored. So authors are paid from here: a plain
 * USDC transfer, one per author, tracked against the obligation recorded in
 * src/lib/earnings.ts.
 *
 * Two rules this route enforces, because breaking either is how a payout system
 * starts lying to people:
 *
 *   1. ESTIMATES ARE NEVER PAYABLE. `claimable()` returns reconciled records
 *      only; an unexecuted plan accrues a forecast that can never be withdrawn.
 *   2. SETTLING IS IRREVERSIBLE AND SEPARATE FROM PREPARING. `prepare` quotes
 *      what would be sent; `settle` marks it paid. They are different requests
 *      so no single click can both compute and commit a payment.
 *
 * Unit note, and it is a happy one: our ledger is integer micro-USD and USDC has
 * 6 decimals, so 1 µUSD IS 1 USDC base unit. A payout amount converts with no
 * arithmetic at all — the one place in this codebase where that is true.
 */

const ERC20 = parseAbi(['function transfer(address to, uint256 amount) returns (bool)']);

/** An ERC-20 transfer costs ~65k gas at worst with a cold recipient. */
const GAS_UNITS = 65_000n;

const SERVER_DRY_RUN = process.env.NEXT_PUBLIC_DRY_RUN === '1';

function rpc() {
  return createPublicClient({
    chain: base,
    transport: http(BASE_CHAIN.rpc, { timeout: 20_000 }),
  });
}

/**
 * What broadcasting a payout would cost in USD.
 *
 * Wei → ETH → USD, in that order. Getting this wrong is easy and embarrassing:
 * multiply a wei-denominated gas price straight through and you print numbers
 * like "3.9e+23 gwei". Convert once, explicitly, and label the unit.
 *
 * Returns null when the price cannot be established — callers treat that as
 * "unknown", never as "free".
 */
async function payoutGasUsd(): Promise<{ usd: number; gasPriceGwei: number; ethUsd: number } | null> {
  try {
    const client = rpc();
    const [gasPriceWei, ethQuote] = await Promise.all([
      client.getGasPrice(),
      quote({
        targetChain: BASE_CHAIN.slug,
        contraChain: BASE_CHAIN.slug,
        targetAsset: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', // native ETH
        contraAsset: USDC.address,
        side: 'buy',
        qty: '1',
        orderType: 'market', // required by /quote, and the default for a price probe
      
      }),
    ]);

    const ethAmount = Number(ethQuote.to.amount);
    const ethNotional = Number(ethQuote.to.notional);
    if (!Number.isFinite(ethAmount) || ethAmount <= 0) return null;
    const ethUsd = ethNotional / ethAmount;
    if (!Number.isFinite(ethUsd) || ethUsd <= 0) return null;

    const gasEth = Number(gasPriceWei * GAS_UNITS) / 1e18;
    const gasPriceGwei = Number(gasPriceWei) / 1e9;
    return { usd: gasEth * ethUsd, gasPriceGwei, ethUsd };
  } catch {
    return null;
  }
}

/** USDC transfer calldata: selector, padded recipient, padded amount. */
function transferData(to: string, amountMicro: number): Hex {
  return encodeFunctionData({
    abi: ERC20,
    functionName: 'transfer',
    args: [to as `0x${string}`, BigInt(amountMicro)],
  }).toLowerCase() as Hex;
}

function groupAuthors(records: EarningRecord[]) {
  return summariseAllAuthors(records);
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const records = await listEarnings();

    if (params.get('queue') === '1') {
      const summaries = groupAuthors(records);
      const owed = summaries.filter(s => s.payableMicro > 0);
      return NextResponse.json({
        ok: true,
        queue: owed.map(s => ({
          ...s,
          payable: formatMicro(s.payableMicro),
          estimated: formatMicro(s.estimatedMicro),
          claimed: formatMicro(s.claimedMicro),
        })),
        totalPayableMicro: owed.reduce((sum, s) => sum + s.payableMicro, 0),
        totalPayable: formatMicro(owed.reduce((sum, s) => sum + s.payableMicro, 0)),
      });
    }

    const author = params.get('author');
    if (!author) {
      return NextResponse.json(
        { ok: false, error: 'Pass ?author=<address> or ?queue=1.' },
        { status: 400 },
      );
    }

    const summary = summariseForAuthor(records, author);
    const mine = records
      .filter(r => sameAddress(r.author, author))
      .sort((a, b) => b.createdAt - a.createdAt);

    return NextResponse.json({
      ok: true,
      author,
      /** Read from the server env so the UI cannot drift from what we charge. */
      feeBps: Number(integratorFeeBps()) || 0,
      sharePct: authorSharePct(),
      summary,
      totals: {
        estimated: formatMicro(summary.estimatedMicro),
        payable: formatMicro(summary.payableMicro),
        claimed: formatMicro(summary.claimedMicro),
      },
      /**
       * Stated in the payload so the UI never has to invent the rule: an
       * estimate is a forecast of a fee on an order that has not settled.
       */
      note: 'Only reconciled amounts are withdrawable. Estimates become payable once the fills settle.',
      earnings: mine,
    });
  } catch (error) {
    console.error('[GET /api/earnings]', error);
    return NextResponse.json({ ok: false, error: 'Could not read the ledger.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
    action?: string;
    author?: string;
    ref?: string;
    /**
     * The hash of the USDC transfer the operator broadcast. Required to settle
     * while armed: the ledger will not record a payout it cannot read back.
     */
    txHash?: string;
  };
    const action = body.action;

    if (action !== 'prepare' && action !== 'settle') {
      return NextResponse.json(
        { ok: false, error: "action must be 'prepare' or 'settle'." },
        { status: 400 },
      );
    }

    const records = await listEarnings();
    const payable = claimable(records);

    if (action === 'prepare') {
      const author = body.author;
      if (!author) {
        return NextResponse.json({ ok: false, error: 'author is required.' }, { status: 400 });
      }

      const mine = payable.filter(r => sameAddress(r.author, author));
      const amountMicro = mine.reduce((sum, r) => sum + r.authorMicro, 0);

      // Explains a zero payout instead of just refusing one.
      const excluded = records
        .filter(r => sameAddress(r.author, author) && r.state === 'estimated')
        .map(r => ({
          id: r.id,
          state: r.state,
          authorMicro: r.authorMicro,
          amount: formatMicro(r.authorMicro),
          reason: 'Forecast only — the order has not settled, so nothing was collected to share.',
        }));

      if (amountMicro <= 0) {
        return NextResponse.json({
          ok: true,
          author,
          amountMicro: 0,
          amount: formatMicro(0),
          excludes: excluded,
          note: 'Nothing payable yet.',
        });
      }

      const gas = await payoutGasUsd();
      const gasUsd = gas?.usd ?? null;

      return NextResponse.json({
        ok: true,
        author,
        amountMicro,
        amount: formatMicro(amountMicro),
        // One transfer per author, so the count is always 1.
        tx: {
          chain: BASE_CHAIN.slug,
          chainId: BASE_CHAIN.id,
          to: USDC.address,
          from: USDC.address,
          data: transferData(author, amountMicro),
          value: '0',
          /**
           * USDC base units. Not a coincidence: 6 decimals of USDC == 1e-6 USD
           * == 1 µUSD, so the integer we stored is already the calldata amount.
           */
          amountBaseUnits: String(amountMicro),
        },
        costs: gas
          ? {
              gasPriceGwei: Number(gas.gasPriceGwei.toFixed(6)),
              gasUnits: String(GAS_UNITS),
              ethUsd: Number(gas.ethUsd.toFixed(2)),
              estimatedGasUsd: Number(gasUsd!.toFixed(6)),
              /**
               * A payout smaller than its own gas is not a payout. Surfaced
               * rather than hidden, because the honest move is to let the
               * balance accumulate.
               */
              uneconomic: amountMicro / 1e6 < gasUsd!,
            }
          : {
              estimatedGasUsd: null,
              uneconomic: false,
              note: 'Gas price unavailable — treating cost as unknown rather than free.',
            },
        covers: mine.map(r => ({ id: r.id, orderId: r.orderId, authorMicro: r.authorMicro })),
        excludes: excluded,
        next: 'Broadcast this transfer, then POST {action:"settle"} to record it.',
      });
    }

    /* ------------------------------- settle ------------------------------- */

    // Dry run may settle without a token so the flow can be walked end to end
    // before anyone's real money is involved. An armed deployment may not.
    if (!SERVER_DRY_RUN) {
      const expected = process.env.OPERATOR_TOKEN;
      const given = request.headers.get('x-nightdesk-operator');
      if (!expected) {
        return NextResponse.json(
          {
            ok: false,
            error: 'OPERATOR_TOKEN is not set, so settling is refused while armed.',
          },
          { status: 403 },
        );
      }
      if (given !== expected) {
        return NextResponse.json({ ok: false, error: 'Bad operator token.' }, { status: 403 });
      }
    }

    const author = body.author;
    if (!author) {
      return NextResponse.json({ ok: false, error: 'author is required.' }, { status: 400 });
    }

    const ids = payable.filter(r => sameAddress(r.author, author)).map(r => r.id);
    if (ids.length === 0) {
      return NextResponse.json({
        ok: true,
        changed: [],
        note: 'Nothing payable — settle is a no-op.',
      });
    }

    /*
     * PROOF, NOT TRUST.
     *
     * This is the one payment in the build, so it is the one place worth being
     * pedantic: read the transfer back off Base and confirm it paid this author
     * before the ledger is allowed to say "paid". A ledger that claims a payout
     * that never happened is worse than one that says nothing, because the
     * author stops waiting.
     *
     * Dry run keeps the old behaviour so the flow can still be walked end to
     * end with no real money anywhere.
     */
    const owedMicro = payable
      .filter(r => ids.includes(r.id))
      .reduce((sum, r) => sum + r.authorMicro, 0);

    let ref: string;
    if (SERVER_DRY_RUN) {
      ref = body.ref ?? `dry-run-${Date.now()}`;
    } else {
      const txHash = typeof body.txHash === 'string' ? body.txHash.trim() : '';
      if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'Broadcast the payout first, then send its transaction hash as {txHash}. Nothing is recorded as paid until that transfer is read back on Base.',
            owedMicro,
            owed: formatMicro(owedMicro),
          },
          { status: 400 },
        );
      }

      let receipt: { status?: string | null; logs?: unknown } | null = null;
      try {
        receipt = (await rpc().getTransactionReceipt({
          hash: txHash as `0x${string}`,
        })) as { status?: string | null; logs?: unknown } | null;
      } catch {
        receipt = null;
      }
      if (!receipt) {
        return NextResponse.json(
          { ok: false, error: `No receipt for ${txHash} yet. Wait for it to be mined, then settle again.` },
          { status: 400 },
        );
      }

      const verdict = judgePayout({
        status: receipt.status,
        logs: receipt.logs as never,
        token: USDC.address,
        author,
        minMicro: owedMicro,
      });
      if (!verdict.ok) {
        return NextResponse.json({ ok: false, error: verdict.reason }, { status: 400 });
      }

      // The transfer is the reference. A separate id could disagree with it.
      ref = txHash.toLowerCase();
    }

    let changed: EarningRecord[] = [];
    await updateEarnings(recordsInStore => {
      changed = markClaimed(recordsInStore, ids, ref);
      return recordsInStore;
    });

    return NextResponse.json({
      ok: true,
      author,
      ref,
      changed: changed.map(r => ({ id: r.id, authorMicro: r.authorMicro, amount: formatMicro(r.authorMicro) })),
      total: formatMicro(changed.reduce((sum, r) => sum + r.authorMicro, 0)),
    });
  } catch (error) {
    console.error('[POST /api/earnings]', error);
    return NextResponse.json({ ok: false, error: 'Payout failed.' }, { status: 500 });
  }
}
