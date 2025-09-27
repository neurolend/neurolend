"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Zap,
  DollarSign,
  Clock,
} from "lucide-react";
import { useRestOffersData, convertRestLoanToProcessedLoan, useLoansWithTokenInfo } from "@/hooks/useRestApi";
import { ethers } from "ethers";

interface OrderBookProps {
  selectedToken?: string;
  onOrderSelect?: (order: any, type: "offer" | "request") => void;
}

interface LoanOffer {
  id: string;
  lender: string;
  tokenAddress: string;
  amount: string;
  interestRate: number;
  duration: number;
  collateralAddress: string;
  collateralAmount: string;
  liquidityUSD: string;
  tokenInfo?: any;
  collateralInfo?: any;
}

interface LoanRequest {
  id: string;
  borrower: string;
  tokenAddress: string;
  amount: string;
  maxInterestRate: number;
  duration: number;
  collateralAddress: string;
  collateralAmount: string;
  liquidityUSD: string;
  tokenInfo?: any;
  collateralInfo?: any;
}

export function OrderBook({ selectedToken, onOrderSelect }: OrderBookProps) {
  // Use REST API data instead of contract calls
  const {
    loans: rawRestLoans,
    loading: isLoadingRest,
    error: restError,
    refresh: refreshRestData,
  } = useRestOffersData();

  // Convert and enhance loans with token info
  const processedLoans = useMemo(() => 
    rawRestLoans.map(convertRestLoanToProcessedLoan), 
    [rawRestLoans]
  );

  const {
    loans: enhancedLoans,
    loading: isLoadingTokenInfo,
    error: tokenInfoError,
    refresh: refreshTokenInfo,
  } = useLoansWithTokenInfo(processedLoans);

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Process loans into offers and requests
  const { loanOffers, loanRequests } = useMemo(() => {
    if (!enhancedLoans || enhancedLoans.length === 0) {
      return { loanOffers: [], loanRequests: [] };
    }

    const offers: LoanOffer[] = [];
    const requests: LoanRequest[] = [];

    enhancedLoans.forEach((loan) => {
      // Only include pending loans
      if (loan.status !== "Pending") return;

      const tokenInfo = loan.tokenInfo;
      const collateralInfo = loan.collateralInfo;

      // Format amounts using token decimals
      const formattedAmount = tokenInfo?.decimals 
        ? ethers.formatUnits(loan.amount || "0", tokenInfo.decimals)
        : loan.amount || "0";
      
      const formattedCollateralAmount = collateralInfo?.decimals
        ? ethers.formatUnits(loan.collateralAmount || "0", collateralInfo.decimals)
        : loan.collateralAmount || "0";

      // Check if it's a lend offer (has lender, no borrower)
      if (loan.lender && loan.lender !== ethers.ZeroAddress && 
          (!loan.borrower || loan.borrower === ethers.ZeroAddress)) {
        
        // Filter by selected token if specified
        if (!selectedToken || tokenInfo?.symbol === selectedToken) {
          offers.push({
            id: loan.id,
            lender: loan.lender,
            tokenAddress: loan.tokenAddress,
            amount: formattedAmount,
            interestRate: loan.interestRate || 0,
            duration: loan.duration || 0,
            collateralAddress: loan.collateralAddress,
            collateralAmount: formattedCollateralAmount,
            liquidityUSD: "$0.00", // TODO: Calculate based on token prices
            tokenInfo,
            collateralInfo,
          });
        }
      }
      
      // Check if it's a borrow request (has borrower, no lender)
      else if (loan.borrower && loan.borrower !== ethers.ZeroAddress && 
               (!loan.lender || loan.lender === ethers.ZeroAddress)) {
        
        // Filter by selected token if specified
        if (!selectedToken || tokenInfo?.symbol === selectedToken) {
          requests.push({
            id: loan.id,
            borrower: loan.borrower,
            tokenAddress: loan.tokenAddress,
            amount: formattedAmount,
            maxInterestRate: loan.interestRate || 0,
            duration: loan.duration || 0,
            collateralAddress: loan.collateralAddress,
            collateralAmount: formattedCollateralAmount,
            liquidityUSD: "$0.00", // TODO: Calculate based on token prices
            tokenInfo,
            collateralInfo,
          });
        }
      }
    });

    // Sort offers by interest rate (ascending - best rates first)
    offers.sort((a, b) => a.interestRate - b.interestRate);

    // Sort requests by max interest rate (descending - highest rates first)
    requests.sort((a, b) => b.maxInterestRate - a.maxInterestRate);

    return { loanOffers: offers, loanRequests: requests };
  }, [enhancedLoans, selectedToken]);

  // Update last updated timestamp when data changes
  useEffect(() => {
    if (enhancedLoans.length > 0) {
      setLastUpdated(new Date());
    }
  }, [enhancedLoans]);

  const handleRefresh = () => {
    // Trigger refetch from REST API
    refreshRestData();
    refreshTokenInfo();
  };

  const formatRate = (basisPoints: number) => {
    return (basisPoints / 100).toFixed(2);
  };

  const formatDuration = (days: number) => {
    return `${days}d`;
  };

  const isLoading = isLoadingRest || isLoadingTokenInfo;

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-8 w-24" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center">
              <DollarSign className="h-5 w-5 text-primary mr-2" />
              Order Book
            </CardTitle>
            <CardDescription>
              {selectedToken
                ? `${selectedToken} lending market`
                : "Live lending market"}
            </CardDescription>
          </div>

          <div className="flex items-center space-x-2">
            {lastUpdated && (
              <div className="text-xs text-muted-foreground flex items-center space-x-1">
                <Clock className="h-3 w-3" />
                <span>
                  {Math.floor((Date.now() - lastUpdated.getTime()) / 1000)}s ago
                </span>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="grid grid-cols-1 lg:grid-cols-2 h-full">
          {/* Lend Offers (Asks) - Left Side */}
          <div className="border-r border-border/50 p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-green-600 flex items-center text-sm">
                  <TrendingUp className="h-4 w-4 mr-1" />
                  Lend Offers
                </h3>
                <Badge
                  variant="outline"
                  className="text-xs bg-green-50 text-green-700 border-green-200"
                >
                  {loanOffers.length} offers
                </Badge>
              </div>

              <div className="space-y-1">
                <div className="grid grid-cols-3 gap-2 text-xs font-medium text-muted-foreground px-2 py-1">
                  <span>APR</span>
                  <span className="text-center">Amount</span>
                  <span className="text-right">Liquidity</span>
                </div>

                {loanOffers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No lend offers available</p>
                  </div>
                ) : (
                  <div className="space-y-1 max-h-96 overflow-y-auto">
                    {loanOffers.map((offer) => (
                      <div
                        key={offer.id}
                        className="grid grid-cols-3 gap-2 p-2 rounded-lg hover:bg-green-50/50 cursor-pointer transition-colors border border-transparent hover:border-green-200"
                        onClick={() => onOrderSelect?.(offer, "offer")}
                      >
                        <div className="text-sm font-medium text-green-600">
                          {formatRate(offer.interestRate)}%
                        </div>
                        <div className="text-sm text-center">
                          {parseFloat(offer.amount).toLocaleString()}
                        </div>
                        <div className="text-sm text-right text-muted-foreground">
                          {offer.liquidityUSD}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Borrow Requests (Bids) - Right Side */}
          <div className="p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-red-600 flex items-center text-sm">
                  <TrendingDown className="h-4 w-4 mr-1" />
                  Borrow Requests
                </h3>
                <Badge
                  variant="outline"
                  className="text-xs bg-red-50 text-red-700 border-red-200"
                >
                  {loanRequests.length} requests
                </Badge>
              </div>

              <div className="space-y-1">
                <div className="grid grid-cols-3 gap-2 text-xs font-medium text-muted-foreground px-2 py-1">
                  <span>Max APR</span>
                  <span className="text-center">Amount</span>
                  <span className="text-right">Collateral</span>
                </div>

                {loanRequests.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <TrendingDown className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No borrow requests available</p>
                  </div>
                ) : (
                  <div className="space-y-1 max-h-96 overflow-y-auto">
                    {loanRequests.map((request) => (
                      <div
                        key={request.id}
                        className="grid grid-cols-3 gap-2 p-2 rounded-lg hover:bg-red-50/50 cursor-pointer transition-colors border border-transparent hover:border-red-200"
                        onClick={() => onOrderSelect?.(request, "request")}
                      >
                        <div className="text-sm font-medium text-red-600">
                          {formatRate(request.maxInterestRate)}%
                        </div>
                        <div className="text-sm text-center">
                          {parseFloat(request.amount).toLocaleString()}
                        </div>
                        <div className="text-sm text-right text-muted-foreground">
                          {parseFloat(request.collateralAmount).toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Market Stats Footer */}
        <div className="border-t border-border/50 p-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-xs text-muted-foreground">Mid Rate</div>
              <div className="text-sm font-bold">
                {loanOffers.length > 0 && loanRequests.length > 0
                  ? `${
                      ((parseFloat(formatRate(loanOffers[loanOffers.length - 1]?.interestRate || 0)) +
                        parseFloat(formatRate(loanRequests[0]?.maxInterestRate || 0))) / 2).toFixed(2)
                    }%`
                  : "—"}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Spread</div>
              <div className="text-sm font-bold">
                {loanOffers.length > 0 && loanRequests.length > 0
                  ? `${
                      Math.abs(parseFloat(formatRate(loanOffers[loanOffers.length - 1]?.interestRate || 0)) -
                      parseFloat(formatRate(loanRequests[0]?.maxInterestRate || 0))).toFixed(2)
                    }%`
                  : "—"}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Total Offers</div>
              <div className="text-sm font-bold text-green-600">
                {loanOffers.length}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">
                Total Requests
              </div>
              <div className="text-sm font-bold text-red-600">
                {loanRequests.length}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default OrderBook;
