/**
 * Cancel message construction.
 *
 * Flash validates this string **byte-for-byte** server-side, so it lives in one
 * place and is used by both the client (which signs it) and the server (which
 * checks it before forwarding).
 *
 * The separator after `v1` is an em dash (U+2014), not a hyphen, and the line
 * break is a single \n. Getting either wrong produces a signature that verifies
 * locally but is rejected by the API.
 */
export const CANCEL_PREFIX = 'Definitive Flash v1 \u2014 Cancel Order';

export const cancelMessageFor = (orderId: string): string =>
  `${CANCEL_PREFIX}\nOrder: ${orderId}`;

/** Validates that a message is exactly the one we expect for this order. */
export const isValidCancelMessage = (orderId: string, message: string): boolean =>
  message === cancelMessageFor(orderId);

/**
 * Filled positions get closed by selling into USDC — a plain market sell with
 * no bracket. Cancelling the entry is a different action entirely.
 */
export const isCancellable = (status?: string | null): boolean =>
  status === 'ORDER_STATUS_PENDING' ||
  status === 'ORDER_STATUS_ACCEPTED' ||
  status === 'ORDER_STATUS_PARTIALLY_FILLED';
