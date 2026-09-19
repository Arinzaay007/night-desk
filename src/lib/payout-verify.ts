/**
 * Proving a payout actually happened.
 *
 * WHY THIS EXISTS
 * ---------------
 * Every other number in this product is verified against the outside world. The
 * fills come from the exchange, the compliance readout compares live bracket
 * levels against the published plan, the board reads settled profit back off the
 * chain. The one place that was NOT verified was the last step: `/payouts`
 * assembled a USDC transfer, the operator broadcast it, and then called settle —
 * and settle believed them.
 *
 * That is a single point of trust in an otherwise verifiable system, and it sits
 * on the money. It also has a nasty failure mode: a ledger that says "paid" when
 * nothing moved is worse than a ledger that says nothing, because the author
 * stops waiting.
 *
 * So settle now takes the transfer's transaction hash and refuses to record
 * anything until it has read that transaction back off Base and found a USDC
 * transfer to the author for at least the amount owed.
 *
 * The decoding is deliberately dependency-free and pure, so it can be tested
 * without a network — see scripts/test-payout.mjs.
 */

/** `Transfer(address,address,uint256)` — the ERC-20 event signature. */
export const TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

export interface RawLog {
  address?: string | null;
  topics?: readonly string[] | null;
  data?: string | null;
}

export interface DecodedTransfer {
  /** The token contract that emitted the event. */
  token: string;
  from: string;
  to: string;
  /** Amount in USDC base units, which for a 6-decimal token equals micro-USD. */
  valueMicro: number;
}

/** An address is 20 bytes; event topics pad it to 32. */
function addressFromTopic(topic: string | undefined): string | null {
  if (typeof topic !== 'string') return null;
  const hex = topic.startsWith('0x') ? topic.slice(2) : topic;
  if (hex.length !== 64) return null;
  return `0x${hex.slice(24).toLowerCase()}`;
}

/**
 * Pull the ERC-20 transfers out of a receipt's logs.
 *
 * Skips anything that is not a well-formed Transfer rather than throwing: a
 * receipt legitimately contains other events, and the caller's job is to look
 * for one specific payment, not to be surprised by an approval.
 */
export function decodeTransfers(logs: readonly RawLog[] | null | undefined): DecodedTransfer[] {
  if (!Array.isArray(logs)) return [];
  const out: DecodedTransfer[] = [];

  for (const log of logs) {
    const topics = log?.topics;
    if (!Array.isArray(topics) || topics.length < 3) continue;
    if (String(topics[0]).toLowerCase() !== TRANSFER_TOPIC) continue;

    const from = addressFromTopic(topics[1]);
    const to = addressFromTopic(topics[2]);
    if (!from || !to) continue;

    const data = typeof log.data === 'string' ? log.data : '';
    const hex = data.startsWith('0x') ? data.slice(2) : data;
    if (hex.length === 0 || hex.length > 64) continue;

    let value: bigint;
    try {
      value = BigInt(`0x${hex}`);
    } catch {
      continue;
    }
    // Beyond Number.MAX_SAFE_INTEGER the micro-USD maths would silently drift.
    if (value > BigInt(Number.MAX_SAFE_INTEGER)) continue;

    out.push({
      token: String(log.address ?? '').toLowerCase(),
      from,
      to,
      valueMicro: Number(value),
    });
  }

  return out;
}

export interface PayoutVerdict {
  ok: boolean;
  /** Why it failed, in a sentence an operator can act on. */
  reason?: string;
  /** What actually arrived, when it did. */
  paidMicro?: number;
  from?: string;
}

/**
 * Did this transaction pay `author` at least `minMicro` in USDC, from `token`?
 *
 * Checks the receipt status as well as the logs: a reverted transaction can
 * still carry log-shaped data in some RPC responses, and a failed transfer is
 * not a payment.
 */
export function judgePayout(input: {
  status?: string | null;
  logs?: readonly RawLog[] | null;
  token: string;
  author: string;
  minMicro: number;
}): PayoutVerdict {
  const status = String(input.status ?? '').toLowerCase();
  if (status !== '0x1' && status !== 'success') {
    return { ok: false, reason: `The transaction did not succeed (status ${input.status ?? 'unknown'}).` };
  }

  const want = input.author.toLowerCase();
  const token = input.token.toLowerCase();
  const transfers = decodeTransfers(input.logs);
  if (transfers.length === 0) {
    return { ok: false, reason: 'The transaction contains no ERC-20 transfer.' };
  }

  const toAuthor = transfers.filter(t => t.token === token && t.to === want);
  if (toAuthor.length === 0) {
    const elsewhere = transfers.length;
    return {
      ok: false,
      reason: `No USDC transfer to ${input.author} in that transaction (${elsewhere} other transfer${
        elsewhere === 1 ? '' : 's'
      } found).`,
    };
  }

  const paidMicro = toAuthor.reduce((sum, t) => sum + t.valueMicro, 0);
  if (paidMicro < input.minMicro) {
    return {
      ok: false,
      reason: `That transaction paid ${paidMicro} µUSD of the ${input.minMicro} µUSD owed.`,
      paidMicro,
    };
  }

  return { ok: true, paidMicro, from: toAuthor[0].from };
}
