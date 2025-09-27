// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "forge-std/Script.sol";
import "../src/NeuroLend.sol";
import "../src/ZeroGConfig.sol";

/**
 * @title Deploy0G
 * @dev Deployment script for neurolend protocol on 0G Chain
 */
contract Deploy0G is Script {
    // Deployment addresses will be stored here
    neurolend public neurolendContract;

    function run() external {
        // Get deployer from msg.sender (when using --sender flag)
        address deployer = msg.sender;

        console.log("Deploying neurolend Protocol on 0G Chain...");
        console.log("Deployer address:", deployer);
        console.log("Pyth Contract Address:", ZeroGConfig.PYTH_CONTRACT);

        vm.startBroadcast(deployer);

        // Deploy neurolend main contract
        console.log("\n=== Deploying neurolend Contract ===");
        neurolendContract = new neurolend();
        console.log("neurolend deployed at:", address(neurolendContract));

        // Display supported tokens information
        console.log("\n=== Supported Tokens Configuration ===");
        console.log(
            "The following tokens are supported with Pyth price feeds:"
        );
        console.log("- 0G Token (0G):", ZeroGConfig.ZG_TOKEN);
        console.log("- Wrapped Ethereum (WETH):", ZeroGConfig.WETH_TOKEN);
        console.log("- Wrapped Staked ETH (wstETH):", ZeroGConfig.WSTETH_TOKEN);
        console.log("- USD Coin (USDC):", ZeroGConfig.USDC_TOKEN);

        console.log("\n=== Price Feed IDs ===");
        console.log(
            "- 0G/USD Price Feed:",
            vm.toString(ZeroGConfig.ZG_USD_PRICE_FEED)
        );
        console.log(
            "- WETH/USD Price Feed:",
            vm.toString(ZeroGConfig.WETH_USD_PRICE_FEED)
        );
        console.log(
            "- wstETH/USD Price Feed:",
            vm.toString(ZeroGConfig.WSTETH_USD_PRICE_FEED)
        );
        console.log(
            "- USDC/USD Price Feed:",
            vm.toString(ZeroGConfig.USDC_USD_PRICE_FEED)
        );

        vm.stopBroadcast();

        // Display deployment summary
        console.log("\n=== Deployment Summary ===");
        console.log("Network: 0G Chain Mainnet");
        console.log("Deployer:", deployer);
        console.log("");
        console.log("Core Contract:");
        console.log("- neurolend:", address(neurolendContract));
        console.log("");
        console.log("Configuration:");
        console.log("- Pyth Contract:", ZeroGConfig.PYTH_CONTRACT);
        console.log("- Supported Tokens: 4 (0G, WETH, wstETH, USDC)");

        // Save deployment addresses to file
        _saveDeploymentAddresses();
    }

    function _saveDeploymentAddresses() internal {
        string memory deploymentInfo = string.concat(
            "# neurolend Protocol - 0G Chain Mainnet Deployment\n",
            "# Deployed at: ",
            vm.toString(block.timestamp),
            "\n",
            "# Block: ",
            vm.toString(block.number),
            "\n\n",
            "# Core Contract\n",
            "neurolend_ADDRESS=",
            vm.toString(address(neurolendContract)),
            "\n\n",
            "# Configuration\n",
            "PYTH_CONTRACT_ADDRESS=",
            vm.toString(ZeroGConfig.PYTH_CONTRACT),
            "\n\n",
            "# Supported Token Addresses on 0G Chain\n",
            "ZG_TOKEN_ADDRESS=",
            vm.toString(ZeroGConfig.ZG_TOKEN),
            "\n",
            "WETH_TOKEN_ADDRESS=",
            vm.toString(ZeroGConfig.WETH_TOKEN),
            "\n",
            "WSTETH_TOKEN_ADDRESS=",
            vm.toString(ZeroGConfig.WSTETH_TOKEN),
            "\n",
            "USDC_TOKEN_ADDRESS=",
            vm.toString(ZeroGConfig.USDC_TOKEN),
            "\n\n",
            "# Pyth Price Feed IDs\n",
            "ZG_USD_PRICE_FEED=",
            vm.toString(ZeroGConfig.ZG_USD_PRICE_FEED),
            "\n",
            "WETH_USD_PRICE_FEED=",
            vm.toString(ZeroGConfig.WETH_USD_PRICE_FEED),
            "\n",
            "WSTETH_USD_PRICE_FEED=",
            vm.toString(ZeroGConfig.WSTETH_USD_PRICE_FEED),
            "\n",
            "USDC_USD_PRICE_FEED=",
            vm.toString(ZeroGConfig.USDC_USD_PRICE_FEED),
            "\n"
        );

        vm.writeFile("./deployment-0g.env", deploymentInfo);
        console.log("\nDeployment addresses saved to deployment-0g.env");
    }
}
