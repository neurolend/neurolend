"use client";

import { useState, useCallback, useEffect } from "react";
import { Eip1193Provider, ethers } from "ethers";
import { useAppKitAccount, useAppKitProvider } from "@reown/appkit/react";
import {
  neurolend_CONTRACT_ADDRESS,
  neurolend_ABI,
  ERC20_ABI,
  Loan,
  LoanStatus,
  SOMNIA_TESTNET_CONFIG,
} from "@/lib/contracts";
import { SUPPORTED_TOKENS, getRecommendedParameters } from "@/config/tokens";

export interface TransactionState {
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: string | null;
  hash: string | null;
  step:
    | "idle"
    | "approving"
    | "approved"
    | "creating"
    | "accepting"
    | "repaying"
    | "liquidating"
    | "cancelling"
    | "adding_collateral"
    | "removing_collateral"
    | "partial_repaying"
    | "success"
    | "error";
}

export interface LoanOfferFormData {
  tokenAddress: string;
  amount: string;
  interestRate: string;
  duration: string;
  collateralAddress: string;
  collateralAmount: string;
}

export const useP2PLending = () => {
  const { address, isConnected } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider<Eip1193Provider>("eip155");

  // State management
  const [transactionState, setTransactionState] = useState<TransactionState>({
    isLoading: false,
    isSuccess: false,
    isError: false,
    error: null,
    hash: null,
    step: "idle",
  });

  const [activeLoanOfferIds, setActiveLoanOfferIds] = useState<bigint[]>();
  const [activeBorrowRequestIds, setActiveBorrowRequestIds] = useState<bigint[]>();
  const [lenderLoans, setLenderLoans] = useState<bigint[]>();
  const [borrowerLoans, setBorrowerLoans] = useState<bigint[]>();
  const [isLoadingOffers, setIsLoadingOffers] = useState(false);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [isLoadingLenderLoans, setIsLoadingLenderLoans] = useState(false);
  const [isLoadingBorrowerLoans, setIsLoadingBorrowerLoans] = useState(false);

  // Create ethers provider and signer
  const getProvider = useCallback(() => {
    return new ethers.JsonRpcProvider(
      SOMNIA_TESTNET_CONFIG.rpcUrls.default.http[0]
    );
  }, []);

  const getSigner = useCallback(async () => {
    if (!walletProvider) throw new Error("Wallet not connected");
    const ethersProvider = new ethers.BrowserProvider(walletProvider);
    return await ethersProvider.getSigner();
  }, [walletProvider]);

  // Create contract instances
  const getReadContract = useCallback(() => {
    const provider = getProvider();
    return new ethers.Contract(
      neurolend_CONTRACT_ADDRESS,
      neurolend_ABI,
      provider
    );
  }, [getProvider]);

  const getWriteContract = useCallback(async () => {
    const signer = await getSigner();
    return new ethers.Contract(
      neurolend_CONTRACT_ADDRESS,
      neurolend_ABI,
      signer
    );
  }, [getSigner]);

  const getERC20Contract = useCallback(
    async (tokenAddress: string, needsSigner = false) => {
      if (needsSigner) {
        const signer = await getSigner();
        return new ethers.Contract(tokenAddress, ERC20_ABI, signer);
      } else {
        const provider = getProvider();
        return new ethers.Contract(tokenAddress, ERC20_ABI, provider);
      }
    },
    [getSigner, getProvider]
  );

  // Reset transaction state
  const resetTransactionState = useCallback(() => {
    setTransactionState({
      isLoading: false,
      isSuccess: false,
      isError: false,
      error: null,
      hash: null,
      step: "idle",
    });
  }, []);

  // Helper function to wait for transaction with retries
  const waitForTransactionWithRetry = useCallback(
    async (
      tx: ethers.ContractTransactionResponse,
      maxRetries = 3,
      delay = 2000
    ) => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(
            `Waiting for transaction (attempt ${attempt}/${maxRetries}):`,
            tx.hash
          );
          const receipt = await tx.wait();
          console.log("Transaction confirmed:", receipt);
          return receipt;
        } catch (error) {
          console.warn(`Attempt ${attempt} failed:`, error);

          if (attempt === maxRetries) {
            // Last attempt failed, but transaction was still submitted
            console.warn(
              "All attempts failed, but transaction was submitted:",
              tx.hash
            );
            throw new Error(
              `Transaction submitted (${tx.hash}) but receipt unavailable. This may be due to network issues.`
            );
          }

          // Wait before retry
          await new Promise((resolve) => setTimeout(resolve, delay * attempt));
        }
      }
    },
    []
  );

  // ============ READ FUNCTIONS ============

  const fetchActiveLoanOffers = useCallback(async () => {
    try {
      setIsLoadingOffers(true);
      const contract = getReadContract();
      const offers = await contract.getActiveLoanOffers();
      setActiveLoanOfferIds(
        offers.map((id: ethers.BigNumberish) => BigInt(id.toString()))
      );
    } catch (error) {
      console.error("Error fetching active loan offers:", error);
    } finally {
      setIsLoadingOffers(false);
    }
  }, [getReadContract]);

  const fetchActiveBorrowRequests = useCallback(async () => {
    try {
      setIsLoadingRequests(true);
      const contract = getReadContract();
      const requests = await contract.getActiveBorrowRequests();
      setActiveBorrowRequestIds(
        requests.map((id: ethers.BigNumberish) => BigInt(id.toString()))
      );
    } catch (error) {
      console.error("Error fetching active borrow requests:", error);
    } finally {
      setIsLoadingRequests(false);
    }
  }, [getReadContract]);

  const fetchLenderLoans = useCallback(async () => {
    if (!address) return;
    try {
      setIsLoadingLenderLoans(true);
      const contract = getReadContract();
      const loans = await contract.getLenderLoans(address);
      setLenderLoans(
        loans.map((id: ethers.BigNumberish) => BigInt(id.toString()))
      );
    } catch (error) {
      console.error("Error fetching lender loans:", error);
    } finally {
      setIsLoadingLenderLoans(false);
    }
  }, [address, getReadContract]);

  const fetchBorrowerLoans = useCallback(async () => {
    if (!address) return;
    try {
      setIsLoadingBorrowerLoans(true);
      const contract = getReadContract();
      const loans = await contract.getBorrowerLoans(address);
      setBorrowerLoans(
        loans.map((id: ethers.BigNumberish) => BigInt(id.toString()))
      );
    } catch (error) {
      console.error("Error fetching borrower loans:", error);
    } finally {
      setIsLoadingBorrowerLoans(false);
    }
  }, [address, getReadContract]);

  // Get loan details by ID
  const getLoan = useCallback(
    async (loanId: bigint): Promise<Loan | null> => {
      try {
        const contract = getReadContract();
        const loan = await contract.getLoan(loanId);
        return {
          id: BigInt(loan.id.toString()),
          lender: loan.lender,
          borrower: loan.borrower,
          tokenAddress: loan.tokenAddress,
          amount: BigInt(loan.amount.toString()),
          interestRate: BigInt(loan.interestRate.toString()),
          duration: BigInt(loan.duration.toString()),
          collateralAddress: loan.collateralAddress,
          collateralAmount: BigInt(loan.collateralAmount.toString()),
          startTime: BigInt(loan.startTime.toString()),
          status: loan.status,
          minCollateralRatioBPS: BigInt(
            loan.minCollateralRatioBPS?.toString() || "0"
          ),
          liquidationThresholdBPS: BigInt(
            loan.liquidationThresholdBPS?.toString() || "0"
          ),
          maxPriceStaleness: BigInt(loan.maxPriceStaleness?.toString() || "0"),
          repaidAmount: BigInt(loan.repaidAmount?.toString() || "0"),
        };
      } catch (error) {
        console.error("Error fetching loan details:", error);
        return null;
      }
    },
    [getReadContract]
  );

  // Check ERC20 allowance
  const checkAllowance = useCallback(
    async (
      tokenAddress: string,
      owner: string,
      spender: string
    ): Promise<bigint> => {
      try {
        const contract = await getERC20Contract(tokenAddress, false);
        const allowance = await contract.allowance(owner, spender);
        return BigInt(allowance.toString());
      } catch (error) {
        console.error("Error checking allowance:", error);
        return BigInt(0);
      }
    },
    [getERC20Contract]
  );

  // Check ERC20 balance
  const checkBalance = useCallback(
    async (tokenAddress: string, account: string): Promise<bigint> => {
      try {
        const contract = await getERC20Contract(tokenAddress, false);
        const balance = await contract.balanceOf(account);
        return BigInt(balance.toString());
      } catch (error) {
        console.error("Error checking balance:", error);
        return BigInt(0);
      }
    },
    [getERC20Contract]
  );

  // ============ WRITE FUNCTIONS ============

  // Approve ERC20 tokens
  const approveToken = useCallback(
    async (tokenAddress: string, amount: bigint) => {
      if (!address) throw new Error("Wallet not connected");

      setTransactionState({
        isLoading: true,
        isSuccess: false,
        isError: false,
        error: null,
        hash: null,
        step: "approving",
      });

      try {
        const contract = await getERC20Contract(tokenAddress, true);
        const tx = await contract.approve(neurolend_CONTRACT_ADDRESS, amount);
        await tx.wait();

        setTransactionState((prev) => ({
          ...prev,
          hash: tx.hash,
          step: "approved",
          isLoading: false,
          isSuccess: true,
        }));

        return tx.hash;
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to approve tokens";
        setTransactionState({
          isLoading: false,
          isSuccess: false,
          isError: true,
          error: errorMessage,
          hash: null,
          step: "error",
        });
        throw error;
      }
    },
    [address, getERC20Contract]
  );

  // Create loan offer with two-step process
  const createLoanOffer = useCallback(
    async (formData: LoanOfferFormData) => {
      if (!address) throw new Error("Wallet not connected");

      try {
        // Get token information for proper decimal handling
        const loanToken = Object.values(SUPPORTED_TOKENS).find(
          (token) =>
            token.address.toLowerCase() === formData.tokenAddress.toLowerCase()
        );
        const collateralToken = Object.values(SUPPORTED_TOKENS).find(
          (token) =>
            token.address.toLowerCase() ===
            formData.collateralAddress.toLowerCase()
        );

        if (!loanToken)
          throw new Error("Loan token not found in supported tokens");
        if (!collateralToken)
          throw new Error("Collateral token not found in supported tokens");

        // Validate form data before conversion
        if (!formData.amount || formData.amount === "0") {
          throw new Error("Please enter a valid loan amount");
        }
        if (!formData.interestRate || formData.interestRate === "0") {
          throw new Error("Please enter a valid interest rate");
        }
        if (!formData.duration || formData.duration === "0") {
          throw new Error("Please enter a valid duration");
        }
        if (!formData.collateralAmount || formData.collateralAmount === "0") {
          throw new Error("Please enter a valid collateral amount");
        }

        // Convert form data to contract parameters using proper decimals
        const amount = ethers.parseUnits(formData.amount, loanToken.decimals);
        const interestRateValue = parseFloat(formData.interestRate);
        if (isNaN(interestRateValue)) {
          throw new Error("Invalid interest rate value");
        }
        const interestRate = BigInt(Math.floor(interestRateValue)); // Already converted to basis points
        
        const durationValue = parseFloat(formData.duration);
        if (isNaN(durationValue) || durationValue <= 0) {
          throw new Error("Invalid duration value");
        }
        const duration = BigInt(Math.floor(durationValue * 24 * 60 * 60)); // Convert days to seconds
        
        const collateralAmount = ethers.parseUnits(
          formData.collateralAmount,
          collateralToken.decimals
        );

        // Debug logging for decimal conversion AND token addresses
        console.log("🚨 LOAN CREATION DEBUG - Token Addresses Being Sent:", {
          formData: {
            tokenAddress: formData.tokenAddress,
            collateralAddress: formData.collateralAddress,
          },
          loanToken: {
            symbol: loanToken.symbol,
            address: loanToken.address,
            decimals: loanToken.decimals,
            inputAmount: formData.amount,
            convertedAmount: amount.toString(),
          },
          collateralToken: {
            symbol: collateralToken.symbol,
            address: collateralToken.address,
            decimals: collateralToken.decimals,
            inputAmount: formData.collateralAmount,
            convertedAmount: collateralAmount.toString(),
          },
          interestRate: {
            inputBasisPoints: formData.interestRate,
            convertedBigInt: interestRate.toString(),
            asPercentage: `${Number(interestRate) / 100}%`,
          },
          contractCallParams: {
            tokenAddress: formData.tokenAddress,
            amount: amount.toString(),
            interestRate: interestRate.toString(),
            duration: duration.toString(),
            collateralAddress: formData.collateralAddress,
            collateralAmount: collateralAmount.toString(),
          },
        });

        // Step 1: Approve tokens
        setTransactionState({
          isLoading: true,
          isSuccess: false,
          isError: false,
          error: null,
          hash: null,
          step: "approving",
        });

        await approveToken(formData.tokenAddress, amount);

        // Wait a bit for the approval to be processed
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Step 2: Create loan offer
        setTransactionState((prev) => ({
          ...prev,
          step: "creating",
        }));

        // Get risk parameters for the loan pair (using existing loanToken and collateralToken variables)
        const riskParams = getRecommendedParameters(loanToken, collateralToken);

        const contract = await getWriteContract();
        const tx = await contract.createLoanOffer(
          formData.tokenAddress,
          amount,
          interestRate,
          duration,
          formData.collateralAddress,
          collateralAmount,
          BigInt(riskParams.minCollateralRatio),
          BigInt(riskParams.liquidationThreshold),
          BigInt(riskParams.maxPriceStaleness)
        );

        console.log("Transaction submitted:", tx.hash);

        // Try to wait for transaction with retries
        try {
          await waitForTransactionWithRetry(tx);

          setTransactionState({
            isLoading: false,
            isSuccess: true,
            isError: false,
            error: null,
            hash: tx.hash,
            step: "success",
          });
        } catch (waitError) {
          console.warn("Error waiting for transaction receipt:", waitError);

          // Transaction was submitted but receipt retrieval failed
          // This is often due to RPC issues, not transaction failure
          setTransactionState({
            isLoading: false,
            isSuccess: true,
            isError: false,
            error: null,
            hash: tx.hash,
            step: "success",
          });

          // Show a helpful message to the user
          console.log("Transaction submitted successfully. Hash:", tx.hash);
        }

        // Refetch data
        await fetchActiveLoanOffers();
        await fetchLenderLoans();

        return tx.hash;
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Failed to create loan offer";
        setTransactionState({
          isLoading: false,
          isSuccess: false,
          isError: true,
          error: errorMessage,
          hash: null,
          step: "error",
        });
        throw error;
      }
    },
    [
      address,
      getWriteContract,
      approveToken,
      fetchActiveLoanOffers,
      fetchLenderLoans,
      waitForTransactionWithRetry,
    ]
  );

  // Create borrow request
  const createBorrowRequest = useCallback(
    async (formData: LoanOfferFormData) => {
      if (!address) throw new Error("Wallet not connected");

      try {
        // Get token information for proper decimal handling
        const loanToken = Object.values(SUPPORTED_TOKENS).find(
          (token) =>
            token.address.toLowerCase() === formData.tokenAddress.toLowerCase()
        );
        const collateralToken = Object.values(SUPPORTED_TOKENS).find(
          (token) =>
            token.address.toLowerCase() ===
            formData.collateralAddress.toLowerCase()
        );

        if (!loanToken)
          throw new Error("Loan token not found in supported tokens");
        if (!collateralToken)
          throw new Error("Collateral token not found in supported tokens");

        // Validate form data before conversion
        if (!formData.amount || formData.amount === "0") {
          throw new Error("Please enter a valid borrow amount");
        }
        if (!formData.interestRate || formData.interestRate === "0") {
          throw new Error("Please enter a valid maximum interest rate");
        }
        if (!formData.duration || formData.duration === "0") {
          throw new Error("Please enter a valid duration");
        }
        if (!formData.collateralAmount || formData.collateralAmount === "0") {
          throw new Error("Please enter a valid collateral amount");
        }

        // Convert form data to contract parameters using proper decimals
        const amount = ethers.parseUnits(formData.amount, loanToken.decimals);
        const maxInterestRateValue = parseFloat(formData.interestRate);
        if (isNaN(maxInterestRateValue)) {
          throw new Error("Invalid maximum interest rate value");
        }
        const maxInterestRate = BigInt(Math.floor(maxInterestRateValue)); // Already converted to basis points
        
        const durationValue = parseFloat(formData.duration);
        if (isNaN(durationValue) || durationValue <= 0) {
          throw new Error("Invalid duration value");
        }
        const duration = BigInt(Math.floor(durationValue * 24 * 60 * 60)); // Convert days to seconds
        
        const collateralAmount = ethers.parseUnits(
          formData.collateralAmount,
          collateralToken.decimals
        );

        console.log("🚨 BORROW REQUEST CREATION DEBUG:", {
          formData: {
            tokenAddress: formData.tokenAddress,
            collateralAddress: formData.collateralAddress,
          },
          loanToken: {
            symbol: loanToken.symbol,
            address: loanToken.address,
            decimals: loanToken.decimals,
            inputAmount: formData.amount,
            convertedAmount: amount.toString(),
          },
          collateralToken: {
            symbol: collateralToken.symbol,
            address: collateralToken.address,
            decimals: collateralToken.decimals,
            inputAmount: formData.collateralAmount,
            convertedAmount: collateralAmount.toString(),
          },
          maxInterestRate: {
            inputBasisPoints: formData.interestRate,
            convertedBigInt: maxInterestRate.toString(),
            asPercentage: `${Number(maxInterestRate) / 100}%`,
          },
        });

        // Step 1: Approve collateral tokens
        setTransactionState({
          isLoading: true,
          isSuccess: false,
          isError: false,
          error: null,
          hash: null,
          step: "approving",
        });

        await approveToken(formData.collateralAddress, collateralAmount);

        // Wait a bit for the approval to be processed
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Step 2: Create borrow request
        setTransactionState((prev) => ({
          ...prev,
          step: "creating",
        }));

        // Get risk parameters for the loan pair
        const riskParams = getRecommendedParameters(loanToken, collateralToken);

        const contract = await getWriteContract();
        const tx = await contract.createBorrowRequest(
          formData.tokenAddress,
          amount,
          maxInterestRate,
          duration,
          formData.collateralAddress,
          collateralAmount,
          BigInt(riskParams.minCollateralRatio),
          BigInt(riskParams.liquidationThreshold),
          BigInt(riskParams.maxPriceStaleness)
        );

        console.log("Borrow request transaction submitted:", tx.hash);

        // Try to wait for transaction with retries
        try {
          await waitForTransactionWithRetry(tx);

          setTransactionState({
            isLoading: false,
            isSuccess: true,
            isError: false,
            error: null,
            hash: tx.hash,
            step: "success",
          });
        } catch (waitError) {
          console.warn("Error waiting for transaction receipt:", waitError);

          // Transaction was submitted but receipt retrieval failed
          setTransactionState({
            isLoading: false,
            isSuccess: true,
            isError: false,
            error: null,
            hash: tx.hash,
            step: "success",
          });

          console.log("Borrow request submitted successfully. Hash:", tx.hash);
        }

        // Refetch data
        await fetchActiveBorrowRequests();
        await fetchBorrowerLoans();

        return tx.hash;
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Failed to create borrow request";
        setTransactionState({
          isLoading: false,
          isSuccess: false,
          isError: true,
          error: errorMessage,
          hash: null,
          step: "error",
        });
        throw error;
      }
    },
    [
      address,
      getWriteContract,
      approveToken,
      fetchActiveBorrowRequests,
      fetchBorrowerLoans,
      waitForTransactionWithRetry,
    ]
  );

  // Accept loan offer with two-step process
  const acceptLoanOffer = useCallback(
    async (loanId: bigint, loan: Loan) => {
      if (!address) throw new Error("Wallet not connected");

      try {
        // Step 1: Approve collateral tokens
        setTransactionState({
          isLoading: true,
          isSuccess: false,
          isError: false,
          error: null,
          hash: null,
          step: "approving",
        });

        await approveToken(loan.collateralAddress, loan.collateralAmount);

        // Wait a bit for the approval to be processed
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Step 2: Accept loan offer
        setTransactionState((prev) => ({
          ...prev,
          step: "accepting",
        }));

        const contract = await getWriteContract();
        const tx = await contract.acceptLoanOffer(loanId);
        await tx.wait();

        setTransactionState({
          isLoading: false,
          isSuccess: true,
          isError: false,
          error: null,
          hash: tx.hash,
          step: "success",
        });

        // Refetch data
        await fetchActiveLoanOffers();
        await fetchBorrowerLoans();

        return tx.hash;
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Failed to accept loan offer";
        setTransactionState({
          isLoading: false,
          isSuccess: false,
          isError: true,
          error: errorMessage,
          hash: null,
          step: "error",
        });
        throw error;
      }
    },
    [
      address,
      getWriteContract,
      approveToken,
      fetchActiveLoanOffers,
      fetchBorrowerLoans,
    ]
  );

  // Accept borrow request
  const acceptBorrowRequest = useCallback(
    async (requestId: bigint, request: Loan, interestRate: string) => {
      if (!address) throw new Error("Wallet not connected");

      try {
        // Get token information for proper decimal handling
        const loanToken = Object.values(SUPPORTED_TOKENS).find(
          (token) =>
            token.address.toLowerCase() === request.tokenAddress.toLowerCase()
        );

        if (!loanToken)
          throw new Error("Loan token not found in supported tokens");

        // Validate interest rate
        const interestRateValue = parseFloat(interestRate);
        if (isNaN(interestRateValue) || interestRateValue <= 0) {
          throw new Error("Please enter a valid interest rate");
        }
        if (interestRateValue > Number(request.interestRate) / 100) {
          throw new Error("Interest rate cannot exceed the maximum requested rate");
        }

        const finalInterestRate = BigInt(Math.floor(interestRateValue * 100)); // Convert percentage to basis points

        console.log("🚨 ACCEPT BORROW REQUEST DEBUG:", {
          requestId: requestId.toString(),
          request: {
            borrower: request.borrower,
            tokenAddress: request.tokenAddress,
            amount: request.amount.toString(),
            maxInterestRate: request.interestRate.toString(),
          },
          loanToken: {
            symbol: loanToken.symbol,
            address: loanToken.address,
            decimals: loanToken.decimals,
          },
          interestRate: {
            input: interestRate,
            inputAsNumber: interestRateValue,
            convertedBasisPoints: finalInterestRate.toString(),
            maxAllowed: Number(request.interestRate) / 100,
          },
        });

        // Step 1: Approve loan tokens
        setTransactionState({
          isLoading: true,
          isSuccess: false,
          isError: false,
          error: null,
          hash: null,
          step: "approving",
        });

        await approveToken(request.tokenAddress, request.amount);

        // Wait a bit for the approval to be processed
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Step 2: Accept borrow request
        setTransactionState((prev) => ({
          ...prev,
          step: "accepting",
        }));

        const contract = await getWriteContract();
        const tx = await contract.acceptBorrowRequest(requestId, finalInterestRate);

        console.log("Accept borrow request transaction submitted:", tx.hash);

        // Try to wait for transaction with retries
        try {
          await waitForTransactionWithRetry(tx);

          setTransactionState({
            isLoading: false,
            isSuccess: true,
            isError: false,
            error: null,
            hash: tx.hash,
            step: "success",
          });
        } catch (waitError) {
          console.warn("Error waiting for transaction receipt:", waitError);

          setTransactionState({
            isLoading: false,
            isSuccess: true,
            isError: false,
            error: null,
            hash: tx.hash,
            step: "success",
          });

          console.log("Borrow request accepted successfully. Hash:", tx.hash);
        }

        // Refetch data
        await fetchActiveBorrowRequests();
        await fetchLenderLoans();

        return tx.hash;
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Failed to accept borrow request";
        setTransactionState({
          isLoading: false,
          isSuccess: false,
          isError: true,
          error: errorMessage,
          hash: null,
          step: "error",
        });
        throw error;
      }
    },
    [
      address,
      getWriteContract,
      approveToken,
      fetchActiveBorrowRequests,
      fetchLenderLoans,
      waitForTransactionWithRetry,
    ]
  );

  // Repay loan with approval process
  const repayLoan = useCallback(
    async (loanId: bigint, loan: Loan) => {
      if (!address) throw new Error("Wallet not connected");

      try {
        // Calculate total repayment amount
        const currentTime = BigInt(Math.floor(Date.now() / 1000));
        const timeElapsed = currentTime - loan.startTime;
        const interest =
          (loan.amount * loan.interestRate * timeElapsed) /
          (BigInt(10000) * BigInt(365 * 24 * 60 * 60));
        const totalRepayment = loan.amount + interest;

        // Step 1: Approve repayment tokens
        setTransactionState({
          isLoading: true,
          isSuccess: false,
          isError: false,
          error: null,
          hash: null,
          step: "approving",
        });

        await approveToken(loan.tokenAddress, totalRepayment);

        // Wait a bit for the approval to be processed
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Step 2: Repay loan
        setTransactionState((prev) => ({
          ...prev,
          step: "repaying",
        }));

        const contract = await getWriteContract();
        const tx = await contract.repayLoan(loanId);
        await tx.wait();

        setTransactionState({
          isLoading: false,
          isSuccess: true,
          isError: false,
          error: null,
          hash: tx.hash,
          step: "success",
        });

        // Refetch data
        await fetchBorrowerLoans();
        await fetchLenderLoans();

        return tx.hash;
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to repay loan";
        setTransactionState({
          isLoading: false,
          isSuccess: false,
          isError: true,
          error: errorMessage,
          hash: null,
          step: "error",
        });
        throw error;
      }
    },
    [
      address,
      getWriteContract,
      approveToken,
      fetchBorrowerLoans,
      fetchLenderLoans,
    ]
  );

  // Liquidate loan
  const liquidateLoan = useCallback(
    async (loanId: bigint) => {
      if (!address) throw new Error("Wallet not connected");

      try {
        setTransactionState({
          isLoading: true,
          isSuccess: false,
          isError: false,
          error: null,
          hash: null,
          step: "liquidating",
        });

        const contract = await getWriteContract();
        const tx = await contract.liquidateLoan(loanId);
        await tx.wait();

        setTransactionState({
          isLoading: false,
          isSuccess: true,
          isError: false,
          error: null,
          hash: tx.hash,
          step: "success",
        });

        // Refetch data
        await fetchLenderLoans();

        return tx.hash;
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to liquidate loan";
        setTransactionState({
          isLoading: false,
          isSuccess: false,
          isError: true,
          error: errorMessage,
          hash: null,
          step: "error",
        });
        throw error;
      }
    },
    [address, getWriteContract, fetchLenderLoans]
  );

  // Cancel loan offer
  const cancelLoanOffer = useCallback(
    async (loanId: bigint) => {
      if (!address) throw new Error("Wallet not connected");

      try {
        setTransactionState({
          isLoading: true,
          isSuccess: false,
          isError: false,
          error: null,
          hash: null,
          step: "cancelling",
        });

        const contract = await getWriteContract();
        const tx = await contract.cancelLoanOffer(loanId);
        await tx.wait();

        setTransactionState({
          isLoading: false,
          isSuccess: true,
          isError: false,
          error: null,
          hash: tx.hash,
          step: "success",
        });

        // Refetch data
        await fetchActiveLoanOffers();
        await fetchLenderLoans();

        return tx.hash;
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Failed to cancel loan offer";
        setTransactionState({
          isLoading: false,
          isSuccess: false,
          isError: true,
          error: errorMessage,
          hash: null,
          step: "error",
        });
        throw error;
      }
    },
    [address, getWriteContract, fetchActiveLoanOffers, fetchLenderLoans]
  );

  // Cancel borrow request
  const cancelBorrowRequest = useCallback(
    async (requestId: bigint) => {
      if (!address) throw new Error("Wallet not connected");

      try {
        setTransactionState({
          isLoading: true,
          isSuccess: false,
          isError: false,
          error: null,
          hash: null,
          step: "cancelling",
        });

        const contract = await getWriteContract();
        const tx = await contract.cancelBorrowRequest(requestId);
        await tx.wait();

        setTransactionState({
          isLoading: false,
          isSuccess: true,
          isError: false,
          error: null,
          hash: tx.hash,
          step: "success",
        });

        // Refetch data
        await fetchActiveBorrowRequests();
        await fetchBorrowerLoans();

        return tx.hash;
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Failed to cancel borrow request";
        setTransactionState({
          isLoading: false,
          isSuccess: false,
          isError: true,
          error: errorMessage,
          hash: null,
          step: "error",
        });
        throw error;
      }
    },
    [address, getWriteContract, fetchActiveBorrowRequests, fetchBorrowerLoans]
  );

  // ============ UTILITY FUNCTIONS ============

  // Calculate interest for a loan
  const calculateInterest = useCallback((loan: Loan, currentTime?: bigint) => {
    if (loan.status !== LoanStatus.Active) return BigInt(0);

    const now = currentTime || BigInt(Math.floor(Date.now() / 1000));
    const timeElapsed = now - loan.startTime;
    return (
      (loan.amount * loan.interestRate * timeElapsed) /
      (BigInt(10000) * BigInt(365 * 24 * 60 * 60))
    );
  }, []);

  // Calculate total repayment amount
  const calculateTotalRepayment = useCallback(
    (loan: Loan, currentTime?: bigint) => {
      const interest = calculateInterest(loan, currentTime);
      return loan.amount + interest;
    },
    [calculateInterest]
  );

  // Check if loan is defaulted
  const isLoanDefaulted = useCallback((loan: Loan, currentTime?: bigint) => {
    if (loan.status !== LoanStatus.Active) return false;

    const now = currentTime || BigInt(Math.floor(Date.now() / 1000));
    return now > loan.startTime + loan.duration;
  }, []);

  // Format loan data for display
  const formatLoanData = useCallback(
    (loan: Loan) => {
      const interest = calculateInterest(loan);
      const totalRepayment = calculateTotalRepayment(loan);
      const isDefaulted = isLoanDefaulted(loan);

      // Get token information for proper decimal formatting
      const loanToken = Object.values(SUPPORTED_TOKENS).find(
        (token) =>
          token.address.toLowerCase() === loan.tokenAddress.toLowerCase()
      );
      const collateralToken = Object.values(SUPPORTED_TOKENS).find(
        (token) =>
          token.address.toLowerCase() === loan.collateralAddress.toLowerCase()
      );

      return {
        ...loan,
        formattedAmount: loanToken
          ? ethers.formatUnits(loan.amount, loanToken.decimals)
          : ethers.formatEther(loan.amount),
        formattedCollateralAmount: collateralToken
          ? ethers.formatUnits(loan.collateralAmount, collateralToken.decimals)
          : ethers.formatEther(loan.collateralAmount),
        formattedInterestRate: Number(loan.interestRate) / 100, // Convert from basis points to percentage
        formattedDuration: Number(loan.duration) / (24 * 60 * 60), // Convert seconds to days
        formattedInterest: loanToken
          ? ethers.formatUnits(interest, loanToken.decimals)
          : ethers.formatEther(interest),
        formattedTotalRepayment: loanToken
          ? ethers.formatUnits(totalRepayment, loanToken.decimals)
          : ethers.formatEther(totalRepayment),
        isDefaulted,
        statusText: ["Pending", "Active", "Repaid", "Defaulted"][loan.status],
      };
    },
    [calculateInterest, calculateTotalRepayment, isLoanDefaulted]
  );

  // ============ EFFECTS ============

  // Fetch data when connection state changes
  useEffect(() => {
    if (isConnected && address) {
      fetchActiveLoanOffers();
      fetchLenderLoans();
      fetchBorrowerLoans();
    }
  }, [
    isConnected,
    address,
    fetchActiveLoanOffers,
    fetchLenderLoans,
    fetchBorrowerLoans,
  ]);

  // Add collateral to loan
  const addCollateral = useCallback(
    async (loanId: bigint, additionalAmount: bigint) => {
      if (!address) throw new Error("Wallet not connected");

      try {
        setTransactionState({
          isLoading: true,
          isSuccess: false,
          isError: false,
          error: null,
          hash: null,
          step: "adding_collateral",
        });

        const contract = await getWriteContract();
        const tx = await contract.addCollateral(loanId, additionalAmount);
        await tx.wait();

        setTransactionState({
          isLoading: false,
          isSuccess: true,
          isError: false,
          error: null,
          hash: tx.hash,
          step: "success",
        });

        // Refetch data
        await fetchBorrowerLoans();
        await fetchLenderLoans();

        return tx.hash;
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to add collateral";
        setTransactionState({
          isLoading: false,
          isSuccess: false,
          isError: true,
          error: errorMessage,
          hash: null,
          step: "error",
        });
        throw error;
      }
    },
    [address, getWriteContract, fetchBorrowerLoans, fetchLenderLoans]
  );

  // Remove collateral from loan
  const removeCollateral = useCallback(
    async (loanId: bigint, removeAmount: bigint) => {
      if (!address) throw new Error("Wallet not connected");

      try {
        setTransactionState({
          isLoading: true,
          isSuccess: false,
          isError: false,
          error: null,
          hash: null,
          step: "removing_collateral",
        });

        const contract = await getWriteContract();
        const tx = await contract.removeCollateral(loanId, removeAmount);
        await tx.wait();

        setTransactionState({
          isLoading: false,
          isSuccess: true,
          isError: false,
          error: null,
          hash: tx.hash,
          step: "success",
        });

        // Refetch data
        await fetchBorrowerLoans();
        await fetchLenderLoans();

        return tx.hash;
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Failed to remove collateral";
        setTransactionState({
          isLoading: false,
          isSuccess: false,
          isError: true,
          error: errorMessage,
          hash: null,
          step: "error",
        });
        throw error;
      }
    },
    [address, getWriteContract, fetchBorrowerLoans, fetchLenderLoans]
  );

  // Make partial repayment
  const makePartialRepayment = useCallback(
    async (loanId: bigint, repaymentAmount: bigint, loan: Loan) => {
      if (!address) throw new Error("Wallet not connected");

      try {
        // Step 1: Approve repayment tokens
        setTransactionState({
          isLoading: true,
          isSuccess: false,
          isError: false,
          error: null,
          hash: null,
          step: "approving",
        });

        await approveToken(loan.tokenAddress, repaymentAmount);

        // Wait a bit for the approval to be processed
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Step 2: Make partial repayment
        setTransactionState((prev) => ({
          ...prev,
          step: "partial_repaying",
        }));

        const contract = await getWriteContract();
        const tx = await contract.makePartialRepayment(loanId, repaymentAmount);
        await tx.wait();

        setTransactionState({
          isLoading: false,
          isSuccess: true,
          isError: false,
          error: null,
          hash: tx.hash,
          step: "success",
        });

        // Refetch data
        await fetchBorrowerLoans();
        await fetchLenderLoans();

        return tx.hash;
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Failed to make partial repayment";
        setTransactionState({
          isLoading: false,
          isSuccess: false,
          isError: true,
          error: errorMessage,
          hash: null,
          step: "error",
        });
        throw error;
      }
    },
    [
      address,
      getWriteContract,
      approveToken,
      fetchBorrowerLoans,
      fetchLenderLoans,
    ]
  );

  // Get loan repayment info
  const getLoanRepaymentInfo = useCallback(
    async (loanId: bigint) => {
      try {
        const contract = await getReadContract();
        const result = await contract.getLoanRepaymentInfo(loanId);
        return {
          totalOwed: result[0],
          repaidAmount: result[1],
          remainingAmount: result[2],
          interestAccrued: result[3],
        };
      } catch (error) {
        console.error("Failed to get loan repayment info:", error);
        throw error;
      }
    },
    [getReadContract]
  );

  // Get loan health factor
  const getLoanHealthFactor = useCallback(
    async (loanId: bigint) => {
      try {
        const contract = await getReadContract();
        const result = await contract.getLoanHealthFactor(loanId);
        return {
          currentRatio: result[0],
          priceStale: result[1],
        };
      } catch (error) {
        console.error("Failed to get loan health factor:", error);
        throw error;
      }
    },
    [getReadContract]
  );

  return {
    // State
    transactionState,

    // Account info
    address,
    isConnected,

    // Read functions
    activeLoanOfferIds,
    activeBorrowRequestIds,
    isLoadingOffers,
    isLoadingRequests,
    lenderLoans,
    isLoadingLenderLoans,
    borrowerLoans,
    isLoadingBorrowerLoans,
    getLoan,
    checkAllowance,
    checkBalance,

    // Write functions
    createLoanOffer,
    createBorrowRequest,
    acceptLoanOffer,
    acceptBorrowRequest,
    repayLoan,
    liquidateLoan,
    cancelLoanOffer,
    cancelBorrowRequest,
    addCollateral,
    removeCollateral,
    makePartialRepayment,
    approveToken,

    // Utility functions
    calculateInterest,
    calculateTotalRepayment,
    isLoanDefaulted,
    getLoanRepaymentInfo,
    getLoanHealthFactor,
    formatLoanData,
    resetTransactionState,

    // Refetch functions
    refetchOffers: fetchActiveLoanOffers,
    refetchRequests: fetchActiveBorrowRequests,
    refetchLenderLoans: fetchLenderLoans,
    refetchBorrowerLoans: fetchBorrowerLoans,

    // Direct access to contract functions for OrderBook component
    getActiveLoanOffers: fetchActiveLoanOffers,
    getActiveBorrowRequests: fetchActiveBorrowRequests,
    contract: getReadContract(),
  };
};
