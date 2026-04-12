import { ccc } from '@ckb-ccc/connector-react';

/** Decoded MarketItem cell data (from molecule bytes) */
export interface MarketItem {
  contentType: string;
  description: string;
  content: Uint8Array;
}

/** Decoded LSDL lock args */
export interface DecodedLsdlArgs {
  ownerLock: ccc.Script;
  totalValue: bigint;
  creatorLockHash: Uint8Array;
  royaltyBps: number;
  expiryEpoch: bigint;
}

/** A listed item = MarketItem content + LSDL sale terms + cell reference */
export interface ListingInfo {
  outPoint: ccc.OutPoint;
  capacity: bigint;
  marketItem: MarketItem;
  lsdlArgs: DecodedLsdlArgs;
}

/** An owned (unlisted) MarketItem cell */
export interface OwnedItem {
  outPoint: ccc.OutPoint;
  capacity: bigint;
  marketItem: MarketItem;
}

/** Content type categories for UI badges and rendering */
export type ContentCategory = 'image' | 'text' | 'data' | 'html';

/** TX processing states */
export type TxState =
  | { status: 'idle' }
  | { status: 'building'; message: string }
  | { status: 'signing' }
  | { status: 'broadcasting' }
  | { status: 'confirming'; txHash: string }
  | { status: 'success'; txHash: string }
  | { status: 'error'; message: string };
