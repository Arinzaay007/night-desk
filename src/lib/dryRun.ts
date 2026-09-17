'use client';

/**
 * Dry-run mode: rehearse the entire flow against the live market and stop only
 * where money would move.
 *
 * Quotes are real. Signatures are real — a rehearsal that skips the wallet
 * prompts rehearses the wrong thing. The order route runs every validation and
 * assembles the exact payload Flash would receive, then stops short of the
 * outbound call and writes nothing to the board. Approvals are skipped because
 * they are the one step that costs gas.
 *
 * Why this exists: Definitive Flash has no testnet. Testnets are not valid
 * chain values in their API and the tokenized equities only exist on mainnet,
 * so the only way to protect real funds is (a) verify everything that can be
 * verified for free, and (b) rehearse the UI before spending.
 *
 * It is OFF unless NEXT_PUBLIC_DRY_RUN=1, and it is deliberately loud when on
 * so nobody ever mistakes a rehearsal for a real trade.
 */
export const DRY_RUN = process.env.NEXT_PUBLIC_DRY_RUN === '1';

/*
 * The precise wording matters. Earlier this said "nothing is submitted", which
 * stopped being true once the rehearsal was upgraded to walk the real path: it
 * signs for real and it posts to our own order route, which validates and
 * assembles the payload in full before stopping short of the exchange. What is
 * actually withheld is the approvals (they cost gas) and the outbound call.
 */
export const DRY_RUN_LABEL =
  'DRY RUN — live quotes, real signatures, nothing sent to the exchange';
