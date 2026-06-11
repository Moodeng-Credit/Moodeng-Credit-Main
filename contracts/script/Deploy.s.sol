// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script, console2} from "forge-std/Script.sol";

import {LoanManager} from "../src/LoanManager.sol";

/**
 * @notice Deploys LoanManager.
 *
 * Required env vars:
 *   USDC_ADDRESS   - USDC token on the target network (Base mainnet: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)
 *   ADMIN_ADDRESS  - receives DEFAULT_ADMIN_ROLE + ADMIN_ROLE + ORIGINATOR_ROLE (Moodeng funding wallet)
 *
 * Example (Base):
 *   forge script script/Deploy.s.sol:Deploy \
 *     --rpc-url "$BASE_RPC_URL" --broadcast --verify \
 *     --private-key "$DEPLOYER_PRIVATE_KEY"
 *
 * This script reads keys from your environment only at run time — no secrets are committed.
 */
contract Deploy is Script {
    function run() external returns (LoanManager manager) {
        address usdc = vm.envAddress("USDC_ADDRESS");
        address admin = vm.envAddress("ADMIN_ADDRESS");

        vm.startBroadcast();
        manager = new LoanManager(usdc, admin);
        vm.stopBroadcast();

        console2.log("LoanManager deployed at:", address(manager));
        console2.log("USDC:", usdc);
        console2.log("Admin/Originator:", admin);
    }
}
