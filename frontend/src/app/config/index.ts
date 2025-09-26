import { EthersAdapter } from "@reown/appkit-adapter-ethers";
import type { AppKitNetwork } from "@reown/appkit/networks";
import { zero_g } from "@/lib/contracts";

// Get projectId from https://cloud.reown.com
export const projectId =
  process.env.NEXT_PUBLIC_PROJECT_ID || "b56e18d47c72ab683b10814fe9495694"; // this is a public projectId only to use on localhost

if (!projectId) {
  throw new Error("Project ID is not defined");
}

// Define zerog Testnet for AppKit
const zeroG: AppKitNetwork = {
  id: zero_g.id,
  name: zero_g.name,
  nativeCurrency: zero_g.nativeCurrency,
  rpcUrls: zero_g.rpcUrls,
  blockExplorers: zero_g.blockExplorers,
  testnet: zero_g.testnet,
};

export const networks = [zeroG] as [AppKitNetwork, ...AppKitNetwork[]];

export const ethersAdapter = new EthersAdapter();
