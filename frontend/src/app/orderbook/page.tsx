"use client";

import { generateBreadcrumbSchema, StructuredData } from "@/lib/seo";
import { useState, useRef, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
  Wallet,
  RefreshCw,
  BookOpen,
  DollarSign,
  Clock,
  Shield,
  Zap,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";

import { TokenSelector, TokenSelectorRef } from "@/components/TokenSelector";
import { OrderBook } from "@/components/OrderBook";
import { useP2PLending, LoanOfferFormData } from "@/hooks/useP2PLending";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { ethers } from "ethers";
import {
  TokenInfo,
  getRecommendedParameters,
  formatBasisPoints,
  formatDuration,
  percentageToBasisPoints,
} from "@/config/tokens";
import { useCollateralCalculation } from "@/hooks/useTokenPrices";
import { DecimalValidation } from "@/lib/decimals";

const breadcrumbSchema = generateBreadcrumbSchema([
  { name: "Home", url: "/" },
  { name: "Order Book", url: "/orderbook" },
]);

export default function OrderBookPage() {
  const {
    createLoanOffer,
    createBorrowRequest,
    transactionState,
    resetTransactionState,
    isConnected,
    address,
  } = useP2PLending();

  // Refs for token selectors
  const loanTokenSelectorRef = useRef<TokenSelectorRef>(null);
  const collateralTokenSelectorRef = useRef<TokenSelectorRef>(null);

  // Form state
  const [orderType, setOrderType] = useState<"lend" | "borrow">("lend");
  const [selectedLoanToken, setSelectedLoanToken] = useState<
    TokenInfo | undefined
  >();
  const [selectedCollateralToken, setSelectedCollateralToken] = useState<
    TokenInfo | undefined
  >();
  const [formData, setFormData] = useState<LoanOfferFormData>({
    tokenAddress: "",
    amount: "",
    interestRate: "",
    duration: "",
    collateralAddress: "",
    collateralAmount: "",
  });

  // Get token balances
  const {
    formattedBalance: loanTokenBalance,
    isLoading: isLoadingLoanBalance,
    error: loanBalanceError,
    refreshBalance: refreshLoanBalance,
    balance: rawLoanBalance,
  } = useTokenBalance(
    selectedLoanToken?.address || null,
    address || null,
    selectedLoanToken?.decimals || 18,
    {
      refreshInterval: 30000,
      enableAutoRefresh: !!selectedLoanToken && !!address,
    }
  );

  const {
    formattedBalance: collateralTokenBalance,
    isLoading: isLoadingCollateralBalance,
    error: collateralBalanceError,
    refreshBalance: refreshCollateralBalance,
    balance: rawCollateralBalance,
  } = useTokenBalance(
    selectedCollateralToken?.address || null,
    address || null,
    selectedCollateralToken?.decimals || 18,
    {
      refreshInterval: 30000,
      enableAutoRefresh: !!selectedCollateralToken && !!address,
    }
  );

  // Collateral calculation
  const {
    calculation: collateralCalc,
    isLoading: calcLoading,
    prices,
    refreshPrices,
  } = useCollateralCalculation(
    selectedLoanToken,
    selectedCollateralToken,
    formData.amount,
    formData.collateralAmount
  );

  const [recommendedParams, setRecommendedParams] = useState<{
    minCollateralRatio: number;
    liquidationThreshold: number;
    maxPriceStaleness: number;
  } | null>(null);

  const handleInputChange = (field: keyof LoanOfferFormData, value: string) => {
    if (field === "amount" || field === "collateralAmount") {
      const token =
        field === "amount" ? selectedLoanToken : selectedCollateralToken;
      if (token && value !== "") {
        const cleanedValue = DecimalValidation.cleanInput(
          value,
          token.decimals
        );
        setFormData((prev) => ({ ...prev, [field]: cleanedValue }));
      } else {
        setFormData((prev) => ({ ...prev, [field]: value }));
      }
    } else {
      setFormData((prev) => ({ ...prev, [field]: value }));
    }
  };

  const handleLoanTokenSelect = (token: TokenInfo) => {
    setSelectedLoanToken(token);
    setFormData((prev) => ({ ...prev, tokenAddress: token.address }));
    updateRecommendedParams(token, selectedCollateralToken);
  };

  const handleCollateralTokenSelect = (token: TokenInfo) => {
    setSelectedCollateralToken(token);
    setFormData((prev) => ({ ...prev, collateralAddress: token.address }));
    updateRecommendedParams(selectedLoanToken, token);
  };

  const updateRecommendedParams = (
    loanToken?: TokenInfo,
    collateralToken?: TokenInfo
  ) => {
    if (loanToken && collateralToken) {
      const params = getRecommendedParameters(loanToken, collateralToken);
      setRecommendedParams(params);
      if (!formData.interestRate) {
        setFormData((prev) => ({ ...prev, interestRate: "7.5" }));
      }
    } else {
      setRecommendedParams(null);
    }
  };

  const handleMaxAmount = () => {
    if (orderType === "lend" && selectedLoanToken && rawLoanBalance) {
      const maxAmount = ethers.formatUnits(
        rawLoanBalance,
        selectedLoanToken.decimals
      );
      handleInputChange("amount", maxAmount);
    } else if (
      orderType === "borrow" &&
      selectedCollateralToken &&
      rawCollateralBalance
    ) {
      const maxAmount = ethers.formatUnits(
        rawCollateralBalance,
        selectedCollateralToken.decimals
      );
      handleInputChange("collateralAmount", maxAmount);
    }
  };

  const handleOrderSelect = (order: any, type: "offer" | "request") => {
    if (type === "offer") {
      // User clicked on a lend offer, switch to borrow mode
      setOrderType("borrow");
      handleInputChange("interestRate", (order.interestRate / 100).toString());
      handleInputChange("amount", order.amount);
      if (order.tokenInfo) {
        setSelectedLoanToken(order.tokenInfo);
        setFormData((prev) => ({
          ...prev,
          tokenAddress: order.tokenInfo.address,
        }));
      }
      if (order.collateralInfo) {
        setSelectedCollateralToken(order.collateralInfo);
        setFormData((prev) => ({
          ...prev,
          collateralAddress: order.collateralInfo.address,
        }));
      }
    } else {
      // User clicked on a borrow request, switch to lend mode
      setOrderType("lend");
      handleInputChange(
        "interestRate",
        (order.maxInterestRate / 100).toString()
      );
      handleInputChange("amount", order.amount);
      if (order.tokenInfo) {
        setSelectedLoanToken(order.tokenInfo);
        setFormData((prev) => ({
          ...prev,
          tokenAddress: order.tokenInfo.address,
        }));
      }
      if (order.collateralInfo) {
        setSelectedCollateralToken(order.collateralInfo);
        setFormData((prev) => ({
          ...prev,
          collateralAddress: order.collateralInfo.address,
        }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isConnected) {
      alert("Please connect your wallet first");
      return;
    }

    // Client-side validation
    if (!selectedLoanToken) {
      alert("Please select a loan token");
      return;
    }
    if (!selectedCollateralToken) {
      alert("Please select a collateral token");
      return;
    }
    if (!formData.amount || formData.amount === "0") {
      alert("Please enter a valid loan amount");
      return;
    }
    if (!formData.interestRate || formData.interestRate === "0") {
      alert("Please enter a valid interest rate");
      return;
    }
    if (!formData.duration || formData.duration === "0") {
      alert("Please enter a valid duration");
      return;
    }
    if (!formData.collateralAmount || formData.collateralAmount === "0") {
      alert("Please enter a valid collateral amount");
      return;
    }

    try {
      const interestRatePercentage = parseFloat(formData.interestRate);
      if (isNaN(interestRatePercentage)) {
        alert("Please enter a valid interest rate");
        return;
      }
      
      const durationDays = parseFloat(formData.duration);
      if (isNaN(durationDays) || durationDays <= 0) {
        alert("Please enter a valid duration in days");
        return;
      }

      const interestRateBasisPoints = percentageToBasisPoints(
        interestRatePercentage
      );

      const contractFormData = {
        ...formData,
        interestRate: interestRateBasisPoints.toString(),
      };

      console.log("Submitting form data:", contractFormData);

      if (orderType === "lend") {
        await createLoanOffer(contractFormData);
      } else {
        await createBorrowRequest(contractFormData);
      }

      // Refresh balances after transaction
      loanTokenSelectorRef.current?.refreshBalance();
      collateralTokenSelectorRef.current?.refreshBalance();
      refreshLoanBalance();
      refreshCollateralBalance();
    } catch (error) {
      console.error("Failed to create order:", error);
      alert(`Failed to create order: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <>
      <StructuredData data={breadcrumbSchema} />
      <div className="min-h-screen bg-background pb-8">
        {/* Header */}
        <div className="border-b border-border/40 bg-card/30 backdrop-blur-sm">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-primary to-accent flex items-center justify-center">
                    <BookOpen className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold">Order Book</h1>
                    <p className="text-sm text-muted-foreground">
                      {selectedLoanToken
                        ? selectedLoanToken.symbol
                        : "Select Token"}{" "}
                      Lending Market
                    </p>
                  </div>
                </div>

                {/* Market Stats */}
                <div className="hidden lg:flex items-center space-x-6 ml-8">
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground">
                      Mid Rate
                    </div>
                    <div className="text-lg font-bold text-primary">6.12%</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground">Spread</div>
                    <div className="text-lg font-bold">0.25%</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground">
                      24h Volume
                    </div>
                    <div className="text-lg font-bold">$1.2M</div>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Button variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
                <Badge
                  variant="secondary"
                  className="bg-green-50 text-green-700 border-green-200"
                >
                  <div className="w-2 h-2 rounded-full bg-green-500 mr-2" />
                  Live
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="container mx-auto px-6 py-6">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Left Side - Order Book */}
            <div className="xl:col-span-2">
              <OrderBook
                selectedToken={selectedLoanToken?.symbol}
                onOrderSelect={handleOrderSelect}
              />
            </div>

            {/* Right Side - Swap-like Interface */}
            <div className="space-y-4">
              {/* Order Type Selector */}
              <Card>
                <CardContent className="p-4">
                  <Tabs
                    value={orderType}
                    onValueChange={(value: string) =>
                      setOrderType(value as "lend" | "borrow")
                    }
                  >
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger
                        value="lend"
                        className="flex items-center space-x-2"
                      >
                        <TrendingUp className="h-4 w-4" />
                        <span>Lend</span>
                      </TabsTrigger>
                      <TabsTrigger
                        value="borrow"
                        className="flex items-center space-x-2"
                      >
                        <TrendingDown className="h-4 w-4" />
                        <span>Borrow</span>
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </CardContent>
              </Card>

              {/* Main Trading Interface */}
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg flex items-center">
                    {orderType === "lend" ? (
                      <>
                        <TrendingUp className="h-5 w-5 text-green-600 mr-2" />
                        Create Lend Offer
                      </>
                    ) : (
                      <>
                        <TrendingDown className="h-5 w-5 text-red-600 mr-2" />
                        Create Borrow Request
                      </>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {orderType === "lend"
                      ? "Offer tokens to lend at your desired rate"
                      : "Request tokens to borrow with your collateral"}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-6">
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Token Selection */}
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">
                          {orderType === "lend"
                            ? "Token to Lend"
                            : "Token to Borrow"}
                        </Label>
                        <TokenSelector
                          ref={loanTokenSelectorRef}
                          selectedToken={selectedLoanToken}
                          onTokenSelect={handleLoanTokenSelect}
                          label={
                            orderType === "lend"
                              ? "Token to Lend"
                              : "Token to Borrow"
                          }
                          placeholder={`Select ${orderType === "lend" ? "lending" : "borrowing"} token`}
                          excludeToken={selectedCollateralToken}
                          userAddress={address}
                          showBalance={true}
                        />
                      </div>

                      <div className="flex items-center justify-center">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                          <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-medium">
                          Collateral Token
                        </Label>
                        <TokenSelector
                          ref={collateralTokenSelectorRef}
                          selectedToken={selectedCollateralToken}
                          onTokenSelect={handleCollateralTokenSelect}
                          label="Collateral Token"
                          placeholder="Select collateral token"
                          excludeToken={selectedLoanToken}
                          userAddress={address}
                          showBalance={true}
                        />
                      </div>
                    </div>

                    <Separator />

                    {/* Amount Input */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">
                          {orderType === "lend"
                            ? "Amount to Lend"
                            : "Amount to Borrow"}
                        </Label>
                        {selectedLoanToken && address && (
                          <div className="flex items-center gap-2 text-sm">
                            <Wallet className="h-3 w-3 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              Balance:
                            </span>
                            {isLoadingLoanBalance ? (
                              <RefreshCw className="h-3 w-3 animate-spin text-primary" />
                            ) : (
                              <>
                                <span className="font-medium text-primary">
                                  {loanTokenBalance} {selectedLoanToken.symbol}
                                </span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={handleMaxAmount}
                                  className="h-6 px-2 text-xs text-primary hover:text-primary-foreground hover:bg-primary"
                                >
                                  MAX
                                </Button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="relative">
                        <Input
                          type="text"
                          placeholder="0.0"
                          value={formData.amount}
                          onChange={(e) =>
                            handleInputChange("amount", e.target.value)
                          }
                          className="h-14 text-2xl font-medium pr-20"
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                          {selectedLoanToken?.symbol || "Token"}
                        </div>
                      </div>
                      {formData.amount && selectedLoanToken && (
                        <div className="text-sm text-muted-foreground">
                          ≈ $4,997.60{" "}
                          {/* TODO: Calculate based on live prices */}
                        </div>
                      )}
                    </div>

                    {/* Interest Rate */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">
                          {orderType === "lend"
                            ? "Interest Rate (%)"
                            : "Max Rate (%)"}
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          max="100"
                          placeholder="7.50"
                          value={formData.interestRate}
                          onChange={(e) =>
                            handleInputChange("interestRate", e.target.value)
                          }
                          className="h-12"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-medium">
                          Duration (Days)
                        </Label>
                        <Input
                          type="number"
                          step="1"
                          min="1"
                          max="365"
                          placeholder="30"
                          value={formData.duration}
                          onChange={(e) =>
                            handleInputChange("duration", e.target.value)
                          }
                          className="h-12"
                          required
                        />
                      </div>
                    </div>

                    {/* Collateral Amount */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">
                          {orderType === "lend"
                            ? "Required Collateral"
                            : "Collateral Offered"}
                        </Label>
                        {selectedCollateralToken && address && (
                          <div className="flex items-center gap-2 text-sm">
                            <Wallet className="h-3 w-3 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              Balance:
                            </span>
                            {isLoadingCollateralBalance ? (
                              <RefreshCw className="h-3 w-3 animate-spin text-primary" />
                            ) : (
                              <>
                                <span className="font-medium text-primary">
                                  {collateralTokenBalance}{" "}
                                  {selectedCollateralToken.symbol}
                                </span>
                                {orderType === "borrow" && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleMaxAmount}
                                    className="h-6 px-2 text-xs text-primary hover:text-primary-foreground hover:bg-primary"
                                  >
                                    MAX
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="relative">
                        <Input
                          type="text"
                          placeholder="0.0"
                          value={formData.collateralAmount}
                          onChange={(e) =>
                            handleInputChange(
                              "collateralAmount",
                              e.target.value
                            )
                          }
                          className="h-12 text-lg pr-20"
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                          {selectedCollateralToken?.symbol || "Token"}
                        </div>
                      </div>
                    </div>

                    {/* Order Type Specific Actions */}
                    <div className="space-y-4">
                      <Button
                        type="submit"
                        size="lg"
                        className={`w-full h-12 text-base font-semibold ${
                          orderType === "lend"
                            ? "bg-green-600 hover:bg-green-700 text-white"
                            : "bg-red-600 hover:bg-red-700 text-white"
                        }`}
                      >
                        {orderType === "lend" ? (
                          <>
                            <TrendingUp className="h-4 w-4 mr-2" />
                            Create Lend Offer
                          </>
                        ) : (
                          <>
                            <TrendingDown className="h-4 w-4 mr-2" />
                            Create Borrow Request
                          </>
                        )}
                      </Button>

                      <div className="text-xs text-center text-muted-foreground">
                        {orderType === "lend"
                          ? "Your tokens will be escrowed until the offer is filled or cancelled"
                          : "Your collateral will be escrowed until the request is filled or cancelled"}
                      </div>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Bottom Section - Order Details */}
          <div className="mt-8 pt-6 border-t border-border/20 grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Market Information */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center">
                  <DollarSign className="h-4 w-4 text-primary mr-2" />
                  Market Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    Protocol
                  </span>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 rounded bg-gradient-to-r from-primary to-accent" />
                    <span className="text-sm font-medium">neurolend</span>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    Total Borrow
                  </span>
                  <span className="text-sm font-medium">$1,000,000.00</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    Bad Debt
                  </span>
                  <span className="text-sm font-medium text-green-600">
                    $0.00
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    Liquidation LTV
                  </span>
                  <span className="text-sm font-medium">85.00%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    Liquidation Penalty
                  </span>
                  <span className="text-sm font-medium">4.50%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Oracle</span>
                  <div className="flex items-center space-x-1">
                    <span className="text-sm font-medium">Pyth</span>
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Current Order Summary */}
            {formData.amount && formData.interestRate && (
              <Card className="lg:col-span-2">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base flex items-center">
                    <Zap className="h-4 w-4 text-primary mr-2" />
                    Order Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">
                        {orderType === "lend" ? "Lending" : "Borrowing"}
                      </div>
                      <div className="text-lg font-bold">
                        {formData.amount}{" "}
                        {selectedLoanToken?.symbol || "Tokens"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        ≈ $4,997.60
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">
                        {orderType === "lend" ? "Interest Rate" : "Max Rate"}
                      </div>
                      <div className="text-lg font-bold text-primary">
                        {formData.interestRate}% APR
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {orderType === "lend"
                          ? "Fixed rate"
                          : "Maximum accepted"}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">
                        Duration
                      </div>
                      <div className="text-lg font-bold">
                        {formData.duration} days
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formData.duration &&
                          `${Math.round(parseFloat(formData.duration) / 30)} month${Math.round(parseFloat(formData.duration) / 30) !== 1 ? "s" : ""}`}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">
                        {orderType === "lend"
                          ? "Required Collateral"
                          : "Offering Collateral"}
                      </div>
                      <div className="text-lg font-bold">
                        {formData.collateralAmount}{" "}
                        {selectedCollateralToken?.symbol || "Tokens"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        ≈ $0.00
                      </div>
                    </div>
                  </div>

                  {/* Collateral Health Indicator */}
                  {collateralCalc && (
                    <div className="mt-4 p-3 bg-secondary/30 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          Collateral Health
                        </span>
                        <div className="flex items-center space-x-2">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              collateralCalc.isHealthy
                                ? "bg-green-500"
                                : "bg-red-500"
                            }`}
                          />
                          <span
                            className={`text-sm font-medium ${
                              collateralCalc.isHealthy
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {collateralCalc.currentRatio}%
                          </span>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {collateralCalc.isHealthy
                          ? "Sufficient collateral"
                          : "Needs more collateral"}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
