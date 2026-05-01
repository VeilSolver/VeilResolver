// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

// Uniswap V2-compatible router (the fork deployed on 0G Chain)
// Replace with V3 quoter if 0G's fork is V3
interface IDEXRouter {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}

// ─── VeilSolver Settlement Contract ──────────────────────────────────────────
//
// What this contract does:
//   1. Holds the registered solver key (set at deploy, updatable by owner)
//   2. Verifies that an execution plan was signed by that solver key
//   3. Executes the swap atomically on the 0G DEX
//   4. Collects a small fee per solve
//   5. Emits an event with the attestation chatID so anyone can verify TEE proof
//
// MEV protection: by the time this tx is onchain, execution is final.
// The intent was never visible — it stayed encrypted until this moment.

contract VeilSolver {

    // ─── State ────────────────────────────────────────────────────────────────

    address public owner;
    address public solverKey;       // registered at deploy — signs execution plans
    address public dexRouter;       // 0G Chain DEX router address
    address public feeRecipient;

    uint256 public feeBps = 10;     // 0.1% per solve — adjustable by owner
    uint256 public constant MAX_FEE_BPS = 100; // 1% hard cap

    // Replay protection: once an intent is executed, it can never be re-used
    mapping(bytes32 => bool) public executedIntents;

    // ─── Events ───────────────────────────────────────────────────────────────

    // Emitted on every successful solve
    // attestationChatID links to the 0G Compute TEE proof for this execution
    event IntentExecuted(
        bytes32 indexed intentHash,
        address indexed user,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        string  attestationChatID,  // ZG-Res-Key — verifiable TEE proof
        string  auditRootHash       // 0G Storage retrieval key
    );

    event SolverKeyUpdated(address oldKey, address newKey);
    event FeeUpdated(uint256 oldBps, uint256 newBps);

    // ─── Execution Plan struct ────────────────────────────────────────────────
    // This is what the TEE-signed plan looks like onchain

    struct ExecutionPlan {
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 minAmountOut;
        address[] route;        // pool path e.g. [USDC, WETH]
        uint256 deadline;
        bytes32 intentHash;     // keccak256 of original (encrypted) intent
        bytes   signature;      // ECDSA by solverKey over plan hash
    }

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(
        address _solverKey,
        address _dexRouter,
        address _feeRecipient
    ) {
        owner        = msg.sender;
        solverKey    = _solverKey;
        dexRouter    = _dexRouter;
        feeRecipient = _feeRecipient;
    }

    // ─── Core: execute a TEE-attested plan ───────────────────────────────────
    //
    // Called by the user (or a relayer) after getting a signed plan from the solver.
    // The solver ran inside a TEE — attestationChatID is the proof link.

    function executePlan(
        ExecutionPlan calldata plan,
        address user,
        string calldata attestationChatID,
        string calldata auditRootHash
    ) external {

        // 1. Check deadline
        require(block.timestamp <= plan.deadline, "VeilSolver: intent expired");

        // 2. Replay protection
        require(!executedIntents[plan.intentHash], "VeilSolver: intent already executed");

        // 3. Verify solver signature over the plan hash
        //    If the signature is wrong, this means the plan didn't come from
        //    the registered TEE-backed solver — revert.
        bytes32 planHash = _getPlanHash(plan);
        address recovered = _recoverSigner(planHash, plan.signature);
        require(recovered == solverKey, "VeilSolver: invalid solver signature");

        // 4. Mark executed BEFORE external calls (reentrancy protection)
        executedIntents[plan.intentHash] = true;

        // 5. Calculate fee
        uint256 fee           = (plan.amountIn * feeBps) / 10_000;
        uint256 amountForSwap = plan.amountIn - fee;

        // 6. Pull tokens from user
        require(
            IERC20(plan.tokenIn).transferFrom(user, address(this), plan.amountIn),
            "VeilSolver: token transfer failed"
        );

        // 7. Send fee to recipient
        if (fee > 0) {
            IERC20(plan.tokenIn).transfer(feeRecipient, fee);
        }

        // 8. Approve DEX and execute swap
        IERC20(plan.tokenIn).approve(dexRouter, amountForSwap);

        uint256[] memory amounts = IDEXRouter(dexRouter).swapExactTokensForTokens(
            amountForSwap,
            plan.minAmountOut,
            plan.route,
            user,
            plan.deadline
        );

        uint256 amountOut = amounts[amounts.length - 1];

        // 9. Emit — attestationChatID is the public TEE proof link
        emit IntentExecuted(
            plan.intentHash,
            user,
            plan.tokenIn,
            plan.tokenOut,
            plan.amountIn,
            amountOut,
            attestationChatID,
            auditRootHash
        );
    }

    // ─── View: compute plan hash (same formula as solver-api/signer.ts) ──────

    function getPlanHash(ExecutionPlan calldata plan) external pure returns (bytes32) {
        return _getPlanHash(plan);
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    // Update solver key when enclave restarts (new attestation cycle)
    function updateSolverKey(address newKey) external onlyOwner {
        require(newKey != address(0), "VeilSolver: zero address");
        emit SolverKeyUpdated(solverKey, newKey);
        solverKey = newKey;
    }

    function updateFee(uint256 newBps) external onlyOwner {
        require(newBps <= MAX_FEE_BPS, "VeilSolver: fee too high");
        emit FeeUpdated(feeBps, newBps);
        feeBps = newBps;
    }

    function updateFeeRecipient(address newRecipient) external onlyOwner {
        require(newRecipient != address(0), "VeilSolver: zero address");
        feeRecipient = newRecipient;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "VeilSolver: zero address");
        owner = newOwner;
    }

    // ─── Internal helpers ────────────────────────────────────────────────────

    function _getPlanHash(ExecutionPlan calldata plan) internal pure returns (bytes32) {
        return keccak256(abi.encode(
            plan.tokenIn,
            plan.tokenOut,
            plan.amountIn,
            plan.minAmountOut,
            plan.deadline,
            plan.intentHash
        ));
    }

    function _recoverSigner(bytes32 hash, bytes memory sig) internal pure returns (address) {
        // Add Ethereum signed message prefix — matches ethers.wallet.signMessage()
        bytes32 ethHash = keccak256(abi.encodePacked(
            "\x19Ethereum Signed Message:\n32",
            hash
        ));
        (bytes32 r, bytes32 s, uint8 v) = _splitSig(sig);
        return ecrecover(ethHash, v, r, s);
    }

    function _splitSig(bytes memory sig) internal pure returns (bytes32 r, bytes32 s, uint8 v) {
        require(sig.length == 65, "VeilSolver: invalid signature length");
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "VeilSolver: not owner");
        _;
    }
}
