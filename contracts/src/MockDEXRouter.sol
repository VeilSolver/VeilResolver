// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IMintableERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function mint(address to, uint256 amount) external;
}

// Mock Uniswap V2-compatible router for testnet demos.
// Takes tokenIn, mints amountOutMin of tokenOut directly to recipient.
// Replace with a real DEX router on mainnet.
contract MockDEXRouter {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts) {
        require(block.timestamp <= deadline, "MockDEX: expired");
        require(path.length >= 2, "MockDEX: invalid path");

        // Pull tokenIn from caller (VeilSolver contract)
        IMintableERC20(path[0]).transferFrom(msg.sender, address(this), amountIn);

        // Mint tokenOut to recipient — simulates swap at declared minAmountOut
        IMintableERC20(path[path.length - 1]).mint(to, amountOutMin);

        amounts = new uint256[](2);
        amounts[0] = amountIn;
        amounts[1] = amountOutMin;
    }
}
