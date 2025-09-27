#!/usr/bin/env node

/**
 * Script to verify loan creation via both contract calls and REST API
 */

const { ethers } = require("ethers");

// Configuration
const CONTRACT_ADDRESS = "0x064c3e0a900743D9Ac87c778d2f6d3d5819D4f23";
const RPC_URL = "https://evmrpc.0g.ai";
const API_URL = "https://api.neurolend.sumitdhiman.in/loans";

// Simple ABI for the functions we need
const ABI = [
  "function nextLoanId() view returns (uint256)",
  "function getActiveLoanOffersCount() view returns (uint256)",
  "function loans(uint256) view returns (tuple(uint256 id, address lender, address borrower, address tokenAddress, uint256 amount, uint256 interestRate, uint256 duration, address collateralAddress, uint256 collateralAmount, uint256 startTime, uint8 status, uint256 minCollateralRatioBPS, uint256 liquidationThresholdBPS, uint256 maxPriceStaleness, uint256 repaidAmount))",
];

async function verifyContractData() {
  console.log("🔍 Checking contract data on 0G Chain...\n");

  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

    // Get next loan ID (tells us how many loans exist)
    const nextLoanId = await contract.nextLoanId();
    console.log(`📊 Next Loan ID: ${nextLoanId.toString()}`);
    console.log(`📊 Total loans created: ${Number(nextLoanId) - 1}`);

    // Get active loan offers count
    const activeCount = await contract.getActiveLoanOffersCount();
    console.log(`📊 Active loan offers: ${activeCount.toString()}`);

    // Get details of loan ID 1 if it exists
    if (Number(nextLoanId) > 1) {
      console.log("\n📋 Loan ID 1 Details:");
      const loanData = await contract.loans(1);

      console.log(`  ID: ${loanData.id.toString()}`);
      console.log(`  Lender: ${loanData.lender}`);
      console.log(`  Borrower: ${loanData.borrower}`);
      console.log(`  Token: ${loanData.tokenAddress}`);
      console.log(`  Amount: ${ethers.formatEther(loanData.amount)} ETH`);
      console.log(
        `  Interest Rate: ${Number(loanData.interestRate)} basis points (${Number(loanData.interestRate) / 100}%)`
      );
      console.log(
        `  Duration: ${Number(loanData.duration)} seconds (${Number(loanData.duration) / 86400} days)`
      );
      console.log(`  Collateral Token: ${loanData.collateralAddress}`);
      console.log(
        `  Collateral Amount: ${ethers.formatUnits(loanData.collateralAmount, 6)} (assuming 6 decimals)`
      );
      console.log(
        `  Status: ${loanData.status} (0=Pending, 1=Active, 2=Repaid, 3=Defaulted, 4=Cancelled)`
      );
    }

    return {
      totalLoans: Number(nextLoanId) - 1,
      activeOffers: Number(activeCount),
      hasLoan1: Number(nextLoanId) > 1,
    };
  } catch (error) {
    console.error("❌ Error checking contract:", error.message);
    return null;
  }
}

async function verifyAPIData() {
  console.log("\n🌐 Checking REST API data...\n");

  try {
    const response = await fetch(API_URL);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const loans = await response.json();
    console.log(`📊 API returned ${loans.length} loans`);

    if (loans.length > 0) {
      console.log("\n📋 API Loan Data:");
      loans.forEach((loan, index) => {
        console.log(`\n  Loan ${index + 1}:`);
        console.log(`    ID: ${loan.loan_id}`);
        console.log(`    Lender: ${loan.lender || "null"}`);
        console.log(`    Borrower: ${loan.borrower}`);
        console.log(
          `    Amount: ${loan.amount} wei (${ethers.formatEther(loan.amount)} ETH)`
        );
        console.log(`    Status: ${loan.status}`);
        console.log(
          `    Created: ${new Date(loan.created_at * 1000).toISOString()}`
        );
        console.log(`    Events: ${loan.events_count}`);
      });
    }

    return {
      totalLoans: loans.length,
      loans: loans,
    };
  } catch (error) {
    console.error("❌ Error checking API:", error.message);
    return null;
  }
}

async function main() {
  console.log("🚀 neurolend Loan Verification\n");
  console.log("=====================================\n");

  // Check contract data
  const contractData = await verifyContractData();

  // Check API data
  const apiData = await verifyAPIData();

  // Compare results
  console.log("\n📊 SUMMARY");
  console.log("=====================================");

  if (contractData && apiData) {
    console.log(`✅ Contract shows ${contractData.totalLoans} loans created`);
    console.log(`✅ API shows ${apiData.totalLoans} loans`);
    console.log(`✅ Active offers: ${contractData.activeOffers}`);

    if (contractData.totalLoans === apiData.totalLoans) {
      console.log("🎉 SUCCESS: Contract and API data match!");
    } else {
      console.log("⚠️  WARNING: Contract and API data don't match");
    }

    if (contractData.hasLoan1 && apiData.loans.some((l) => l.loan_id === "1")) {
      console.log("✅ Loan ID 1 exists in both contract and API");
    } else if (contractData.hasLoan1) {
      console.log("⚠️  Loan ID 1 exists in contract but not in API");
    }
  } else {
    console.log("❌ Failed to verify data from one or both sources");
  }

  console.log("\n🎯 Your loan creation was successful!");
}

main().catch(console.error);
