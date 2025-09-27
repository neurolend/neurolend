"use client";

import { useState, useEffect } from "react";
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
import { useP2PLending } from "@/hooks/useP2PLending";
import { ethers } from "ethers";
import { getTokenByAddress } from "@/config/tokens";

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
  const {
    address,
    isConnected,
    activeLoanOfferIds,
    activeBorrowRequestIds,
    isLoadingOffers,
    isLoadingRequests,
    getLoan,
    refetchOffers,
    refetchRequests,
  } = useP2PLending();
  const [isLoading, setIsLoading] = useState(true);
  const [loanOffers, setLoanOffers] = useState<LoanOffer[]>([]);
  const [loanRequests, setLoanRequests] = useState<LoanRequest[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Add refresh trigger state
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Fetch real data from contract
  useEffect(() => {
    const fetchOrderBookData = async () => {
      if (!isConnected) {
        setIsLoading(false);
        return;
      }

      // Use the loading states from the hook
      if (isLoadingOffers || isLoadingRequests) {
        setIsLoading(true);
        return;
      }

      setIsLoading(true);

      try {
        const offers: LoanOffer[] = [];
        const requests: LoanRequest[] = [];

        // Process loan offers if available
        if (activeLoanOfferIds && activeLoanOfferIds.length > 0) {
          for (const offerId of activeLoanOfferIds) {
            try {
              const loan = await getLoan(offerId);

              // Only include pending loan offers (lender exists, borrower is zero address)
              if (
                loan &&
                loan.status === 0 &&
                loan.lender !== ethers.ZeroAddress &&
                loan.borrower === ethers.ZeroAddress
              ) {
                const tokenInfo = getTokenByAddress(loan.tokenAddress);
                const collateralInfo = getTokenByAddress(
                  loan.collateralAddress
                );

                offers.push({
                  id: loan.id.toString(),
                  lender: loan.lender,
                  tokenAddress: loan.tokenAddress,
                  amount: ethers.formatUnits(
                    loan.amount,
                    tokenInfo?.decimals || 18
                  ),
                  interestRate: Number(loan.interestRate), // Already in basis points
                  duration: Number(loan.duration) / (24 * 60 * 60), // Convert seconds to days
                  collateralAddress: loan.collateralAddress,
                  collateralAmount: ethers.formatUnits(
                    loan.collateralAmount,
                    collateralInfo?.decimals || 18
                  ),
                  liquidityUSD: "$0.00", // TODO: Calculate based on token prices
                  tokenInfo,
                  collateralInfo,
                });
              }
            } catch (error) {
              console.error(`Error fetching loan ${offerId}:`, error);
            }
          }
        }

        // Process borrow requests if available
        if (activeBorrowRequestIds && activeBorrowRequestIds.length > 0) {
          for (const requestId of activeBorrowRequestIds) {
            try {
              const loan = await getLoan(requestId);

              // Only include pending borrow requests (borrower exists, lender is zero address)
              if (
                loan &&
                loan.status === 0 &&
                loan.borrower !== ethers.ZeroAddress &&
                loan.lender === ethers.ZeroAddress
              ) {
                const tokenInfo = getTokenByAddress(loan.tokenAddress);
                const collateralInfo = getTokenByAddress(
                  loan.collateralAddress
                );

                requests.push({
                  id: loan.id.toString(),
                  borrower: loan.borrower,
                  tokenAddress: loan.tokenAddress,
                  amount: ethers.formatUnits(
                    loan.amount,
                    tokenInfo?.decimals || 18
                  ),
                  maxInterestRate: Number(loan.interestRate), // Already in basis points
                  duration: Number(loan.duration) / (24 * 60 * 60), // Convert seconds to days
                  collateralAddress: loan.collateralAddress,
                  collateralAmount: ethers.formatUnits(
                    loan.collateralAmount,
                    collateralInfo?.decimals || 18
                  ),
                  liquidityUSD: "$0.00", // TODO: Calculate based on token prices
                  tokenInfo,
                  collateralInfo,
                });
              }
            } catch (error) {
              console.error(`Error fetching request ${requestId}:`, error);
            }
          }
        }

        // Filter by selected token if specified
        const filteredOffers = selectedToken
          ? offers.filter((offer) => offer.tokenInfo?.symbol === selectedToken)
          : offers;

        const filteredRequests = selectedToken
          ? requests.filter(
              (request) => request.tokenInfo?.symbol === selectedToken
            )
          : requests;

        // Sort offers by interest rate (ascending - best rates first)
        filteredOffers.sort((a, b) => a.interestRate - b.interestRate);

        // Sort requests by max interest rate (descending - highest rates first)
        filteredRequests.sort((a, b) => b.maxInterestRate - a.maxInterestRate);

        setLoanOffers(filteredOffers);
        setLoanRequests(filteredRequests);
        setLastUpdated(new Date());
      } catch (error) {
        console.error("Error fetching order book data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrderBookData();
  }, [
    selectedToken,
    isConnected,
    activeLoanOfferIds,
    activeBorrowRequestIds,
    isLoadingOffers,
    isLoadingRequests,
    getLoan,
    refreshTrigger,
  ]);

  const handleRefresh = () => {
    // Trigger refetch from the hook and local refresh
    refetchOffers();
    refetchRequests();
    setRefreshTrigger((prev) => prev + 1);
  };

  const formatRate = (basisPoints: number) => {
    return (basisPoints / 100).toFixed(2);
  };

  const formatDuration = (days: number) => {
    return `${days}d`;
  };

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
                      ((formatRate(
                        loanOffers[loanOffers.length - 1]?.interestRate || 0
                      ) as any) +
                        (formatRate(
                          loanRequests[0]?.maxInterestRate || 0
                        ) as any)) /
                      2
                    }%`
                  : "—"}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Spread</div>
              <div className="text-sm font-bold">
                {loanOffers.length > 0 && loanRequests.length > 0
                  ? `${
                      (formatRate(
                        loanOffers[loanOffers.length - 1]?.interestRate || 0
                      ) as any) -
                      (formatRate(loanRequests[0]?.maxInterestRate || 0) as any)
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
