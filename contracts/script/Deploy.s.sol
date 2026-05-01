// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/VeilSolver.sol";
import "../src/MockERC20.sol";
import "../src/MockDEXRouter.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerKey  = vm.envUint("SOLVER_PRIVATE_KEY");
        address solverAddr   = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        // 1. Mock tokens
        MockERC20 usdc = new MockERC20("USD Coin",  "USDC", 6);
        MockERC20 weth = new MockERC20("Wrapped ETH", "WETH", 18);

        // 2. Mock DEX router
        MockDEXRouter dex = new MockDEXRouter();

        // 3. Mint test tokens to deployer for demo
        usdc.mint(solverAddr, 10_000 * 1e6);   // 10,000 USDC
        weth.mint(solverAddr, 10 * 1e18);       // 10 WETH

        // 4. VeilSolver contract
        //    solverKey = deployer address (same wallet signs plans for MVP)
        VeilSolver solver = new VeilSolver(
            solverAddr,        // solverKey
            address(dex),      // dexRouter
            solverAddr         // feeRecipient
        );

        vm.stopBroadcast();

        console.log("=== VeilSolver Deployment ===");
        console.log("VeilSolver:     ", address(solver));
        console.log("MockDEXRouter:  ", address(dex));
        console.log("USDC (tokenIn): ", address(usdc));
        console.log("WETH (tokenOut):", address(weth));
        console.log("Solver/Owner:   ", solverAddr);
        console.log("");
        console.log("Add to solver-api/.env:");
        console.log("CONTRACT_ADDRESS=", address(solver));
        console.log("TOKEN_IN=",  address(usdc));
        console.log("TOKEN_OUT=", address(weth));
    }
}
