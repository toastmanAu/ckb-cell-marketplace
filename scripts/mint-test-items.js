#!/usr/bin/env node
/**
 * Mint test MarketItem cells on CKB testnet using CCC SDK.
 *
 * Usage:
 *   # Export testnet private key first:
 *   ckb-cli account export --lock-arg 0x98ecd69bb16e590486d6109bd129caf6b7ca02fe \
 *     --extended-privkey-path /tmp/testnet-key.txt
 *
 *   # Run:
 *   PRIVATE_KEY=$(head -1 /tmp/testnet-key.txt) node scripts/mint-test-items.js
 *
 *   # Clean up key file:
 *   rm /tmp/testnet-key.txt
 */

const { ccc } = require("@ckb-ccc/core");

// Our deployed type script
const MARKET_ITEM_TYPE_TX = "0xb23607df31ad02137f1836ad23e6ebe5dd864125d0e31ccd14d333937eb76388";
const MARKET_ITEM_TYPE_INDEX = 0;
const MARKET_ITEM_TYPE_ID = "0xa80b8554454d2b8cd619bcbd63895bb00b14709809e37806f6dbde0302e48a4f";

// Test items — mix of content types for Gallery vs Files view testing
const TEST_ITEMS = [
  {
    content_type: "image/svg+xml",
    description: "CKB Cell Diamond — SVG illustration of a CKB cell as a diamond shape",
    content: Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
      '<polygon points="50,5 95,50 50,95 5,50" fill="#3cc68a" stroke="#222" stroke-width="2"/>' +
      '<text x="50" y="55" text-anchor="middle" font-size="14" fill="white">CKB</text></svg>'
    ),
  },
  {
    content_type: "image/svg+xml",
    description: "Nervos Logo Minimal — clean SVG rendition of the Nervos hexagon",
    content: Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
      '<polygon points="50,10 90,30 90,70 50,90 10,70 10,30" fill="none" stroke="#3cc68a" stroke-width="3"/>' +
      '<text x="50" y="55" text-anchor="middle" font-size="12" fill="#3cc68a">N</text></svg>'
    ),
  },
  {
    content_type: "text/plain",
    description: "Genesis Memo — the first text document listed on CKB Cell Marketplace",
    content: Buffer.from(
      "The cell is the atom of state on CKB. Any data, any owner, any rules. " +
      "This is the first text item listed on the CKB Cell Marketplace."
    ),
  },
  {
    content_type: "application/json",
    description: "Marketplace Config v1 — JSON configuration demonstrating data file listings",
    content: Buffer.from(JSON.stringify({
      name: "ckb-cell-marketplace",
      version: "0.1.0",
      features: ["gallery", "files", "mint", "buy", "sell"],
      network: "testnet",
      type_id: MARKET_ITEM_TYPE_ID,
    }, null, 2)),
  },
  {
    content_type: "text/html",
    description: "Hello CKB — a tiny on-chain webpage stored entirely in a CKB cell",
    content: Buffer.from(
      '<!DOCTYPE html><html><body style="background:#111;color:#3cc68a;font-family:monospace;padding:2em">' +
      '<h1>Hello from CKB</h1><p>This webpage lives entirely on-chain.</p></body></html>'
    ),
  },
];

/**
 * Encode a MarketItem as molecule table bytes.
 * Table: total_size(4) + 3 offsets(12) + 3 Bytes fields (each: len(4) + data)
 */
function encodeMarketItem(contentType, description, content) {
  const ctBuf = Buffer.from(contentType);
  const descBuf = Buffer.from(description);
  const contBuf = Buffer.isBuffer(content) ? content : Buffer.from(content);

  const headerSize = 16;
  const ctFieldSize = 4 + ctBuf.length;
  const descFieldSize = 4 + descBuf.length;
  const contFieldSize = 4 + contBuf.length;
  const totalSize = headerSize + ctFieldSize + descFieldSize + contFieldSize;

  const buf = Buffer.alloc(totalSize);
  let off = 0;

  buf.writeUInt32LE(totalSize, off); off += 4;
  buf.writeUInt32LE(headerSize, off); off += 4;
  buf.writeUInt32LE(headerSize + ctFieldSize, off); off += 4;
  buf.writeUInt32LE(headerSize + ctFieldSize + descFieldSize, off); off += 4;

  buf.writeUInt32LE(ctBuf.length, off); off += 4;
  ctBuf.copy(buf, off); off += ctBuf.length;

  buf.writeUInt32LE(descBuf.length, off); off += 4;
  descBuf.copy(buf, off); off += descBuf.length;

  buf.writeUInt32LE(contBuf.length, off); off += 4;
  contBuf.copy(buf, off);

  return buf;
}

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error("Set PRIVATE_KEY env var (from ckb-cli account export)");
    console.error("  ckb-cli account export --lock-arg 0x98ecd69bb16e590486d6109bd129caf6b7ca02fe \\");
    console.error("    --extended-privkey-path /tmp/testnet-key.txt");
    console.error("  PRIVATE_KEY=$(head -1 /tmp/testnet-key.txt) node scripts/mint-test-items.js");
    process.exit(1);
  }

  const key = privateKey.startsWith("0x") ? privateKey : "0x" + privateKey;

  const client = new ccc.ClientPublicTestnet();
  const signer = new ccc.SignerCkbPrivateKey(client, key);
  const address = await signer.getRecommendedAddress();

  console.log("Minting from:", address);
  console.log("Items to mint:", TEST_ITEMS.length);
  console.log("");

  const txHashes = [];

  for (let i = 0; i < TEST_ITEMS.length; i++) {
    const item = TEST_ITEMS[i];
    console.log(`--- Item ${i + 1}/${TEST_ITEMS.length}: ${item.content_type} ---`);
    console.log(`  ${item.description.slice(0, 70)}`);

    const data = encodeMarketItem(item.content_type, item.description, item.content);
    const dataHex = ccc.hexFrom(data);

    // Build transaction
    const tx = ccc.Transaction.from({
      outputs: [
        {
          lock: await signer.getRecommendedAddressObj().then(a => a.script),
          type: {
            codeHash: MARKET_ITEM_TYPE_ID,
            hashType: "type",
            args: "0x",
          },
        },
      ],
      outputsData: [dataHex],
      cellDeps: [
        {
          outPoint: {
            txHash: MARKET_ITEM_TYPE_TX,
            index: MARKET_ITEM_TYPE_INDEX,
          },
          depType: "code",
        },
      ],
    });

    // Complete: adds capacity inputs, change output, fee
    await tx.completeInputsByCapacity(signer);
    await tx.completeFeeBy(signer, 1000);

    try {
      const txHash = await signer.sendTransaction(tx);
      console.log(`  TX: ${txHash}`);
      console.log(`  Data: ${data.length} bytes`);
      console.log("");
      txHashes.push({ type: item.content_type, desc: item.description, tx: txHash });

      // Wait for propagation
      await new Promise((r) => setTimeout(r, 4000));
    } catch (err) {
      console.error(`  FAILED: ${err.message}`);
      console.error("");
    }
  }

  console.log("=== Summary ===");
  for (const h of txHashes) {
    console.log(`  ${h.type.padEnd(20)} ${h.tx}`);
  }
  console.log("");
  console.log("Type script type_id:", MARKET_ITEM_TYPE_ID);
  console.log("Check: https://pudge.explorer.nervos.org/");

  await client.disconnect();
}

main().catch(console.error);
