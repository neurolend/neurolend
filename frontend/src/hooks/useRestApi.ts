import React, { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { ZEROG_MAINNET_CONFIG } from "@/config/0g-chain";

// Base API URL
const BASE_API_URL = "http://localhost:3001/api";
const BASE_URL = "http://localhost:3001";

// Token info cache to avoid repeated blockchain calls
const tokenInfoCache = new Map<
  string,
  {
    name: string;
    symbol: string;
    decimals: number;
    timestamp: number;
  }
>();

// Cache duration: 1 hour
const CACHE_DURATION = 60 * 60 * 1000;

// Helper function to normalize addresses (remove leading zeros)
function normalizeAddress(address: string): string {
  if (!address) return "";
  // Remove leading zeros but keep the 0x prefix
  return ("0x" + address.slice(2).replace(/^0+/, "")).toLowerCase();
}

// Interface for decoded loan data
interface DecodedLoanData {
  amount: string;
  interestRate: string;
  duration: string;
  collateralAddress: string;
  collateralAmount: string;
  minCollateralRatioBPS: string;
  liquidationThresholdBPS: string;
  maxPriceStaleness: string;
}

// Types for the new REST API endpoints
export interface LoanCreatedEvent {
  id: string;
  transactionHash: string;
  blockNumber: number;
  blockTimestamp: number;
  loanId: string;
  lender: string;
  tokenAddress: string;
  data: string; // Encoded event data
  // Decoded fields (may not be present in raw API response)
  borrower?: string;
  amount?: string;
  interestRate?: string;
  duration?: string;
  collateralAddress?: string;
  collateralAmount?: string;
  minCollateralRatioBPS?: string;
  liquidationThresholdBPS?: string;
  maxPriceStaleness?: string;
}

export interface LoanRepaidEvent {
  id: string;
  transactionHash: string;
  blockNumber: string;
  timestamp: string;
  loanId: string;
  borrower: string;
  repaidAmount: string;
}

export interface LoanLiquidatedEvent {
  id: string;
  transactionHash: string;
  blockNumber: string;
  timestamp: string;
  loanId: string;
  liquidator: string;
  collateralSeized: string;
}

export interface PriceFeedSetEvent {
  id: string;
  transactionHash: string;
  blockNumber: string;
  timestamp: string;
  token: string;
  priceFeed: string;
}

// Legacy interface for backward compatibility
export interface RestLoan {
  loan_id: string;
  lender: string | null;
  borrower: string;
  amount: string;
  status: string; // "Active", "Pending", "Repaid", etc.
  created_at: number;
  events_count: number;
  // Additional fields that might be present
  tokenAddress?: string;
  interestRate?: string;
  duration?: string;
  collateralAddress?: string;
  collateralAmount?: string;
  startTime?: string;
  minCollateralRatioBPS?: string;
  liquidationThresholdBPS?: string;
  maxPriceStaleness?: string;
  repaidAmount?: string;
  historicalPriceUSD?: string;
  historicalAmountUSD?: string;
}

export interface RestStats {
  totalLoansCreated: number;
  totalLoanVolumeUSD: string;
  totalActiveLoans: number;
  totalRepaidLoans: number;
  totalDefaultedLoans: number;
  averageInterestRate: string;
  averageDuration: string;
}

export interface RestEvent {
  id: string;
  eventType: string;
  transactionHash: string;
  blockNumber: string;
  timestamp: string;
  loanId?: string;
  data: any;
}

// Hook to fetch loan created events
export function useLoanCreatedEvents() {
  const [loanCreateds, setLoanCreateds] = useState<LoanCreatedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLoanCreateds = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${BASE_API_URL}/loanCreateds`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const loansArray = Array.isArray(data) ? data : data.loanCreateds || [];

      setLoanCreateds(loansArray);
    } catch (err) {
      console.error("Failed to fetch loan created events:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to fetch loan created events"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLoanCreateds();
  }, []); // No dependencies needed

  return {
    loanCreateds,
    loading,
    error,
    refetch: fetchLoanCreateds,
  };
}

// Hook to fetch loan repaid events
export function useLoanRepaidEvents() {
  const [loanRepaids, setLoanRepaids] = useState<LoanRepaidEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLoanRepaids = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${BASE_API_URL}/loanRepaids`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const repaidsArray = Array.isArray(data) ? data : data.loanRepaids || [];

      setLoanRepaids(repaidsArray);
    } catch (err) {
      console.error("Failed to fetch loan repaid events:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to fetch loan repaid events"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLoanRepaids();
  }, []); // No dependencies needed

  return {
    loanRepaids,
    loading,
    error,
    refetch: fetchLoanRepaids,
  };
}

// Hook to fetch loan liquidated events
export function useLoanLiquidatedEvents() {
  const [loanLiquidateds, setLoanLiquidateds] = useState<LoanLiquidatedEvent[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLoanLiquidateds = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${BASE_API_URL}/loanLiquidateds`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const liquidatedsArray = Array.isArray(data)
        ? data
        : data.loanLiquidateds || [];

      setLoanLiquidateds(liquidatedsArray);
    } catch (err) {
      console.error("Failed to fetch loan liquidated events:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to fetch loan liquidated events"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLoanLiquidateds();
  }, []); // No dependencies needed

  return {
    loanLiquidateds,
    loading,
    error,
    refetch: fetchLoanLiquidateds,
  };
}

// Hook to fetch all loans (legacy - keeping for backward compatibility)
export function useRestLoans() {
  const [loans, setLoans] = useState<RestLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLoans = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${BASE_API_URL}/loans`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Handle different response formats
      const loansArray = Array.isArray(data) ? data : data.loans || [];

      setLoans(loansArray);
    } catch (err) {
      console.error("Failed to fetch loans:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch loans");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLoans();
  }, []); // No dependencies needed

  return {
    loans,
    loading,
    error,
    refetch: fetchLoans,
  };
}

// Hook to fetch protocol stats
export function useRestStats() {
  const [stats, setStats] = useState<RestStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${BASE_API_URL}/stats`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error("Failed to fetch stats:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch stats");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, []); // No dependencies needed

  return {
    stats,
    loading,
    error,
    refetch: fetchStats,
  };
}

// Hook to fetch events (all or by type)
export function useRestEvents(eventType?: string) {
  const [events, setEvents] = useState<RestEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const endpoint = eventType ? `/events/${eventType}` : "/events";
      const response = await fetch(`${BASE_API_URL}${endpoint}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Handle different response formats
      const eventsArray = Array.isArray(data) ? data : data.events || [];

      setEvents(eventsArray);
    } catch (err) {
      console.error("Failed to fetch events:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch events");
    } finally {
      setLoading(false);
    }
  }, [eventType]);

  useEffect(() => {
    fetchEvents();
  }, [eventType]); // Only depend on eventType

  return {
    events,
    loading,
    error,
    refetch: fetchEvents,
  };
}

// Hook to check API health
export function useApiHealth() {
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkHealth = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${BASE_URL}/health`);
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }

      const data = await response.json();
      setIsHealthy(data.status === "ok" || data.healthy === true);
    } catch (err) {
      console.error("Health check failed:", err);
      setError(err instanceof Error ? err.message : "Health check failed");
      setIsHealthy(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
  }, []); // No dependencies needed

  return {
    isHealthy,
    loading,
    error,
    refetch: checkHealth,
  };
}

// Hook to enhance loans with dynamic token information
export function useLoansWithTokenInfo(loans: any[]) {
  const [enhancedLoans, setEnhancedLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastProcessedKey = React.useRef<string>("");

  useEffect(() => {
    const enhanceLoansWithTokenInfo = async () => {
      // Create a stable key based on loans to prevent unnecessary re-runs
      const currentKey =
        loans.length === 0
          ? "empty"
          : loans
              .map(
                (loan) =>
                  `${loan.id}-${loan.tokenAddress}-${loan.collateralAddress}`
              )
              .join("|");

      // Skip if we've already processed these exact loans
      if (currentKey === lastProcessedKey.current) {
        return;
      }

      lastProcessedKey.current = currentKey;

      if (loans.length === 0) {
        setEnhancedLoans([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Get unique token addresses (normalize them)
        const uniqueTokenAddresses = new Set<string>();
        loans.forEach((loan) => {
          if (loan.tokenAddress) {
            uniqueTokenAddresses.add(normalizeAddress(loan.tokenAddress));
          }
          if (loan.collateralAddress) {
            uniqueTokenAddresses.add(normalizeAddress(loan.collateralAddress));
          }
        });

        // Fetch token info for all unique addresses
        const tokenInfoPromises = Array.from(uniqueTokenAddresses).map(
          async (address) => {
            const info = await fetchTokenInfo(address);
            return { address: address.toLowerCase(), info };
          }
        );

        const tokenInfoResults = await Promise.all(tokenInfoPromises);

        // Create a map for quick lookup
        const tokenInfoMap = new Map();
        tokenInfoResults.forEach(({ address, info }) => {
          tokenInfoMap.set(address, info);
        });

        // Enhance loans with token information
        const enhanced = loans.map((loan) => {
          // Normalize addresses for lookup
          const normalizedTokenAddress = loan.tokenAddress
            ? normalizeAddress(loan.tokenAddress)
            : null;
          const normalizedCollateralAddress = loan.collateralAddress
            ? normalizeAddress(loan.collateralAddress)
            : null;

          const tokenInfo = normalizedTokenAddress
            ? tokenInfoMap.get(normalizedTokenAddress)
            : null;
          const collateralInfo = normalizedCollateralAddress
            ? tokenInfoMap.get(normalizedCollateralAddress)
            : null;

          return {
            ...loan,
            tokenInfo,
            collateralInfo,
          };
        });

        setEnhancedLoans(enhanced);
      } catch (err) {
        console.error("Failed to enhance loans with token info:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Failed to fetch token information"
        );
        // Set loans without enhancement as fallback
        setEnhancedLoans(loans);
      } finally {
        setLoading(false);
      }
    };

    enhanceLoansWithTokenInfo();
  }, [loans]); // Simple dependency on loans array

  const refresh = useCallback(async () => {
    // Reset the key to force re-processing
    lastProcessedKey.current = "";
    // The useEffect will handle the actual enhancement
  }, []);

  return {
    loans: enhancedLoans,
    loading,
    error,
    refresh,
  };
}

// Combined hook for offers page (loan created events + stats)
export function useRestOffersData() {
  const {
    loanCreateds,
    loading: loansLoading,
    error: loansError,
    refetch: refetchLoanCreateds,
  } = useLoanCreatedEvents();
  const {
    loanRepaids,
    loading: repaidsLoading,
    error: repaidsError,
    refetch: refetchLoanRepaids,
  } = useLoanRepaidEvents();
  const {
    loanLiquidateds,
    loading: liquidatedsLoading,
    error: liquidatedsError,
    refetch: refetchLoanLiquidateds,
  } = useLoanLiquidatedEvents();
  const {
    stats,
    loading: statsLoading,
    error: statsError,
    refetch: refetchStats,
  } = useRestStats();

  // Convert loan created events to loan format and determine status
  const loans = React.useMemo(() => {
    return loanCreateds.map((loanCreated) => {
      // Check if this loan has been repaid or liquidated
      const isRepaid = loanRepaids.some(
        (repaid) => repaid.loanId === loanCreated.loanId
      );
      const isLiquidated = loanLiquidateds.some(
        (liquidated) => liquidated.loanId === loanCreated.loanId
      );

      let status = "Pending"; // Default status for newly created loans
      let actualStartTime = 0; // Start time is 0 for pending loans

      if (isRepaid) {
        status = "Repaid";
        actualStartTime = loanCreated.blockTimestamp; // Use creation time as fallback
      } else if (isLiquidated) {
        status = "Defaulted";
        actualStartTime = loanCreated.blockTimestamp; // Use creation time as fallback
      } else if (
        loanCreated.borrower &&
        loanCreated.borrower !== "0x0000000000000000000000000000000000000000"
      ) {
        status = "Active";
        actualStartTime = loanCreated.blockTimestamp; // Use creation time as start time for now
      }

      return convertLoanCreatedToRestLoan(
        loanCreated,
        status,
        undefined,
        actualStartTime
      );
    });
  }, [loanCreateds, loanRepaids, loanLiquidateds]);

  // Filter for pending loans only (available offers)
  const pendingLoans = loans.filter((loan) => loan.status === "Pending");

  const refresh = useCallback(() => {
    refetchLoanCreateds();
    refetchLoanRepaids();
    refetchLoanLiquidateds();
    refetchStats();
  }, [
    refetchLoanCreateds,
    refetchLoanRepaids,
    refetchLoanLiquidateds,
    refetchStats,
  ]);

  return {
    loans: pendingLoans,
    stats,
    loading:
      loansLoading || repaidsLoading || liquidatedsLoading || statsLoading,
    error: loansError || repaidsError || liquidatedsError || statsError,
    refresh,
    // Additional computed data
    totalLoans: loans.length,
    pendingLoansCount: pendingLoans.length,
    lastUpdated: Date.now(),
  };
}

// Hook for my-loans page that uses REST API data
export function useRestMyLoansData() {
  const {
    loanCreateds,
    loading: loansLoading,
    error: loansError,
    refetch: refetchLoanCreateds,
  } = useLoanCreatedEvents();
  const {
    loanRepaids,
    loading: repaidsLoading,
    error: repaidsError,
    refetch: refetchLoanRepaids,
  } = useLoanRepaidEvents();
  const {
    loanLiquidateds,
    loading: liquidatedsLoading,
    error: liquidatedsError,
    refetch: refetchLoanLiquidateds,
  } = useLoanLiquidatedEvents();
  const {
    stats,
    loading: statsLoading,
    error: statsError,
    refetch: refetchStats,
  } = useRestStats();

  // Convert loan created events to loan format and determine status
  const loans = React.useMemo(() => {
    return loanCreateds.map((loanCreated) => {
      // Check if this loan has been repaid or liquidated
      const repaidEvent = loanRepaids.find(
        (repaid) => repaid.loanId === loanCreated.loanId
      );
      const liquidatedEvent = loanLiquidateds.find(
        (liquidated) => liquidated.loanId === loanCreated.loanId
      );

      let status = "Pending"; // Default status for newly created loans
      let actualStartTime = 0; // Start time is 0 for pending loans

      if (repaidEvent) {
        status = "Repaid";
        actualStartTime = loanCreated.blockTimestamp; // Use creation time as fallback
      } else if (liquidatedEvent) {
        status = "Defaulted";
        actualStartTime = loanCreated.blockTimestamp; // Use creation time as fallback
      } else if (
        loanCreated.borrower &&
        loanCreated.borrower !== "0x0000000000000000000000000000000000000000"
      ) {
        status = "Active";
        actualStartTime = loanCreated.blockTimestamp; // Use creation time as start time for now
      }

      const restLoan = convertLoanCreatedToRestLoan(
        loanCreated,
        status,
        repaidEvent,
        actualStartTime
      );
      return convertRestLoanToProcessedLoan(restLoan);
    });
  }, [loanCreateds, loanRepaids, loanLiquidateds]);

  const refresh = useCallback(() => {
    refetchLoanCreateds();
    refetchLoanRepaids();
    refetchLoanLiquidateds();
    refetchStats();
  }, [
    refetchLoanCreateds,
    refetchLoanRepaids,
    refetchLoanLiquidateds,
    refetchStats,
  ]);

  return {
    loans,
    stats,
    loading:
      loansLoading || repaidsLoading || liquidatedsLoading || statsLoading,
    error: loansError || repaidsError || liquidatedsError || statsError,
    refresh,
    // Additional computed data
    totalLoans: loans.length,
    lastUpdated: Date.now(),
  };
}

// Function to fetch token information from blockchain
export async function fetchTokenInfo(tokenAddress: string): Promise<{
  name: string;
  symbol: string;
  decimals: number;
} | null> {
  // Normalize address
  const normalizedAddress = normalizeAddress(tokenAddress);

  // Check cache first
  const cached = tokenInfoCache.get(normalizedAddress);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return {
      name: cached.name,
      symbol: cached.symbol,
      decimals: cached.decimals,
    };
  }

  try {
    const provider = new ethers.JsonRpcProvider(
      ZEROG_MAINNET_CONFIG.rpcUrls.default.http[0]
    );

    // Standard ERC20 token interface
    const tokenContract = new ethers.Contract(
      tokenAddress,
      [
        "function name() view returns (string)",
        "function symbol() view returns (string)",
        "function decimals() view returns (uint8)",
      ],
      provider
    );

    const [name, symbol, decimals] = await Promise.all([
      tokenContract.name().catch(() => "Unknown Token"),
      tokenContract.symbol().catch(() => "UNK"),
      tokenContract.decimals().catch(() => 18),
    ]);

    const tokenInfo = {
      name: name || "Unknown Token",
      symbol: symbol || "UNK",
      decimals: Number(decimals) || 18,
    };

    // Cache the result
    tokenInfoCache.set(normalizedAddress, {
      ...tokenInfo,
      timestamp: Date.now(),
    });

    return tokenInfo;
  } catch (error) {
    console.error(`Failed to fetch token info for ${tokenAddress}:`, error);

    // Return fallback info
    const fallback = {
      name: "Unknown Token",
      symbol: "UNK",
      decimals: 18,
    };

    // Cache the fallback to avoid repeated failed calls
    tokenInfoCache.set(normalizedAddress, {
      ...fallback,
      timestamp: Date.now(),
    });

    return fallback;
  }
}

// Function to decode LoanCreated event data
function decodeLoanCreatedData(data: string): DecodedLoanData {
  try {
    // LoanCreated event signature:
    // LoanCreated(uint256 indexed loanId, address indexed lender, address indexed borrower,
    //            address tokenAddress, uint256 amount, uint256 interestRate, uint256 duration,
    //            address collateralAddress, uint256 collateralAmount, uint256 minCollateralRatioBPS,
    //            uint256 liquidationThresholdBPS, uint256 maxPriceStaleness)

    const abiCoder = ethers.AbiCoder.defaultAbiCoder();
    const decoded = abiCoder.decode(
      [
        "uint256", // amount
        "uint256", // interestRate
        "uint256", // duration
        "address", // collateralAddress
        "uint256", // collateralAmount
        "uint256", // minCollateralRatioBPS
        "uint256", // liquidationThresholdBPS
        "uint256", // maxPriceStaleness
      ],
      data
    );

    return {
      amount: decoded[0].toString(),
      interestRate: decoded[1].toString(),
      duration: decoded[2].toString(),
      collateralAddress: decoded[3],
      collateralAmount: decoded[4].toString(),
      minCollateralRatioBPS: decoded[5].toString(),
      liquidationThresholdBPS: decoded[6].toString(),
      maxPriceStaleness: decoded[7].toString(),
    };
  } catch (error) {
    console.error("Failed to decode loan created data:", error);
    return {
      amount: "0",
      interestRate: "1000",
      duration: "2592000",
      collateralAddress: "0x4200000000000000000000000000000000000006",
      collateralAmount: "0",
      minCollateralRatioBPS: "15000",
      liquidationThresholdBPS: "12000",
      maxPriceStaleness: "3600",
    };
  }
}

// Utility function to convert LoanCreatedEvent to RestLoan format
export function convertLoanCreatedToRestLoan(
  loanCreated: LoanCreatedEvent,
  status: string,
  repaidEvent?: LoanRepaidEvent,
  actualStartTime?: number
): RestLoan {
  // Decode the event data if it's not already decoded
  const decodedData: DecodedLoanData = loanCreated.data
    ? decodeLoanCreatedData(loanCreated.data)
    : {
        amount: "0",
        interestRate: "1000",
        duration: "2592000",
        collateralAddress: "0x4200000000000000000000000000000000000006",
        collateralAmount: "0",
        minCollateralRatioBPS: "15000",
        liquidationThresholdBPS: "12000",
        maxPriceStaleness: "3600",
      };

  return {
    loan_id: loanCreated.loanId || "0",
    lender: loanCreated.lender || "0x0000000000000000000000000000000000000000",
    borrower:
      loanCreated.borrower || "0x0000000000000000000000000000000000000000", // Will be set when loan is accepted
    amount: loanCreated.amount || decodedData.amount || "0",
    status,
    created_at: loanCreated.blockTimestamp || 0,
    events_count: 1, // At least the creation event
    tokenAddress:
      loanCreated.tokenAddress || "0x4200000000000000000000000000000000000006",
    interestRate:
      loanCreated.interestRate || decodedData.interestRate || "1000",
    duration: loanCreated.duration || decodedData.duration || "2592000",
    collateralAddress:
      loanCreated.collateralAddress ||
      decodedData.collateralAddress ||
      "0x4200000000000000000000000000000000000006",
    collateralAmount:
      loanCreated.collateralAmount || decodedData.collateralAmount || "0",
    startTime: actualStartTime?.toString() || "0", // Use actualStartTime (0 for pending loans)
    minCollateralRatioBPS:
      loanCreated.minCollateralRatioBPS ||
      decodedData.minCollateralRatioBPS ||
      "15000",
    liquidationThresholdBPS:
      loanCreated.liquidationThresholdBPS ||
      decodedData.liquidationThresholdBPS ||
      "12000",
    maxPriceStaleness:
      loanCreated.maxPriceStaleness || decodedData.maxPriceStaleness || "3600",
    repaidAmount: repaidEvent?.repaidAmount || "0",
  };
}

// Utility function to convert RestLoan to ProcessedLoan format (for compatibility)
export function convertRestLoanToProcessedLoan(restLoan: RestLoan) {
  // Convert string status to numeric status for compatibility
  const getNumericStatus = (status: string): number => {
    switch (status?.toLowerCase()) {
      case "pending":
        return 0;
      case "active":
        return 1;
      case "repaid":
        return 2;
      case "defaulted":
        return 3;
      case "cancelled":
        return 4;
      default:
        return 0; // Default to pending
    }
  };

  // Use more realistic defaults for missing fields
  const converted = {
    id: BigInt(restLoan.loan_id),
    lender: restLoan.lender || "0x0000000000000000000000000000000000000000",
    borrower: restLoan.borrower || "0x0000000000000000000000000000000000000000",
    tokenAddress:
      restLoan.tokenAddress || "0x4200000000000000000000000000000000000006", // Default WETH address
    amount: BigInt(restLoan.amount || "0"),
    interestRate: BigInt(restLoan.interestRate || "1000"), // 10% default
    duration: BigInt(restLoan.duration || "2592000"), // 30 days default
    collateralAddress:
      restLoan.collateralAddress ||
      "0x4200000000000000000000000000000000000006", // Default WETH address
    collateralAmount: BigInt(
      restLoan.collateralAmount || restLoan.amount || "0"
    ), // Use loan amount as collateral if missing
    startTime: BigInt(restLoan.startTime || restLoan.created_at || 0),
    createdAt: BigInt(restLoan.created_at || 0),
    status: getNumericStatus(restLoan.status),
    minCollateralRatioBPS: BigInt(restLoan.minCollateralRatioBPS || "15000"),
    liquidationThresholdBPS: BigInt(
      restLoan.liquidationThresholdBPS || "12000"
    ),
    maxPriceStaleness: BigInt(restLoan.maxPriceStaleness || "3600"),
    repaidAmount: BigInt(restLoan.repaidAmount || "0"),
    historicalPriceUSD: restLoan.historicalPriceUSD || "0",
    historicalAmountUSD: restLoan.historicalAmountUSD || "0",
  };

  return converted;
}
