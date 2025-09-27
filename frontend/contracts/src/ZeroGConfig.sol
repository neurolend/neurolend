// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

/**
 * @title ZeroGConfig
 * @dev Configuration contract for 0G Chain with Pyth Network price feeds
 * @notice Contains supported token addresses and their Pyth price feed IDs for 0G mainnet
 */
library ZeroGConfig {
    // ============ 0G Chain Configuration ============

    // Pyth Network contract address on 0G Chain mainnet
    address public constant PYTH_CONTRACT =
        0x2880aB155794e7179c9eE2e38200202908C17B43;

    // ============ PRICE FEED IDs ============
    // Pyth Network price feed IDs (bytes32)

    // 0G Chain native token
    bytes32 public constant ZG_USD_PRICE_FEED =
        0xfa9e8d4591613476ad0961732475dc08969d248faca270cc6c47efe009ea3070;

    // Ethereum
    bytes32 public constant WETH_USD_PRICE_FEED =
        0x9d4294bbcd1174d6f2003ec365831e64cc31d9f6f15a2b85399db8d5000960f6;

    // Wrapped staked ETH
    bytes32 public constant WSTETH_USD_PRICE_FEED =
        0x6df640f3b8963d8f8358f791f352b8364513f6ab1cca5ed3f1f7b5448980e784;

    // USD Coin
    bytes32 public constant USDC_USD_PRICE_FEED =
        0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a;

    // ============ TOKEN ADDRESSES ============
    // Actual token addresses on 0G Chain mainnet

    // 0G Chain native token
    address public constant ZG_TOKEN =
        0x1Cd0690fF9a693f5EF2dD976660a8dAFc81A109c;

    // Wrapped Ethereum on 0G Chain
    address public constant WETH_TOKEN =
        0x9CC1d782E6dfe5936204c3295cb430e641DcF300;

    // Wrapped staked ETH on 0G Chain
    address public constant WSTETH_TOKEN =
        0x161a128567BF0C005b58211757F7e46eed983F02;

    // USD Coin on 0G Chain
    address public constant USDC_TOKEN =
        0x1f3AA82227281cA364bFb3d253B0f1af1Da6473E;

    // ============ ORACLE PARAMETERS ============

    // Default oracle parameters for 0G Chain
    uint256 public constant DEFAULT_MIN_COLLATERAL_RATIO = 15000; // 150%
    uint256 public constant DEFAULT_LIQUIDATION_THRESHOLD = 12000; // 120%
    uint256 public constant DEFAULT_MAX_PRICE_STALENESS = 300; // 5 minutes (Pyth updates frequently)
    uint256 public constant AGGRESSIVE_MAX_PRICE_STALENESS = 180; // 3 minutes for volatile assets

    // Asset volatility tiers for different staleness requirements
    enum VolatilityTier {
        STABLE, // USDT, USDC
        MODERATE, // ARB, ZG
        HIGH // BTC, ETH, SOL
    }

    /**
     * @notice Get recommended collateral ratio for asset pair
     * @param loanAsset The asset being borrowed
     * @param collateralAsset The asset being used as collateral
     * @return minRatio Minimum collateral ratio in basis points
     * @return liquidationThreshold Liquidation threshold in basis points
     */
    function getRecommendedRatios(
        address loanAsset,
        address collateralAsset
    ) internal pure returns (uint256 minRatio, uint256 liquidationThreshold) {
        VolatilityTier loanTier = getAssetVolatilityTier(loanAsset);
        VolatilityTier collateralTier = getAssetVolatilityTier(collateralAsset);

        // Base ratios
        minRatio = DEFAULT_MIN_COLLATERAL_RATIO;
        liquidationThreshold = DEFAULT_LIQUIDATION_THRESHOLD;

        // Adjust for volatility - higher volatility = higher ratios
        if (collateralTier == VolatilityTier.HIGH) {
            minRatio += 3000; // +30%
            liquidationThreshold += 2000; // +20%
        } else if (collateralTier == VolatilityTier.MODERATE) {
            minRatio += 1500; // +15%
            liquidationThreshold += 1000; // +10%
        }

        if (loanTier == VolatilityTier.HIGH) {
            minRatio += 1500; // +15%
            liquidationThreshold += 1000; // +10%
        }
    }

    /**
     * @notice Get asset volatility tier
     */
    function getAssetVolatilityTier(
        address asset
    ) internal pure returns (VolatilityTier) {
        if (asset == USDC_TOKEN) {
            return VolatilityTier.STABLE;
        } else if (asset == ZG_TOKEN) {
            return VolatilityTier.MODERATE;
        } else if (asset == WETH_TOKEN || asset == WSTETH_TOKEN) {
            return VolatilityTier.HIGH;
        }

        // Default to high volatility for unknown assets
        return VolatilityTier.HIGH;
    }

    /**
     * @notice Get recommended staleness threshold for asset
     */
    function getRecommendedStaleness(
        address asset
    ) internal pure returns (uint256) {
        VolatilityTier tier = getAssetVolatilityTier(asset);

        if (tier == VolatilityTier.HIGH) {
            return AGGRESSIVE_MAX_PRICE_STALENESS; // 3 minutes for volatile assets
        }

        return DEFAULT_MAX_PRICE_STALENESS; // 5 minutes for stable/moderate assets
    }

    /**
     * @notice Get Pyth price feed ID for a token
     */
    function getPriceFeedId(address token) internal pure returns (bytes32) {
        if (token == ZG_TOKEN) return ZG_USD_PRICE_FEED;
        if (token == WETH_TOKEN) return WETH_USD_PRICE_FEED;
        if (token == WSTETH_TOKEN) return WSTETH_USD_PRICE_FEED;
        if (token == USDC_TOKEN) return USDC_USD_PRICE_FEED;

        return bytes32(0); // Unsupported token
    }

    /**
     * @notice Check if token is supported
     */
    function isTokenSupported(address token) internal pure returns (bool) {
        return getPriceFeedId(token) != bytes32(0);
    }

    /**
     * @notice Get all supported tokens
     */
    function getSupportedTokens()
        internal
        pure
        returns (address[] memory tokens, bytes32[] memory priceFeeds)
    {
        tokens = new address[](4);
        priceFeeds = new bytes32[](4);

        tokens[0] = ZG_TOKEN;
        tokens[1] = WETH_TOKEN;
        tokens[2] = WSTETH_TOKEN;
        tokens[3] = USDC_TOKEN;

        priceFeeds[0] = ZG_USD_PRICE_FEED;
        priceFeeds[1] = WETH_USD_PRICE_FEED;
        priceFeeds[2] = WSTETH_USD_PRICE_FEED;
        priceFeeds[3] = USDC_USD_PRICE_FEED;
    }

    /**
     * @notice Get token information for display purposes
     */
    function getTokenInfo(
        address token
    )
        internal
        pure
        returns (string memory name, string memory symbol, uint8 decimals)
    {
        if (token == ZG_TOKEN) return ("0G Token", "0G", 18);
        if (token == WETH_TOKEN) return ("Wrapped Ethereum", "WETH", 18);
        if (token == WSTETH_TOKEN) return ("Wrapped Staked ETH", "wstETH", 18);
        if (token == USDC_TOKEN) return ("USD Coin", "USDC", 6);

        return ("Unknown Token", "UNK", 18);
    }
}
