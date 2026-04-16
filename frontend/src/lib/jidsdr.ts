import { ccc } from '@ckb-ccc/connector-react';
import { createClient } from './indexer';

// JIDSDR adapter for cellswap. Reads and writes the user's on-chain
// settings cell using the same format as toastmanAu/jidsdr Phase 1:
//
//   Cell data: [0x01][UTF-8 JSON]
//   Lock: user's JoyID lock (no type script in Phase 1)
//
// Cellswap's prefs live under the "cellswap" key in the shared JSON
// so multiple apps (Wyltek Studio, CellSwap, etc.) coexist in one cell:
//   { "cellswap": { "sortOrder": "newest", "viewMode": "gallery" }, "wyltek": { ... } }
//
// This module uses cellswap's existing CCC signer — NOT JIDSDR's
// standalone JoyId.CkbSigner — to avoid dual-signer popup conflicts.

const SETTINGS_VERSION = 0x01;
const APP_KEY = 'cellswap';

function encodeSettings(settings: Record<string, unknown>): string {
  const json = JSON.stringify(settings);
  const encoder = new TextEncoder();
  const jsonBytes = encoder.encode(json);
  const data = new Uint8Array(1 + jsonBytes.length);
  data[0] = SETTINGS_VERSION;
  data.set(jsonBytes, 1);
  return ccc.hexFrom(data);
}

function decodeSettings(dataHex: string): Record<string, unknown> | null {
  const hex = dataHex.startsWith('0x') ? dataHex.slice(2) : dataHex;
  if (hex.length < 4) return null;
  const versionByte = parseInt(hex.slice(0, 2), 16);
  if (versionByte !== SETTINGS_VERSION) return null;

  const bytes = new Uint8Array(
    hex.slice(2).match(/.{2}/g)!.map((b) => parseInt(b, 16)),
  );
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

export interface JidsdrResult {
  cell: ccc.Cell;
  allSettings: Record<string, unknown>;
}

/** Scan the user's live cells for a JIDSDR settings cell (version 0x01 prefix). */
export async function findSettingsCell(
  userLock: ccc.Script,
): Promise<JidsdrResult | null> {
  const client = createClient();
  const iter = client.findCellsByLock(userLock, null, true);

  for await (const cell of iter) {
    const data = cell.outputData;
    if (!data || data === '0x') continue;
    const settings = decodeSettings(ccc.hexFrom(data));
    if (settings) {
      return { cell, allSettings: settings };
    }
  }
  return null;
}

/** Read just cellswap's prefs from the on-chain settings cell. */
export async function readCellswapPrefs(
  userLock: ccc.Script,
): Promise<Record<string, unknown> | null> {
  const result = await findSettingsCell(userLock);
  if (!result) return null;
  const appPrefs = result.allSettings[APP_KEY];
  return typeof appPrefs === 'object' && appPrefs !== null
    ? (appPrefs as Record<string, unknown>)
    : null;
}

/** Write cellswap's prefs to the on-chain settings cell, preserving other apps' data. */
export async function writeCellswapPrefs(
  signer: ccc.Signer,
  userLock: ccc.Script,
  prefs: Record<string, unknown>,
  onStatus: (msg: string) => void = () => {},
): Promise<string> {
  onStatus('Reading existing settings from chain...');
  const existing = await findSettingsCell(userLock);

  const merged = {
    ...(existing?.allSettings ?? {}),
    [APP_KEY]: prefs,
  };

  const dataHex = encodeSettings(merged);
  const dataBytes = ccc.bytesFrom(dataHex);

  // Calculate occupied capacity: 8 (capacity field) + lock bytes + data bytes
  const lockBytes = userLock.toBytes().length;
  const occupiedBytes = 8 + lockBytes + dataBytes.length;
  const requiredCapacity = BigInt(occupiedBytes) * 100000000n;

  onStatus('Building transaction...');

  const tx = ccc.Transaction.from({
    outputs: [{
      lock: userLock,
      capacity: requiredCapacity,
    }],
    outputsData: [dataHex],
  });

  if (existing) {
    tx.inputs.push(
      ccc.CellInput.from({
        previousOutput: existing.cell.outPoint,
      }),
    );
  }

  await tx.completeFeeBy(signer);

  onStatus('Signing with JoyID...');
  const txHash = await signer.sendTransaction(tx);

  onStatus(`Saved on-chain: ${txHash}`);
  return txHash;
}
