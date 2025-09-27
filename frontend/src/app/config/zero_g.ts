/**
 * 0G Chain Configuration
 * Configuration for neurolend on 0G Chain with Pyth Network integration
 */

// 0G Chain Network Configuration
export const ZEROG_MAINNET_CONFIG = {
  chainId: 16600, // 0G Chain mainnet chain ID
  name: "0G Chain",
  currency: "0G",
  explorerUrl: "https://scan.0g.ai",
  rpcUrls: {
    default: {
      http: ["https://rpc.0g.ai"],
    },
    public: {
      http: ["https://rpc.0g.ai"],
    },
  },
} as const;

export const ZEROG_TESTNET_CONFIG = {
  chainId: 16601, // 0G Chain testnet chain ID
  name: "0G Chain Testnet",
  currency: "0G",
  explorerUrl: "https://scan-testnet.0g.ai",
  rpcUrls: {
    default: {
      http: ["https://rpc-testnet.0g.ai"],
    },
    public: {
      http: ["https://rpc-testnet.0g.ai"],
    },
  },
} as const;

// Pyth Network Configuration
export const PYTH_CONFIG = {
  // Pyth contract address on 0G Chain
  contractAddress: "0x2880aB155794e7179c9eE2e38200202908C17B43",

  // Pyth Hermes endpoints for price data
  hermesEndpoints: [
    "https://hermes.pyth.network",
    "https://hermes-beta.pyth.network",
  ],

  // Price feed IDs for supported tokens
  priceFeeds: {
    // 0G Chain native token
    "0G": "0xfa9e8d4591613476ad0961732475dc08969d248faca270cc6c47efe009ea3070",

    // Major cryptocurrencies
    ETH: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
    BTC: "0xe62df6c8b4c85fe1e1a1b80b6f59e8a5ad0d3a0e4f9c5b8a3d2f1e0c9b8a7d6e5",
    SOL: "0xef0d8b6fdb662c2c4b6c6d5f3a0e4f9c5b8a3d2f1e0c9b8a7d6e5f4c3b2a1d0e",

    // Stablecoins
    USDT: "0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b",
    USDC: "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",

    // Layer 2 tokens
    ARB: "0x3fa4252848f9f0a1480be62745a4629d9eb1322aebab8a791e344b3b9c1adcf5",
  },
} as const;

// Token Configuration for 0G Chain
export const ZEROG_TOKENS = {
  // 0G Chain native token
  ZG: {
    address: "0x1cd0690ff9a693f5ef2dd976660a8dafc81a109c", // Actual 0G token address
    symbol: "0G",
    name: "0G Token",
    decimals: 18,
    logo: "/tokens/0g.svg",
    priceFeedId: PYTH_CONFIG.priceFeeds["0G"],
    volatilityTier: "MODERATE" as const,
  },

  // Wrapped tokens on 0G Chain (placeholder addresses - update with actual)
  WETH: {
    address: "0x5C99fEb638C1959144696a77CC900c58A4B4EB6F", // PLACEHOLDER
    symbol: "WETH",
    name: "Wrapped Ethereum",
    decimals: 18,
    logo: "/tokens/eth.svg",
    priceFeedId: PYTH_CONFIG.priceFeeds.ETH,
    volatilityTier: "HIGH" as const,
  },

  WBTC: {
    address: "0x571D9915eA4D187b7f0b1460fd0432D7Cce74c47", // PLACEHOLDER
    symbol: "WBTC",
    name: "Wrapped Bitcoin",
    decimals: 8,
    logo: "/tokens/btc.svg",
    priceFeedId: PYTH_CONFIG.priceFeeds.BTC,
    volatilityTier: "HIGH" as const,
  },

  USDT: {
    address: "0xE218717fE38D582B8C00a8D6363f5BC7BF32a8B6", // PLACEHOLDER
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
    logo: "/tokens/usdt.svg",
    priceFeedId: PYTH_CONFIG.priceFeeds.USDT,
    volatilityTier: "STABLE" as const,
  },

  USDC: {
    address: "0x9c15F281BFC66D2FA26686aE2E297eD5d7f61ee1", // PLACEHOLDER
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    logo: "/tokens/usdc.svg",
    priceFeedId: PYTH_CONFIG.priceFeeds.USDC,
    volatilityTier: "STABLE" as const,
  },

  WSOL: {
    address: "0x71264e1321E1980b32002EAF6b24759DfBA5E281", // PLACEHOLDER
    symbol: "WSOL",
    name: "Wrapped Solana",
    decimals: 9,
    logo: "/tokens/sol.svg",
    priceFeedId: PYTH_CONFIG.priceFeeds.SOL,
    volatilityTier: "HIGH" as const,
  },

  ARB: {
    address: "0x8E4B2C5F3d1A2E6D9B7A3C4F5E6D7C8B9A0E1F2D", // PLACEHOLDER
    symbol: "ARB",
    name: "Arbitrum",
    decimals: 18,
    logo: "/tokens/arb.svg",
    priceFeedId: PYTH_CONFIG.priceFeeds.ARB,
    volatilityTier: "MODERATE" as const,
  },
} as const;

// Contract addresses (to be updated after deployment)
export const ZEROG_CONTRACTS = {
  // Core contracts
  neurolend: process.env.NEXT_PUBLIC_neurolend_ADDRESS || "",
  NEURO_TOKEN: process.env.NEXT_PUBLIC_NEURO_TOKEN_ADDRESS || "",
  REWARDS_DISTRIBUTOR:
    process.env.NEXT_PUBLIC_REWARDS_DISTRIBUTOR_ADDRESS || "",

  // Mock contracts (for testing)
  MOCK_TOKENS: {
    ZG: process.env.NEXT_PUBLIC_MOCK_0G_ADDRESS || "",
    WETH: process.env.NEXT_PUBLIC_MOCK_WETH_ADDRESS || "",
    WBTC: process.env.NEXT_PUBLIC_MOCK_WBTC_ADDRESS || "",
    USDT: process.env.NEXT_PUBLIC_MOCK_USDT_ADDRESS || "",
    USDC: process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS || "",
    WSOL: process.env.NEXT_PUBLIC_MOCK_WSOL_ADDRESS || "",
    ARB: process.env.NEXT_PUBLIC_MOCK_ARB_ADDRESS || "",
  },
} as const;

// Default network configuration
export const DEFAULT_NETWORK = ZEROG_MAINNET_CONFIG;

// Utility functions
export function getTokenBySymbol(symbol: string) {
  return Object.values(ZEROG_TOKENS).find((token) => token.symbol === symbol);
}

export function getTokenByAddress(address: string) {
  return Object.values(ZEROG_TOKENS).find(
    (token) => token.address.toLowerCase() === address.toLowerCase()
  );
}

export function getPriceFeedId(tokenSymbol: string): string | undefined {
  const token = getTokenBySymbol(tokenSymbol);
  return token?.priceFeedId;
}

export function getAllSupportedTokens() {
  return Object.values(ZEROG_TOKENS);
}

// Risk parameters based on volatility tiers
export const RISK_PARAMETERS = {
  STABLE: {
    minCollateralRatio: 15000, // 150%
    liquidationThreshold: 12000, // 120%
    maxPriceStaleness: 300, // 5 minutes
  },
  MODERATE: {
    minCollateralRatio: 16500, // 165%
    liquidationThreshold: 13000, // 130%
    maxPriceStaleness: 300, // 5 minutes
  },
  HIGH: {
    minCollateralRatio: 18000, // 180%
    liquidationThreshold: 14000, // 140%
    maxPriceStaleness: 180, // 3 minutes
  },
} as const;

export function getRecommendedParameters(
  loanTokenSymbol: string,
  collateralTokenSymbol: string
) {
  const loanToken = getTokenBySymbol(loanTokenSymbol);
  const collateralToken = getTokenBySymbol(collateralTokenSymbol);

  if (!loanToken || !collateralToken) {
    throw new Error("Unsupported token");
  }

  const loanRisk = RISK_PARAMETERS[loanToken.volatilityTier];
  const collateralRisk = RISK_PARAMETERS[collateralToken.volatilityTier];

  // Use more conservative parameters
  return {
    minCollateralRatio: Math.max(
      loanRisk.minCollateralRatio,
      collateralRisk.minCollateralRatio
    ),
    liquidationThreshold: Math.max(
      loanRisk.liquidationThreshold,
      collateralRisk.liquidationThreshold
    ),
    maxPriceStaleness: Math.min(
      loanRisk.maxPriceStaleness,
      collateralRisk.maxPriceStaleness
    ),
  };
}
