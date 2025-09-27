/**
 * Pyth Price Service
 * Service for fetching real-time price data from Pyth Network
 */

import { ethers } from "ethers";
import { PYTH_CONFIG, ZEROG_MAINNET_CONFIG } from "@/config/0g-chain";
import { getPythPriceFeedBySymbol } from "@/config/tokens";

export interface PythPrice {
  id: string;
  price: string;
  priceUSD: string;
  confidence: string;
  expo: number;
  publishTime: number;
  isStale: boolean;
  success: boolean;
  error?: string;
}

export interface PriceUpdateData {
  updateData: string[];
  updateFee: string;
  priceIds: string[];
}

class PythPriceService {
  private priceCache: Map<string, { price: PythPrice; timestamp: number }> =
    new Map();
  private readonly CACHE_DURATION = 30000; // 30 seconds cache
  private readonly HERMES_ENDPOINT = PYTH_CONFIG.hermesEndpoints[0];

  constructor() {
    // No additional setup needed for REST API approach
  }

  /**
   * Get current price for a single token
   */
  async getPrice(tokenSymbol: string): Promise<PythPrice> {
    const priceFeedId = getPythPriceFeedBySymbol(tokenSymbol);
    if (!priceFeedId) {
      return {
        id: "",
        price: "0",
        priceUSD: "0.00",
        confidence: "0",
        expo: 0,
        publishTime: 0,
        isStale: true,
        success: false,
        error: `Price feed not found for ${tokenSymbol}`,
      };
    }

    // Check cache first
    const cached = this.priceCache.get(priceFeedId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.price;
    }

    try {
      // Fetch price data from Hermes REST API
      const response = await fetch(
        `${this.HERMES_ENDPOINT}/v2/updates/price/latest?ids[]=${priceFeedId}`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.parsed || data.parsed.length === 0) {
        throw new Error(`No price data found for ${tokenSymbol}`);
      }

      const priceData = data.parsed[0];
      const price = this.formatHermesPrice(priceData, priceFeedId);

      // Cache the result
      this.priceCache.set(priceFeedId, {
        price,
        timestamp: Date.now(),
      });

      return price;
    } catch (error) {
      console.error(`Failed to fetch price for ${tokenSymbol}:`, error);
      return {
        id: priceFeedId,
        price: "0",
        priceUSD: "0.00",
        confidence: "0",
        expo: 0,
        publishTime: 0,
        isStale: true,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get current prices for multiple tokens
   */
  async getPrices(tokenSymbols: string[]): Promise<Map<string, PythPrice>> {
    const priceMap = new Map<string, PythPrice>();

    // Get all price feed IDs
    const priceFeeds: { symbol: string; feedId: string }[] = [];
    for (const symbol of tokenSymbols) {
      const feedId = getPythPriceFeedBySymbol(symbol);
      if (feedId) {
        priceFeeds.push({ symbol, feedId });
      }
    }

    if (priceFeeds.length === 0) {
      return priceMap;
    }

    try {
      const feedIds = priceFeeds.map((p) => p.feedId);
      const idsQuery = feedIds.map((id) => `ids[]=${id}`).join("&");

      // Fetch price data from Hermes REST API
      const response = await fetch(
        `${this.HERMES_ENDPOINT}/v2/updates/price/latest?${idsQuery}`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      priceFeeds.forEach(({ symbol, feedId }, index) => {
        const priceData = data.parsed?.find((p: any) => p.id === feedId);

        if (priceData) {
          const price = this.formatHermesPrice(priceData, feedId);
          priceMap.set(symbol, price);

          // Cache the result
          this.priceCache.set(feedId, {
            price,
            timestamp: Date.now(),
          });
        } else {
          priceMap.set(symbol, {
            id: feedId,
            price: "0",
            priceUSD: "0.00",
            confidence: "0",
            expo: 0,
            publishTime: 0,
            isStale: true,
            success: false,
            error: `No price data found for ${symbol}`,
          });
        }
      });

      return priceMap;
    } catch (error) {
      console.error("Failed to fetch multiple prices:", error);

      // Return error prices for all requested symbols
      tokenSymbols.forEach((symbol) => {
        const feedId = getPythPriceFeedBySymbol(symbol) || "";
        priceMap.set(symbol, {
          id: feedId,
          price: "0",
          priceUSD: "0.00",
          confidence: "0",
          expo: 0,
          publishTime: 0,
          isStale: true,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      });

      return priceMap;
    }
  }

  /**
   * Get price update data for contract transactions
   */
  async getPriceUpdateData(tokenSymbols: string[]): Promise<PriceUpdateData> {
    const priceIds: string[] = [];

    for (const symbol of tokenSymbols) {
      const feedId = getPythPriceFeedBySymbol(symbol);
      if (feedId) {
        priceIds.push(feedId);
      }
    }

    if (priceIds.length === 0) {
      return {
        updateData: [],
        updateFee: "0",
        priceIds: [],
      };
    }

    try {
      // Get price update data from Hermes REST API
      const idsQuery = priceIds.map((id) => `ids[]=${id}`).join("&");
      const response = await fetch(
        `${this.HERMES_ENDPOINT}/v2/updates/price/latest?${idsQuery}&encoding=hex`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        updateData: data.binary?.data || [],
        updateFee: "0", // Fee will be calculated on-chain
        priceIds,
      };
    } catch (error) {
      console.error("Failed to get price update data:", error);
      return {
        updateData: [],
        updateFee: "0",
        priceIds,
      };
    }
  }

  /**
   * Get price update data for specific tokens (for manual price updates)
   * This can be used when you want to manually update prices before a transaction
   */
  async getPriceUpdateDataForTokens(
    tokenSymbols: string[]
  ): Promise<PriceUpdateData> {
    return this.getPriceUpdateData(tokenSymbols);
  }

  /**
   * Format Hermes API price data for consistent use
   */
  private formatHermesPrice(priceData: any, feedId: string): PythPrice {
    try {
      const price = priceData.price;
      const expo = price.expo;
      const priceValue = Number(price.price);
      const confidence = Number(price.conf);
      const publishTime = Number(price.publish_time);

      // Convert to USD with proper decimal handling
      let priceUSD: number;
      if (expo >= 0) {
        priceUSD = priceValue * Math.pow(10, expo);
      } else {
        priceUSD = priceValue / Math.pow(10, Math.abs(expo));
      }

      // Check if price is stale (older than 60 seconds)
      const currentTime = Math.floor(Date.now() / 1000);
      const isStale = currentTime - publishTime > 60;

      return {
        id: feedId,
        price: priceValue.toString(),
        priceUSD: priceUSD.toFixed(2),
        confidence: confidence.toString(),
        expo: expo,
        publishTime: publishTime,
        isStale,
        success: true,
      };
    } catch (error) {
      return {
        id: feedId,
        price: "0",
        priceUSD: "0.00",
        confidence: "0",
        expo: 0,
        publishTime: 0,
        isStale: true,
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to format price",
      };
    }
  }

  /**
   * Clear price cache
   */
  clearCache(): void {
    this.priceCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.priceCache.size,
      entries: Array.from(this.priceCache.keys()),
    };
  }

  /**
   * Check if price feed is supported
   */
  isPriceFeedSupported(tokenSymbol: string): boolean {
    return getPythPriceFeedBySymbol(tokenSymbol) !== undefined;
  }

  /**
   * Get all supported price feeds
   */
  getSupportedPriceFeeds(): { symbol: string; feedId: string }[] {
    return Object.entries(PYTH_CONFIG.priceFeeds).map(([symbol, feedId]) => ({
      symbol,
      feedId,
    }));
  }
}

// Export singleton instance
export const pythPriceService = new PythPriceService();

// Export utility functions
export function formatPriceWithConfidence(price: PythPrice): string {
  if (!price.success) {
    return "Error";
  }

  const priceNum = parseFloat(price.priceUSD);
  const confidenceNum = parseFloat(price.confidence);

  if (price.expo >= 0) {
    return `$${priceNum.toFixed(2)} ±${confidenceNum.toFixed(2)}`;
  } else {
    const precision = Math.min(Math.abs(price.expo), 8);
    return `$${priceNum.toFixed(precision)} ±${confidenceNum.toFixed(precision)}`;
  }
}

export function isPriceStale(
  price: PythPrice,
  maxAgeSeconds: number = 60
): boolean {
  if (!price.success || price.publishTime === 0) {
    return true;
  }

  const currentTime = Math.floor(Date.now() / 1000);
  return currentTime - price.publishTime > maxAgeSeconds;
}

export function getPriceAge(price: PythPrice): number {
  if (!price.success || price.publishTime === 0) {
    return Infinity;
  }

  const currentTime = Math.floor(Date.now() / 1000);
  return currentTime - price.publishTime;
}

/**
 * Helper function to get price update data for neurolend transactions
 * Use this to manually add price updates to your contract calls
 */
export async function getPriceUpdateForTokens(
  tokenSymbols: string[]
): Promise<PriceUpdateData> {
  return await pythPriceService.getPriceUpdateDataForTokens(tokenSymbols);
}
