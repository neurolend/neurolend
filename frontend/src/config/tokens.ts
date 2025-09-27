// 0G Chain Mainnet - Supported Tokens Configuration
export interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logo?: string;
  description: string;
  category: "stablecoin" | "crypto" | "defi";
  volatilityTier: "stable" | "moderate" | "high";
  pythPriceFeedId: string; // Pyth Network price feed ID
  isAvailable: boolean; // Whether the contract actually exists on 0G Chain
  status: "active" | "placeholder" | "pending"; // Contract deployment status
}

// 0G Chain Configuration
export const ZEROG_MAINNET_CONFIG = {
  pythContract: "0x2880aB155794e7179c9eE2e38200202908C17B43",
  chainId: 16661,
  rpcUrl: "https://evmrpc.0g.ai",
  neurolendContract: "0x064c3e0a900743D9Ac87c778d2f6d3d5819D4f23", // Updated with correct token addresses
} as const;

// Supported Tokens on 0G Chain Mainnet with Pyth Network Price Feeds
export const SUPPORTED_TOKENS: Record<string, TokenInfo> = {
  ZG: {
    address: "0x1Cd0690fF9a693f5EF2dD976660a8dAFc81A109c",
    name: "0G Token",
    symbol: "0G",
    decimals: 18,
    description: "Native token of the 0G Chain ecosystem",
    category: "crypto",
    volatilityTier: "moderate",
    pythPriceFeedId:
      "0xfa9e8d4591613476ad0961732475dc08969d248faca270cc6c47efe009ea3070", // 0G/USD
    isAvailable: true, // ✅ Contract verified to exist
    status: "active",
  },
  WETH: {
    address: "0x9CC1d782E6dfe5936204c3295cb430e641DcF300",
    name: "Wrapped Ethereum",
    symbol: "WETH",
    decimals: 18,
    description: "Wrapped Ethereum on 0G Chain",
    category: "crypto",
    volatilityTier: "high",
    pythPriceFeedId:
      "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace", // ETH/USD
    isAvailable: true, // ✅ Verified address provided
    status: "active",
  },
  wstETH: {
    address: "0x161a128567BF0C005b58211757F7e46eed983F02",
    name: "Wrapped Staked ETH",
    symbol: "wstETH",
    decimals: 18,
    description: "Wrapped staked Ethereum (Lido) on 0G Chain",
    category: "defi",
    volatilityTier: "high",
    pythPriceFeedId:
      "0x6df640f3b8963d8f8358f791f352b8364513f6ab1cca5ed3f1f7b5448980e784", // wstETH/USD
    isAvailable: true, // ✅ Verified address provided
    status: "active",
  },
  USDC: {
    address: "0x1f3AA82227281cA364bFb3d253B0f1af1Da6473E",
    name: "USD Coin",
    symbol: "USDC",
    decimals: 6,
    description: "USD Coin stablecoin on 0G Chain",
    category: "stablecoin",
    volatilityTier: "stable",
    pythPriceFeedId:
      "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a", // USDC/USD
    isAvailable: true, // ✅ Verified address provided
    status: "active",
  },
} as const;

// Get token by address
export function getTokenByAddress(address: string): TokenInfo | undefined {
  return Object.values(SUPPORTED_TOKENS).find(
    (token) => token.address.toLowerCase() === address.toLowerCase()
  );
}

// Get token by symbol
export function getTokenBySymbol(symbol: string): TokenInfo | undefined {
  return SUPPORTED_TOKENS[symbol.toUpperCase()];
}

// Get all supported tokens as array
export function getAllSupportedTokens(): TokenInfo[] {
  return Object.values(SUPPORTED_TOKENS);
}

// Default collateralization parameters based on asset volatility (matches ZeroGConfig.sol)
export const DEFAULT_PARAMETERS = {
  stable: {
    minCollateralRatio: 15000, // 150%
    liquidationThreshold: 12000, // 120%
    maxPriceStaleness: 300, // 5 minutes (Pyth updates frequently)
  },
  moderate: {
    minCollateralRatio: 16500, // 165%
    liquidationThreshold: 13000, // 130%
    maxPriceStaleness: 300, // 5 minutes
  },
  high: {
    minCollateralRatio: 18000, // 180%
    liquidationThreshold: 14000, // 140%
    maxPriceStaleness: 180, // 3 minutes for volatile assets
  },
} as const;

// Get recommended parameters for asset pair
export function getRecommendedParameters(
  loanAsset: TokenInfo,
  collateralAsset: TokenInfo
) {
  const loanParams = DEFAULT_PARAMETERS[loanAsset.volatilityTier];
  const collateralParams = DEFAULT_PARAMETERS[collateralAsset.volatilityTier];

  // Use more conservative parameters
  return {
    minCollateralRatio: Math.max(
      loanParams.minCollateralRatio,
      collateralParams.minCollateralRatio
    ),
    liquidationThreshold: Math.max(
      loanParams.liquidationThreshold,
      collateralParams.liquidationThreshold
    ),
    maxPriceStaleness: Math.min(
      loanParams.maxPriceStaleness,
      collateralParams.maxPriceStaleness
    ),
  };
}

// Token selection categories for UI
export const TOKEN_CATEGORIES = {
  stablecoin: {
    name: "Stablecoins",
    description: "Low volatility, USD-pegged assets",
    tokens: Object.values(SUPPORTED_TOKENS).filter(
      (t) => t.category === "stablecoin"
    ),
  },
  crypto: {
    name: "Cryptocurrencies",
    description: "Major blockchain native tokens",
    tokens: Object.values(SUPPORTED_TOKENS).filter(
      (t) => t.category === "crypto"
    ),
  },
  defi: {
    name: "DeFi Tokens",
    description: "Decentralized finance protocol tokens",
    tokens: Object.values(SUPPORTED_TOKENS).filter(
      (t) => t.category === "defi"
    ),
  },
} as const;

// Risk level colors for UI
export const RISK_COLORS = {
  stable: "text-green-600 bg-green-50 border-green-200",
  moderate: "text-yellow-600 bg-yellow-50 border-yellow-200",
  high: "text-red-600 bg-red-50 border-red-200",
} as const;

// Format basis points to percentage
export function formatBasisPoints(bps: number): string {
  return `${(bps / 100).toFixed(1)}%`;
}

// Convert percentage to basis points (for contract calls)
export function percentageToBasisPoints(percentage: number): number {
  return Math.round(percentage * 100);
}

// Convert basis points to percentage (for display)
export function basisPointsToPercentage(bps: number): number {
  return bps / 100;
}

// Get Pyth price feed ID for a token
export function getPythPriceFeedId(tokenAddress: string): string | undefined {
  const token = getTokenByAddress(tokenAddress);
  return token?.pythPriceFeedId;
}

// Get Pyth price feed ID by symbol
export function getPythPriceFeedBySymbol(symbol: string): string | undefined {
  const token = getTokenBySymbol(symbol);
  return token?.pythPriceFeedId;
}

// Format duration in seconds to human readable
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days} day${days !== 1 ? "s" : ""}`;
  }
  if (hours > 0) {
    return `${hours} hour${hours !== 1 ? "s" : ""}`;
  }
  return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
}
