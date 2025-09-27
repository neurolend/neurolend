/**
 * Pyth Prices Hook
 * React hook for fetching and managing Pyth Network price data
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  pythPriceService,
  PythPrice,
  PriceUpdateData,
} from "@/lib/pyth-price-service";

export interface UsePythPricesOptions {
  refreshInterval?: number;
  enableAutoRefresh?: boolean;
  maxStaleness?: number;
}

export interface UsePythPricesReturn {
  prices: Map<string, PythPrice>;
  isLoading: boolean;
  error: string | null;
  lastUpdated: number | null;
  refreshPrices: () => Promise<void>;
  getPriceUpdateData: (tokenSymbols: string[]) => Promise<PriceUpdateData>;
  isPriceStale: (tokenSymbol: string) => boolean;
  getPriceAge: (tokenSymbol: string) => number;
}

/**
 * Hook for fetching multiple token prices from Pyth Network
 */
export function usePythPrices(
  tokenSymbols: string[],
  options: UsePythPricesOptions = {}
): UsePythPricesReturn {
  const {
    refreshInterval = 30000, // 30 seconds default
    enableAutoRefresh = true,
    maxStaleness = 60, // 60 seconds default
  } = options;

  const [prices, setPrices] = useState<Map<string, PythPrice>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  const fetchPrices = useCallback(async () => {
    if (tokenSymbols.length === 0) {
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      const newPrices = await pythPriceService.getPrices(tokenSymbols);

      if (mountedRef.current) {
        setPrices(newPrices);
        setLastUpdated(Date.now());
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : "Failed to fetch prices");
        console.error("Failed to fetch Pyth prices:", err);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [tokenSymbols]);

  const refreshPrices = useCallback(async () => {
    setIsLoading(true);
    await fetchPrices();
  }, [fetchPrices]);

  const getPriceUpdateData = useCallback(
    async (symbols: string[]): Promise<PriceUpdateData> => {
      try {
        return await pythPriceService.getPriceUpdateData(symbols);
      } catch (err) {
        console.error("Failed to get price update data:", err);
        return {
          updateData: [],
          updateFee: "0",
          priceIds: [],
        };
      }
    },
    []
  );

  const isPriceStale = useCallback(
    (tokenSymbol: string): boolean => {
      const price = prices.get(tokenSymbol);
      if (!price || !price.success) {
        return true;
      }

      const currentTime = Math.floor(Date.now() / 1000);
      return currentTime - price.publishTime > maxStaleness;
    },
    [prices, maxStaleness]
  );

  const getPriceAge = useCallback(
    (tokenSymbol: string): number => {
      const price = prices.get(tokenSymbol);
      if (!price || !price.success || price.publishTime === 0) {
        return Infinity;
      }

      const currentTime = Math.floor(Date.now() / 1000);
      return currentTime - price.publishTime;
    },
    [prices]
  );

  // Initial fetch
  useEffect(() => {
    fetchPrices();
  }, [fetchPrices]);

  // Auto-refresh setup
  useEffect(() => {
    if (enableAutoRefresh && refreshInterval > 0) {
      intervalRef.current = setInterval(fetchPrices, refreshInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enableAutoRefresh, refreshInterval, fetchPrices]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    prices,
    isLoading,
    error,
    lastUpdated,
    refreshPrices,
    getPriceUpdateData,
    isPriceStale,
    getPriceAge,
  };
}

/**
 * Hook for fetching a single token price from Pyth Network
 */
export function usePythPrice(
  tokenSymbol: string,
  options: UsePythPricesOptions = {}
) {
  const {
    prices,
    isLoading,
    error,
    lastUpdated,
    refreshPrices,
    getPriceUpdateData,
    isPriceStale,
    getPriceAge,
  } = usePythPrices([tokenSymbol], options);

  const price = prices.get(tokenSymbol) || {
    id: "",
    price: "0",
    priceUSD: "0.00",
    confidence: "0",
    expo: 0,
    publishTime: 0,
    isStale: true,
    success: false,
    error: "Price not found",
  };

  return {
    price,
    isLoading,
    error,
    lastUpdated,
    refreshPrice: refreshPrices,
    getPriceUpdateData: () => getPriceUpdateData([tokenSymbol]),
    isPriceStale: () => isPriceStale(tokenSymbol),
    getPriceAge: () => getPriceAge(tokenSymbol),
  };
}

/**
 * Hook for getting price update data for contract transactions
 */
export function usePriceUpdateData() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getPriceUpdateData = useCallback(
    async (tokenSymbols: string[]): Promise<PriceUpdateData> => {
      setIsLoading(true);
      setError(null);

      try {
        const updateData =
          await pythPriceService.getPriceUpdateData(tokenSymbols);
        return updateData;
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Failed to get price update data";
        setError(errorMessage);
        throw new Error(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return {
    getPriceUpdateData,
    isLoading,
    error,
  };
}

/**
 * Hook for monitoring price staleness across multiple tokens
 */
export function usePriceStalenessMonitor(
  tokenSymbols: string[],
  maxStaleness: number = 60
) {
  const { prices, isLoading } = usePythPrices(tokenSymbols, {
    refreshInterval: 10000, // Check every 10 seconds
    enableAutoRefresh: true,
  });

  const staleTokens = tokenSymbols.filter((symbol) => {
    const price = prices.get(symbol);
    if (!price || !price.success) return true;

    const currentTime = Math.floor(Date.now() / 1000);
    return currentTime - price.publishTime > maxStaleness;
  });

  const allPricesStale = staleTokens.length === tokenSymbols.length;
  const somePricesStale = staleTokens.length > 0;

  return {
    staleTokens,
    allPricesStale,
    somePricesStale,
    isLoading,
    totalTokens: tokenSymbols.length,
    freshTokens: tokenSymbols.length - staleTokens.length,
  };
}
