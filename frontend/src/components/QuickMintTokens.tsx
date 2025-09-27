"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Coins, AlertCircle } from "lucide-react";

interface QuickMintTokensProps {
  className?: string;
}

/**
 * QuickMintTokens Component - Disabled for 0G Chain Production
 * Mock token minting is not available on 0G Chain mainnet
 */
export function QuickMintTokens({ className }: QuickMintTokensProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg flex items-center">
          <Coins className="h-5 w-5 text-muted-foreground mr-2" />
          Token Faucet
        </CardTitle>
        <CardDescription>
          Get test tokens for lending and borrowing
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Token faucet is not available on 0G Chain mainnet. Please use real
            tokens from exchanges or bridges.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
