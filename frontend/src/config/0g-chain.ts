/**
 * 0G Chain Configuration
 * Configuration for neurolend on 0G Chain with Pyth Network integration
 */

// 0G Chain Network Configuration
export const ZEROG_MAINNET_CONFIG = {
  chainId: 16661, // 0G Chain mainnet chain ID (corrected)
  name: "0G Chain",
  currency: "0G",
  explorerUrl: "https://scan.0g.ai",
  rpcUrls: {
    default: {
      http: ["https://evmrpc.0g.ai"],
    },
    public: {
      http: ["https://evmrpc.0g.ai"],
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

  // Price feed IDs for supported tokens on 0G Chain
  priceFeeds: {
    // 0G Chain native token
    "0G": "0xfa9e8d4591613476ad0961732475dc08969d248faca270cc6c47efe009ea3070",

    // Ethereum tokens
    WETH: "0x9d4294bbcd1174d6f2003ec365831e64cc31d9f6f15a2b85399db8d5000960f6", // ETH/USD
    wstETH:
      "0x6df640f3b8963d8f8358f791f352b8364513f6ab1cca5ed3f1f7b5448980e784", // wstETH/USD

    // Stablecoins
    USDC: "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a", // USDC/USD
  },
} as const;

// Token Configuration for 0G Chain (4 supported tokens)
export const ZEROG_TOKENS = {
  // 0G Chain native token
  ZG: {
    address: "0x1Cd0690fF9a693f5EF2dD976660a8dAFc81A109c",
    symbol: "0G",
    name: "0G Token",
    decimals: 18,
    logo: "/tokens/0g.svg",
    priceFeedId: PYTH_CONFIG.priceFeeds["0G"],
    volatilityTier: "MODERATE" as const,
  },

  // Wrapped Ethereum on 0G Chain
  WETH: {
    address: "0x9CC1d782E6dfe5936204c3295cb430e641DcF300",
    symbol: "WETH",
    name: "Wrapped Ethereum",
    decimals: 18,
    logo: "/tokens/eth.svg",
    priceFeedId: PYTH_CONFIG.priceFeeds.WETH,
    volatilityTier: "HIGH" as const,
  },

  // Wrapped Staked ETH on 0G Chain
  wstETH: {
    address: "0x161a128567BF0C005b58211757F7e46eed983F02",
    symbol: "wstETH",
    name: "Wrapped Staked ETH",
    decimals: 18,
    logo: "/tokens/wsteth.svg",
    priceFeedId: PYTH_CONFIG.priceFeeds.wstETH,
    volatilityTier: "HIGH" as const,
  },

  // USD Coin on 0G Chain
  USDC: {
    address: "0x1f3AA82227281cA364bFb3d253B0f1af1Da6473E",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    logo: "/tokens/usdc.svg",
    priceFeedId: PYTH_CONFIG.priceFeeds.USDC,
    volatilityTier: "STABLE" as const,
  },
} as const;

// Contract addresses on 0G Chain
export const ZEROG_CONTRACTS = {
  // Core neurolend contract (updated with correct token addresses)
  neurolend:
    process.env.NEXT_PUBLIC_neurolend_ADDRESS ||
    "0x064c3e0a900743D9Ac87c778d2f6d3d5819D4f23",

  // Pyth Network contract
  PYTH: PYTH_CONFIG.contractAddress,
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
