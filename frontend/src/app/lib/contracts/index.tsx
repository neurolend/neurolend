// neurolend Contract Configuration for zerog  Testnet
// Read contract address from environment (preferred for client: NEXT_PUBLIC_*, otherwise server-side)

import { defineChain } from "viem";

// Falls back to the previous hardcoded address if env not provided.
export const NEUROLEND_CONTRACT_ADDRESS: string =
  process.env.NEXT_PUBLIC_NEUROLEND_CONTRACT_ADDRESS ??
  "0xddDa4e2B1B8E6f06086F103dA6358E7aCbd020ec";

// Rewards System Contract Addresses
export const NEUROLEND_TOKEN_ADDRESS: string =
  process.env.NEXT_PUBLIC_NEUROLEND_TOKEN_ADDRESS ??
  "0x0000000000000000000000000000000000000000"; // Update after deployment

export const REWARDS_DISTRIBUTOR_ADDRESS: string =
  process.env.NEXT_PUBLIC_REWARDS_DISTRIBUTOR_ADDRESS ??
  "0x0000000000000000000000000000000000000000"; // Update after deployment

export const ZERO_G = defineChain({
  id: 1,
  name: "Zero_g_Testnet",
  network: "zero_g_testnet",
  nativeCurrency: {
    decimals: 18,
    name: "Zero_g",
    symbol: "0g",
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.zero_g_network"],
    },
    public: {
      http: ["https://rpc.zero_g_network"],
    },
  },
  blockExplorers: {
    default: {
      name: "Zero_g_Explorer",
      url: "https://explorer.testnet.zero_g_network",
    },
  },
  testnet: true,
});
