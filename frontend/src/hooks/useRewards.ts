"use client";

import { useState, useEffect, useCallback } from "react";
import { Eip1193Provider, ethers } from "ethers";
import { useAppKitAccount, useAppKitProvider } from "@reown/appkit/react";
import { toast } from "sonner";

// Rewards system disabled for 0G Chain deployment
// This hook returns disabled state for all rewards functionality

export interface RewardInfo {
  activePrincipal: bigint;
  pendingRewards: bigint;
  lastUpdate: bigint;
}

export interface GlobalRewardStats {
  totalPrincipal: bigint;
  currentAPR: bigint;
  totalDistributed: bigint;
  contractBalance: bigint;
}

export function useRewards() {
  // Rewards system is disabled for 0G Chain deployment
  // Return default/disabled state for all rewards functionality

  return {
    // State
    isClaimingRewards: false,
    dreamBalance: 0n,
    pendingRewards: 0n,
    currentRewardsAPR: 0n,
    rewardInfo: null as RewardInfo | null,
    globalRewardStats: null as GlobalRewardStats | null,
    lastClaimTime: null as Date | null,

    // Computed
    rewardsSystemAvailable: false,
    canClaimRewards: false,
    hasActiveRewards: false,
    rewardsPaused: true,
    userRewardInfo: null as RewardInfo | null,

    // Functions
    claimRewards: async () => {
      console.log("Rewards system disabled for 0G Chain");
      return false;
    },
    refreshRewards: async () => {
      console.log("Rewards system disabled for 0G Chain");
    },

    // Formatters
    formatDreamAmount: (amount: bigint) => "0.0000",
    formatAPR: (apr: bigint) => "0.00",

    // Loading states
    isLoading: false,
    error: null as string | null,
  };
}
