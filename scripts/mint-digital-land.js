#!/usr/bin/env node
/**
 * Mint "Digital Land" Spore DOB collection on CKB testnet.
 *
 * Creates a Spore Cluster, then mints each image as a Spore DOB
 * with the image data stored inline in the Spore cell.
 *
 * Note: For testnet, inline storage is fine (images are 57-105KB each,
 * capacity is cheap on testnet). For mainnet, switch to CKBFS storage.
 *
 * Usage:
 *   ckb-cli account export --lock-arg 0x98ecd69bb16e590486d6109bd129caf6b7ca02fe \
 *     --extended-privkey-path /tmp/testnet-key.txt
 *
 *   PRIVATE_KEY=$(head -1 /tmp/testnet-key.txt) node scripts/mint-digital-land.js
 *   rm /tmp/testnet-key.txt
 */

const fs = require("fs");
const path = require("path");
const { RPC, Indexer, helpers, hd, commons } = require("@ckb-lumos/lumos");
const {
  createCluster,
  createSpore,
  getSporeConfig,
} = require("@spore-sdk/core");

// --- Config ---
const CKB_RPC = "https://testnet.ckb.dev/rpc";
const CKB_INDEXER = "https://testnet.ckb.dev/indexer";
const IMAGE_DIR = path.join(process.env.HOME, "Documents/nft_images/digital_land_optimized");

// MUST initialize lumos config for testnet before any address operations
const { config } = require("@ckb-lumos/lumos");
config.initializeConfig(config.predefined.AGGRON4);

// Image descriptions — each tells a story about the digital land
const DESCRIPTIONS = {
  "wyltek-studio_00182_": "Cyber Lounge — A neon-lit digital command center with holographic displays and blockchain dashboards",
  "wyltek-studio_00183_": "Node Operations — Cyberpunk office space monitoring distributed network infrastructure",
  "wyltek-studio_00190_": "The Lab — Cozy tech workspace where blockchain nodes meet real-world comfort",
  "wyltek-studio_00199_": "Grid City — Isometric view of a sprawling cyberpunk metropolis with amber circuits",
  "wyltek-studio_00203_": "Neon Rain — Rain-soaked cyberpunk street with towering neon advertisements",
  "wyltek-studio_00215_": "Skyline Rush — Futuristic cityscape with hovercars and blazing neon towers",
  "wyltek-studio_00217_": "Highway to Tomorrow — A sleek supercar races through a neon-drenched megacity",
  "wyltek-studio_00223_": "Twilight Towers — Sunset over a crystalline cyberpunk skyline",
  "wyltek-studio_00225_": "Cloud District — Upper atmosphere view of a city stretching into the stratosphere",
  "wyltek-studio_00227_": "Night Market — Bustling cyberpunk street level with hovering traffic above",
  "wyltek-studio_00229_": "Eden Valley — Sunlit biodome farms where agriculture meets advanced technology",
  "wyltek-studio_00241_": "Harvest Domes — Aerial view of geodesic greenhouses across rolling countryside",
  "wyltek-studio_00252_": "Solar Fields — Glass biodomes catching golden sunset over orderly crop rows",
  "wyltek-studio_00253_": "Dome Gardens — Aerial biodome complex surrounded by precision farmland",
  "wyltek-studio_00255_": "Neon Canopy — Bioluminescent forest with glowing trees and crystal pathways",
  "wyltek-studio_00256_": "Digital Forest — Enchanted woods pulsing with magenta and teal energy streams",
  "wyltek-studio_00257_": "The Path — A winding creek through a neon-laced primordial forest",
};

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error("Set PRIVATE_KEY env var. See script header for instructions.");
    process.exit(1);
  }
  const key = privateKey.startsWith("0x") ? privateKey : "0x" + privateKey;

  // Derive sender address
  const pubKey = hd.key.privateToPublic(key);
  const args = hd.key.publicKeyToBlake160(pubKey);
  const senderLock = {
    codeHash: "0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8",
    hashType: "type",
    args: args,
  };
  const fromAddress = helpers.encodeToAddress(senderLock);
  const rpc = new RPC(CKB_RPC);

  console.log("=== Digital Land Collection — Spore DOB Mint ===");
  console.log("From:", fromAddress);
  console.log("");

  // Load images
  const files = fs.readdirSync(IMAGE_DIR)
    .filter(f => f.endsWith(".jpg"))
    .sort();
  console.log(`Found ${files.length} images to mint`);
  console.log("");

  // --- Step 1: Create Cluster ---
  console.log("--- Creating 'Digital Land' Cluster ---");

  const { txSkeleton: clusterTxSkeleton, outputIndex: clusterOutputIndex } = await createCluster({
    data: {
      name: "Digital Land",
      description: "Visions of the future — cyberpunk cities, biodome farms, neon forests. AI-generated digital landscapes by Wyltek Studio, permanently stored on CKB.",
    },
    fromInfos: [fromAddress],
    toLock: senderLock,
  });

  // Sign cluster tx
  const clusterSignedTx = signTransaction(clusterTxSkeleton, key);
  const clusterTxHash = await rpc.sendTransaction(clusterSignedTx, "passthrough");
  console.log(`  Cluster TX: ${clusterTxHash}`);
  console.log(`  Cluster output index: ${clusterOutputIndex}`);

  // Derive cluster ID from the transaction
  // Cluster ID = type script args = hash(first_input.previous_output || output_index)
  const clusterTypeScript = clusterSignedTx.outputs[clusterOutputIndex].type;
  const clusterId = clusterTypeScript.args;
  console.log(`  Cluster ID: ${clusterId}`);
  console.log("");

  // Wait for cluster tx to confirm
  console.log("  Waiting for cluster tx to confirm...");
  await waitForTx(rpc, clusterTxHash);
  console.log("  Confirmed!");
  console.log("");

  // --- Step 2: Mint each image as a Spore ---
  const results = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const stem = path.basename(file, ".jpg");
    const desc = DESCRIPTIONS[stem] || `Digital Land #${i + 1}`;
    const imagePath = path.join(IMAGE_DIR, file);
    const imageData = fs.readFileSync(imagePath);

    console.log(`--- Minting ${i + 1}/${files.length}: ${desc.split(" — ")[0]} ---`);
    console.log(`  File: ${file} (${(imageData.length / 1024).toFixed(1)} KB)`);

    try {
      const { txSkeleton: sporeTxSkeleton, outputIndex: sporeOutputIndex } = await createSpore({
        data: {
          contentType: "image/jpeg",
          content: imageData,
          clusterId: clusterId,
        },
        fromInfos: [fromAddress],
        toLock: senderLock,
        cluster: {
          id: clusterId,
        },
      });

      const signedTx = signTransaction(sporeTxSkeleton, key);
      const txHash = await rpc.sendTransaction(signedTx, "passthrough");

      const sporeTypeScript = signedTx.outputs[sporeOutputIndex].type;
      const sporeId = sporeTypeScript.args;

      console.log(`  TX: ${txHash}`);
      console.log(`  Spore ID: ${sporeId}`);
      console.log("");

      results.push({ name: desc.split(" — ")[0], file, txHash, sporeId });

      // Wait for confirmation before next mint (cluster cell needs to be available)
      if (i < files.length - 1) {
        console.log("  Waiting for confirmation...");
        await waitForTx(rpc, txHash);
        console.log("  Confirmed!");
        console.log("");
      }
    } catch (err) {
      console.error(`  FAILED: ${err.message}`);
      console.error("");
      // Continue with remaining images
    }
  }

  // --- Summary ---
  console.log("=== Mint Summary ===");
  console.log(`Cluster: Digital Land (${clusterId})`);
  console.log(`Minted: ${results.length}/${files.length}`);
  console.log("");
  console.log("| # | Name | Spore ID |");
  console.log("|---|------|----------|");
  for (let i = 0; i < results.length; i++) {
    console.log(`| ${i + 1} | ${results[i].name} | ${results[i].sporeId.slice(0, 18)}... |`);
  }
  console.log("");

  // Save results to file
  const resultsPath = path.join(__dirname, "../docs/digital-land-mint-results.json");
  fs.mkdirSync(path.dirname(resultsPath), { recursive: true });
  fs.writeFileSync(resultsPath, JSON.stringify({ clusterId, mints: results }, null, 2));
  console.log(`Results saved to: ${resultsPath}`);
}

/**
 * Sign a lumos TransactionSkeleton with a private key.
 */
function signTransaction(txSkeleton, privateKey) {
  const preparedTx = commons.common.prepareSigningEntries(txSkeleton);
  const signingEntries = preparedTx.get("signingEntries").toArray();
  const signatures = signingEntries.map((entry) =>
    hd.key.signRecoverable(entry.message, privateKey)
  );
  return helpers.sealTransaction(preparedTx, signatures);
}

/**
 * Wait for a transaction to be committed on-chain.
 */
async function waitForTx(rpc, txHash, timeoutMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await rpc.getTransaction(txHash);
    if (result && result.txStatus && result.txStatus.status === "committed") {
      return;
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error(`Transaction ${txHash} not confirmed within ${timeoutMs / 1000}s`);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
