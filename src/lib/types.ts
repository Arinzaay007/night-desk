/**
 * Types for the subset of the Definitive Flash API this app uses.
 * Field shapes were taken from https://flash.definitive.fi/v1/openapi.json
 */

export type OrderType = 'market' | 'limit' | 'twap' | 'stop' | 'stop-loss' | 'take-profit' | 'bracket';
export type Side = 'buy' | 'sell';

export type OrderStatus =
  | 'ORDER_STATUS_UNSPECIFIED'
  | 'ORDER_STATUS_PENDING'
  | 'ORDER_STATUS_ACCEPTED'
  | 'ORDER_STATUS_PARTIALLY_FILLED'
  | 'ORDER_STATUS_FILLED'
  | 'ORDER_STATUS_CANCELLED'
  | 'ORDER_STATUS_REJECTED'
  | 'ORDER_STATUS_TERMINATED';

export interface QuoteLeg {
  asset: 'target' | 'contra';
  amount: string;
  notional: string;
}

export interface QuoteFees {
  /** Total fee in USD notional: Definitive's fee + integrator fee + gas. */
  estimatedFeeNotional: string;
}

/** Unsigned transaction the funder must send before submit (EIP-1559 {to,data}). */
export interface EvmTxRequest {
  to: string;
  data: string;
}

export interface QuoteEvmActions {
  approveTx?: EvmTxRequest | null;
  permitTypedData?: string | null;
  orderTypedData?: string | null;
}

export interface QuoteAttachedBracketSigning {
  evm?: {
    approveTx?: EvmTxRequest | null;
    permitTypedData?: string | null;
    orderTypedData?: string | null;
  } | null;
  salt?: string | null;
  deadline?: string | null;
  /**
   * Most of the received asset the bracket signature authorises selling.
   * Protection is capped here.
   */
  signedMaxFromAmount?: string | null;
}

export interface QuoteResponse {
  quoteId: string;
  bridgeQuoteId?: string | null;
  orderType: OrderType;
  side: Side;
  targetAsset: string;
  contraAsset: string;
  from: QuoteLeg;
  to: QuoteLeg;
  fees: QuoteFees;
  estimatedPriceImpact: string;
  recommendedSlippage?: string | null;
  wrap?: unknown;
  evm?: QuoteEvmActions | null;
  svm?: unknown;
  attachedBracket?: QuoteAttachedBracketSigning | null;
  setupTxs?: string[] | null;
}

export interface FlashAssetRef {
  id: string;
  name: string;
  address: string;
  ticker: string;
  chain: { id?: number; name?: string } & Record<string, unknown>;
}

export interface FlashOrderFilled {
  targetAmount: string | null;
  contraAmount: string | null;
  averagePrice: string | null;
  averageNotionalPrice: string | null;
}

export interface AttachedBracketReadLeg {
  notionalPrice?: string | null;
  crossPrice?: string | null;
  orderId?: string | null;
  status?: OrderStatus | null;
}

export interface AttachedBracketRead {
  /** pending_activation: goes live on the entry's first fill. active: bracket order exists. */
  status: 'pending_activation' | 'never_activated' | 'active';
  bracketOrderId: string | null;
  takeProfit: AttachedBracketReadLeg | null;
  stopLoss: AttachedBracketReadLeg | null;
  signedMaxFromAmount: string | null;
}

export interface FlashFill {
  status?: string;
  notional?: string;
  venues?: string[];
  filledAt?: string;
  rootOrderId?: string;
  orderId?: string;
  transactionId?: string;
  fillPrice?: string;
  feeAmount?: string;
  feeTicker?: string;
  /** Your integrator fee for this fill. */
  integratorFeeAmount?: string;
  feeNotional?: string;
}

export interface FlashOrder {
  orderId: string;
  orderType: OrderType;
  side: Side;
  status: OrderStatus;
  closeReason?: string | null;
  funderAddress: string;
  targetAsset: FlashAssetRef;
  contraAsset: FlashAssetRef;
  qty: string;
  filled?: FlashOrderFilled | null;
  limitNotionalPrice?: string | null;
  limitCrossPrice?: string | null;
  trigger?: { notionalPrice?: string | null; crossPrice?: string | null; triggerType?: string } | null;
  brackets?: unknown[] | null;
  attachedBracket?: AttachedBracketRead | null;
  sourceEntryOrderId?: string;
  twapBucketCount?: number | null;
  placedAt?: string;
  acceptedAt?: string;
}

export interface FlashGetOrderResponse extends FlashOrder {
  fills?: FlashFill[];
}

export interface FlashAsset {
  chain: string;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  price: string;
  liquidity: string;
  volume24h: string;
  holders?: number;
  riskFlagged?: boolean;
}

/**
 * Note the field name: the balances endpoint returns `tokenDecimals`, not
 * `decimals` (unlike /search, which returns `decimals`).
 */
export interface FlashTokenBalance {
  chain: string;
  address: string;
  symbol: string;
  tokenDecimals: number;
  balance: string;
  notional?: string;
  isNative?: boolean;
  imageUrl?: string;
}
