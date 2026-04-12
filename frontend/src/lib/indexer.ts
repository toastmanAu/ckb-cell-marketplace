import { ccc } from '@ckb-ccc/connector-react';
import { MARKET_ITEM_TYPE, LSDL } from '../config';
import { decodeMarketItem, decodeLsdlArgs } from './codec';
import type { ListingInfo, OwnedItem } from '../types';

/** Create a CCC testnet client for indexer queries */
export function createClient(): ccc.ClientPublicTestnet {
  return new ccc.ClientPublicTestnet();
}

/** Fetch all currently listed MarketItems (cells locked by LSDL with market-item-type) */
export async function fetchListings(client: ccc.Client): Promise<ListingInfo[]> {
  const listings: ListingInfo[] = [];

  // Use prefix mode so any LSDL args (owner-specific) are matched.
  // findCellsByLock uses exact mode, so we use findCells directly here.
  const iter = client.findCells(
    {
      script: {
        codeHash: LSDL.DATA_HASH,
        hashType: 'data1',
        args: '0x',
      },
      scriptType: 'lock',
      scriptSearchMode: 'prefix',
      filter: {
        script: {
          codeHash: MARKET_ITEM_TYPE.TYPE_ID,
          hashType: 'type',
          args: '0x',
        },
      },
      withData: true,
    },
    'desc',
    100,
  );

  for await (const cell of iter) {
    try {
      const data = cell.outputData;
      if (!data || data.length === 0) continue;

      // outputData is a Hex string — convert to bytes before decoding
      const dataBytes = ccc.bytesFrom(data);
      const marketItem = decodeMarketItem(dataBytes);
      const lsdlArgs = decodeLsdlArgs(ccc.hexFrom(cell.cellOutput.lock.args));

      listings.push({
        outPoint: cell.outPoint,
        capacity: cell.cellOutput.capacity,
        marketItem,
        lsdlArgs,
      });
    } catch {
      // Skip malformed cells
    }
  }

  return listings;
}

/** Fetch MarketItem cells owned by the connected wallet (not listed) */
export async function fetchOwnedItems(
  client: ccc.Client,
  userLock: ccc.Script,
): Promise<OwnedItem[]> {
  const items: OwnedItem[] = [];

  // findCellsByLock uses exact match — correct here since we want exactly userLock
  const iter = client.findCellsByLock(
    userLock,
    {
      codeHash: MARKET_ITEM_TYPE.TYPE_ID,
      hashType: 'type',
      args: '0x',
    },
    true,
    'desc',
    100,
  );

  for await (const cell of iter) {
    try {
      const data = cell.outputData;
      if (!data || data.length === 0) continue;

      const dataBytes = ccc.bytesFrom(data);
      const marketItem = decodeMarketItem(dataBytes);

      items.push({
        outPoint: cell.outPoint,
        capacity: cell.cellOutput.capacity,
        marketItem,
      });
    } catch {
      // Skip malformed
    }
  }

  return items;
}

/** Fetch items listed by a specific user (LSDL-locked, owner matches) */
export async function fetchMyListings(
  client: ccc.Client,
  userLock: ccc.Script,
): Promise<ListingInfo[]> {
  const all = await fetchListings(client);
  return all.filter(listing => {
    return listing.lsdlArgs.ownerLock.eq(userLock);
  });
}

/** Fetch a single cell by outpoint */
export async function fetchCell(
  client: ccc.Client,
  outPoint: ccc.OutPointLike,
): Promise<ccc.Cell | undefined> {
  return client.getCellLive(outPoint, true);
}
