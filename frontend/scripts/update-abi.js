#!/usr/bin/env node

/**
 * Script to update the neurolend ABI in contracts.ts from the compiled contract
 */

const fs = require("fs");
const path = require("path");

// Paths
const contractsDir = path.join(__dirname, "../contracts");
const abiPath = path.join(contractsDir, "out/neurolend.sol/neurolend.json");
const contractsFilePath = path.join(__dirname, "../src/lib/contracts.ts");

try {
  // Read the compiled contract
  const contractData = JSON.parse(fs.readFileSync(abiPath, "utf8"));
  const abi = contractData.abi;

  // Read the current contracts.ts file
  let contractsContent = fs.readFileSync(contractsFilePath, "utf8");

  // Find the start and end of the neurolend_ABI
  const abiStart = contractsContent.indexOf("export const neurolend_ABI = [");
  const abiEnd =
    contractsContent.indexOf("] as const;", abiStart) + "] as const;".length;

  if (abiStart === -1 || abiEnd === -1) {
    throw new Error("Could not find neurolend_ABI in contracts.ts");
  }

  // Create the new ABI string
  const newAbiString = `export const neurolend_ABI = ${JSON.stringify(abi, null, 2)} as const;`;

  // Replace the old ABI with the new one
  const newContent =
    contractsContent.substring(0, abiStart) +
    newAbiString +
    contractsContent.substring(abiEnd);

  // Write the updated file
  fs.writeFileSync(contractsFilePath, newContent, "utf8");

  console.log("✅ Successfully updated neurolend_ABI in contracts.ts");
  console.log(`📊 ABI contains ${abi.length} entries`);

  // List the function names for verification
  const functions = abi
    .filter((item) => item.type === "function")
    .map((item) => item.name)
    .sort();

  console.log(`🔍 Contract functions (${functions.length}):`);
  functions.forEach((name) => console.log(`  - ${name}`));
} catch (error) {
  console.error("❌ Error updating ABI:", error.message);
  process.exit(1);
}
