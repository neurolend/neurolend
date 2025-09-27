// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {neurolend} from "../src/neurolend.sol";

/**
 * @title neurolend Deployment Script
 * @dev Deployment script for neurolend protocol on Somnia L1 testnet
 * @notice Run with: forge script script/Deploy.s.sol --rpc-url <SOMNIA_L1_TESTNET_RPC> --private-key <PRIVATE_KEY> --broadcast
 */
contract neurolendScript is Script {
    neurolend public neurolend;

    function setUp() public {}

    function run() public {
        // Start broadcasting transactions
        vm.startBroadcast();

        console.log("Deploying neurolend to Somnia L1 testnet...");
        console.log("Deployer address:", msg.sender);

        // Deploy neurolend contract
        neurolend = new neurolend();

        console.log("neurolend deployed to:", address(neurolend));
        console.log("Deployment successful!");

        // Stop broadcasting transactions
        vm.stopBroadcast();
    }

    /**
     * @notice Verify deployment by checking contract address
     */
    function verifyDeployment() public view {
        require(address(neurolend) != address(0), "neurolend not deployed");
        console.log("neurolend contract verified at:", address(neurolend));
    }
}
