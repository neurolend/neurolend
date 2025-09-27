import { useState, useEffect, useCallback, useMemo } from "react";
import { ethers } from "ethers";
import { TokenInfo, getTokenByAddress } from "@/config/tokens";
import { usePythPrices } from "@/hooks/usePythPrices";
import { neurolend_ABI, neurolend_CONTRACT_ADDRESS } from "@/lib/contracts";
import {
  toBaseUnit,
  fromBaseUnit,
  formatUSDValue,
  BigIntMath,
  getTokenDisplayPrecision,
} from "@/lib/decimals";

export interface TokenPrice {
  address: string;
  symbol: string;
  priceUSD: string; // Human-readable price in USD (e.g., "2000.50")
  priceRaw: bigint; // Raw price from oracle in base units (normalized to 18 decimals)
  oracleDecimals: number; // Oracle decimals (from price feed)
  tokenDecimals: number; // Token decimals (from ERC20)
  updatedAt: number; // Timestamp
  isStale: boolean;
}

export interface CollateralCalculation {
  // Base unit values (for internal calculations)
  minCollateralAmountRaw: bigint; // Minimum collateral in base units
  currentRatioRaw: bigint; // Current ratio in basis points (10000 = 100%)
  minRatioRaw: bigint; // Required minimum ratio in basis points
  liquidationThresholdRaw: bigint; // Liquidation threshold in basis points

  // Human-readable values (for display)
  minCollateralAmount: string; // Minimum collateral needed (formatted)
  currentRatio: string; // Current collateral ratio percentage
  minRatio: string; // Required minimum ratio percentage
  liquidationThreshold: string; // Liquidation threshold percentage
  isHealthy: boolean; // Whether current collateral is sufficient

  // Price information
  priceImpact: {
    loanTokenPriceUSD: string; // Human-readable USD price
    collateralTokenPriceUSD: string; // Human-readable USD price
    exchangeRate: string; // How much collateral per 1 loan token
    minCollateralValueUSD: string; // Minimum collateral value in USD
  };
}

// Note: useTokenPrices is deprecated - use usePythPrices instead
// This function is kept for compatibility but will be removed in future versions

export function useCollateralCalculation(
  loanToken?: TokenInfo,
  collateralToken?: TokenInfo,
  loanAmount?: string,
  collateralAmount?: string
) {
  // Use Pyth prices instead of Chainlink
  const tokenSymbols = useMemo(() => {
    const symbols = [];
    if (loanToken) symbols.push(loanToken.symbol);
    if (collateralToken) symbols.push(collateralToken.symbol);
    return symbols;
  }, [loanToken?.symbol, collateralToken?.symbol]);

  const {
    prices: pythPrices,
    isLoading: pricesLoading,
    refreshPrices,
  } = usePythPrices(tokenSymbols, {
    refreshInterval: 30000,
    enableAutoRefresh: true,
  });

  const [calculation, setCalculation] = useState<CollateralCalculation | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [recommendedParams, setRecommendedParams] = useState<
    [bigint, bigint, bigint] | null
  >(null);

  // Create stable key for token pair
  const tokenPairKey = useMemo(() => {
    if (!loanToken || !collateralToken) return "";
    return `${loanToken.address}-${collateralToken.address}`;
  }, [loanToken?.address, collateralToken?.address]);

  // Fetch recommended parameters from neurolend contract
  useEffect(() => {
    const fetchRecommendedParams = async () => {
      if (!loanToken || !collateralToken) {
        setRecommendedParams(null);
        return;
      }

      try {
        // console.log('Fetching recommended parameters for:', loanToken.symbol, '->', collateralToken.symbol);
        const provider = new ethers.JsonRpcProvider("https://evmrpc.0g.ai");
        const neurolend = new ethers.Contract(
          neurolend_CONTRACT_ADDRESS,
          neurolend_ABI,
          provider
        );

        const params = await neurolend.getRecommendedParameters(
          loanToken.address,
          collateralToken.address
        );

        setRecommendedParams(params);
      } catch (error) {
        console.error("Failed to fetch recommended parameters:", error);
        setRecommendedParams(null);
      }
    };

    if (tokenPairKey) {
      const timeoutId = setTimeout(() => {
        fetchRecommendedParams();
      }, 100); // 100ms debounce

      return () => clearTimeout(timeoutId);
    }
  }, [tokenPairKey]);

  useEffect(() => {
    if (!loanToken || !collateralToken || !loanAmount || pricesLoading) {
      setCalculation(null);
      return;
    }

    const loanPrice = pythPrices.get(loanToken.symbol);
    const collateralPrice = pythPrices.get(collateralToken.symbol);

    if (
      !loanPrice ||
      !collateralPrice ||
      !loanPrice.success ||
      !collateralPrice.success ||
      !recommendedParams
    ) {
      return;
    }

    setIsLoading(true);

    try {
      const [minRatioRaw, liquidationThresholdRaw] = recommendedParams;

      // Convert user input to base units
      const loanAmountRaw = toBaseUnit(loanAmount, loanToken.decimals);

      // Convert Pyth price to BigInt (Pyth prices are in USD with varying exponents)
      const loanPriceRaw = toBaseUnit(loanPrice.priceUSD, 18); // Convert USD price to 18 decimals
      const collateralPriceRaw = toBaseUnit(collateralPrice.priceUSD, 18);

      // Calculate loan value in USD using BigInt math
      const loanValueUSD = BigIntMath.multiply(
        loanAmountRaw,
        loanPriceRaw,
        loanToken.decimals,
        18, // Price is in 18 decimals
        18 // Result in 18 decimals for USD value
      );

      // Calculate minimum collateral value needed (in USD, 18 decimals)
      const minCollateralValueUSD = BigIntMath.percentage(
        loanValueUSD,
        minRatioRaw,
        18
      );

      // Calculate minimum collateral amount needed in base units
      const minCollateralAmountRaw = BigIntMath.divide(
        minCollateralValueUSD,
        collateralPriceRaw,
        18, // USD value decimals
        18, // Price decimals
        collateralToken.decimals // Result in collateral token decimals
      );

      // Format minimum collateral amount for display
      const minCollateralAmount = fromBaseUnit(
        minCollateralAmountRaw,
        collateralToken.decimals,
        getTokenDisplayPrecision(collateralToken.symbol)
      );

      // Calculate current ratio if collateral amount is provided
      let currentRatioRaw = 0n;
      let currentRatio = "0";
      let isHealthy = false;

      if (collateralAmount && parseFloat(collateralAmount) > 0) {
        const collateralAmountRaw = toBaseUnit(
          collateralAmount,
          collateralToken.decimals
        );

        // Calculate collateral value in USD
        const collateralValueUSD = BigIntMath.multiply(
          collateralAmountRaw,
          collateralPriceRaw,
          collateralToken.decimals,
          18, // Price decimals
          18 // Result in 18 decimals
        );

        // Calculate ratio: (collateral value / loan value) in basis points
        currentRatioRaw = BigIntMath.ratio(
          collateralValueUSD,
          loanValueUSD,
          18, // Both values have 18 decimals
          18
        );

        currentRatio = fromBaseUnit(currentRatioRaw, 2, 2); // Convert from basis points to percentage
        isHealthy = currentRatioRaw >= minRatioRaw;
      }

      // Calculate exchange rate (how much collateral per 1 loan token)
      const exchangeRateRaw = BigIntMath.divide(
        loanPriceRaw,
        collateralPriceRaw,
        18, // Loan price decimals
        18, // Collateral price decimals
        collateralToken.decimals // Result in collateral token decimals
      );

      const exchangeRate = fromBaseUnit(
        exchangeRateRaw,
        collateralToken.decimals,
        getTokenDisplayPrecision(collateralToken.symbol)
      );

      // Format percentages for display
      const minRatio = fromBaseUnit(minRatioRaw, 2, 2); // Basis points to percentage
      const liquidationThreshold = fromBaseUnit(liquidationThresholdRaw, 2, 2);

      // Calculate minimum collateral value in USD for display
      const minCollateralValueUSDFormatted = formatUSDValue(
        minCollateralValueUSD,
        18,
        "1", // Already in USD
        2
      );

      setCalculation({
        // Base unit values (for internal calculations)
        minCollateralAmountRaw,
        currentRatioRaw,
        minRatioRaw,
        liquidationThresholdRaw,

        // Human-readable values (for display)
        minCollateralAmount,
        currentRatio,
        minRatio,
        liquidationThreshold,
        isHealthy,

        // Price information
        priceImpact: {
          loanTokenPriceUSD: loanPrice.priceUSD,
          collateralTokenPriceUSD: collateralPrice.priceUSD,
          exchangeRate,
          minCollateralValueUSD: minCollateralValueUSDFormatted,
        },
      });
    } catch (error) {
      console.error("Error calculating collateral:", error);
      setCalculation(null);
    } finally {
      setIsLoading(false);
    }
  }, [
    loanToken,
    collateralToken,
    loanAmount,
    collateralAmount,
    pythPrices,
    recommendedParams,
    pricesLoading,
  ]);

  return {
    calculation,
    isLoading: isLoading || pricesLoading,
    prices: pythPrices,
    refreshPrices,
  };
}
