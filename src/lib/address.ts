/**
 * Address identity.
 *
 * WHY THIS EXISTS
 * ---------------
 * An Ethereum address is a twenty-byte number. It is written down in three
 * different spellings — all-lowercase, all-uppercase, and EIP-55 checksummed —
 * and those spellings are the SAME address. The checksummed form is the one
 * wallets display and people paste, precisely because the capitalisation is a
 * typo check.
 *
 * Every place that decides "is this the same wallet?" on a string comparison is
 * a place where the answer can be wrong for a spelling reason. That failure is
 * quiet and it is expensive: the author's page renders a zero balance and
 * "you earned nothing", which is indistinguishable from the product not paying
 * authors at all.
 *
 * So: normalise at the boundary, compare normalised everywhere, and never
 * compare two raw addresses with `===`. The ledger stores lowercase, because
 * that is the canonical key; the UI may display whatever the user gave us.
 */

/**
 * Canonical comparison key for an address (or any identifier arriving from a
 * request). Non-strings and blanks collapse to `''` rather than throwing.
 */
export function addrKey(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

/**
 * True when two values name the same address.
 *
 * Two blanks are NOT the same address: a missing author must never match a
 * missing record, or an earnings query with no author would return the whole
 * ledger.
 */
export function sameAddress(a: unknown, b: unknown): boolean {
  const left = addrKey(a);
  return left !== '' && left === addrKey(b);
}

/** True when the value looks like an address we can match on. */
export function isAddressLike(value: unknown): boolean {
  return /^0x[0-9a-f]{40}$/.test(addrKey(value));
}
