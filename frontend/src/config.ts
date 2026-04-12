// config.ts — All contract addresses and network config in one file.
// Forkers: change these values to point at your own deployed contracts.

export const NETWORK = 'testnet' as const;

export const RPC_URL = 'https://testnet.ckb.dev/rpc';
export const INDEXER_URL = 'https://testnet.ckb.dev/indexer';

// market-item-type (type script validating MarketItem envelope)
export const MARKET_ITEM_TYPE = {
  TX_HASH: '0xb23607df31ad02137f1836ad23e6ebe5dd864125d0e31ccd14d333937eb76388',
  INDEX: 0,
  TYPE_ID: '0xa80b8554454d2b8cd619bcbd63895bb00b14709809e37806f6dbde0302e48a4f',
  DATA_HASH: '0x613bdff5b54154ae98338488cf0173fff0a0cbfc785534c38f24425a678e530f',
};

// LSDL (lock script handling sales with royalties and expiration)
export const LSDL = {
  TX_HASH: '0xfc5fc948a406a6b7bc5636642d57d462a0789479dd1197dbb14a35079c936dd3',
  INDEX: 0,
  TYPE_ID: '0xd1e6732bccd4f047949519f90c90a4372de0732976313442f6a708849dd07af5',
  DATA_HASH: '0xbf3b13493c34a991a8885c9670d05873960cb18b04628a72ce5ea186ddee5612',
};

// CKB explorer base URLs
export const EXPLORER_URL = 'https://testnet.explorer.nervos.org';

// Minimum CKB capacity for a cell (61 CKB for basic cell)
export const MIN_CELL_CAPACITY = 6100000000n; // 61 CKB in shannons
