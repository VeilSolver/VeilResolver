// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IDEXRouter {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}

// ─── VeilSolver: Private Intent Settlement Contract ───────────────────────────
//
// Generalised action executor — not just swaps.
// Supports: SWAP | TRANSFER | ARBITRARY_CALL
//
// Every action: encrypted intent → TEE computes plan → ECDSA signed → verified here

contract VeilSolver {

    // ─── Action types ─────────────────────────────────────────────────────────
    enum ActionType { SWAP, TRANSFER, ARBITRARY_CALL }

    // ─── State ────────────────────────────────────────────────────────────────
    address public owner;
    address public solverKey;
    address public dexRouter;
    address public feeRecipient;

    uint256 public feeBps = 10;
    uint256 public constant MAX_FEE_BPS = 100;

    mapping(bytes32 => bool) public executedIntents;

    // ─── Action Plan ──────────────────────────────────────────────────────────
    // All action types share this struct. Unused fields are zero.
    struct ActionPlan {
        ActionType actionType;
        // SWAP fields
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 minAmountOut;
        address[] route;
        // TRANSFER fields
        address recipient;
        // ARBITRARY_CALL fields
        address target;
        bytes   callData;
        uint256 ethValue;
        // common
        uint256 deadline;
        bytes32 intentHash;
        bytes   signature;
    }

    // ─── Events ───────────────────────────────────────────────────────────────
    event IntentExecuted(
        bytes32 indexed intentHash,
        address indexed user,
        ActionType actionType,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        address recipient,
        string  attestationChatID,
        string  auditRootHash
    );

    event SolverKeyUpdated(address oldKey, address newKey);
    event FeeUpdated(uint256 oldBps, uint256 newBps);

    // ─── Constructor ──────────────────────────────────────────────────────────
    constructor(address _solverKey, address _dexRouter, address _feeRecipient) {
        owner        = msg.sender;
        solverKey    = _solverKey;
        dexRouter    = _dexRouter;
        feeRecipient = _feeRecipient;
    }

    // ─── Core: execute a TEE-attested action plan ─────────────────────────────
    function executeAction(
        ActionPlan calldata plan,
        address user,
        string calldata attestationChatID,
        string calldata auditRootHash
    ) external payable {
        // 1. Deadline
        require(block.timestamp <= plan.deadline, "VeilSolver: intent expired");

        // 2. Replay protection
        require(!executedIntents[plan.intentHash], "VeilSolver: intent already executed");

        // 3. Verify solver signature
        bytes32 planHash  = _getPlanHash(plan);
        address recovered = _recoverSigner(planHash, plan.signature);
        require(recovered == solverKey, "VeilSolver: invalid solver signature");

        // 4. Mark executed BEFORE external calls (CEI pattern)
        executedIntents[plan.intentHash] = true;

        uint256 amountOut;

        if (plan.actionType == ActionType.SWAP) {
            amountOut = _executeSwap(plan, user);
        } else if (plan.actionType == ActionType.TRANSFER) {
            amountOut = _executeTransfer(plan, user);
        } else if (plan.actionType == ActionType.ARBITRARY_CALL) {
            amountOut = _executeArbitraryCall(plan, user);
        } else {
            revert("VeilSolver: unknown action type");
        }

        emit IntentExecuted(
            plan.intentHash, user,
            plan.actionType,
            plan.tokenIn, plan.tokenOut,
            plan.amountIn, amountOut,
            plan.recipient,
            attestationChatID, auditRootHash
        );
    }

    // ─── SWAP ─────────────────────────────────────────────────────────────────
    function _executeSwap(ActionPlan calldata plan, address user) internal returns (uint256) {
        uint256 fee           = (plan.amountIn * feeBps) / 10_000;
        uint256 amountForSwap = plan.amountIn - fee;

        require(
            IERC20(plan.tokenIn).transferFrom(user, address(this), plan.amountIn),
            "VeilSolver: token transfer failed"
        );
        if (fee > 0) IERC20(plan.tokenIn).transfer(feeRecipient, fee);

        IERC20(plan.tokenIn).approve(dexRouter, amountForSwap);

        uint256[] memory amounts = IDEXRouter(dexRouter).swapExactTokensForTokens(
            amountForSwap,
            plan.minAmountOut,
            plan.route,
            user,
            plan.deadline
        );
        return amounts[amounts.length - 1];
    }

    // ─── TRANSFER ─────────────────────────────────────────────────────────────
    // ERC20: pull from user → fee → send remainder to recipient
    // ETH:   msg.value → fee → send remainder to recipient
    function _executeTransfer(ActionPlan calldata plan, address user) internal returns (uint256) {
        require(plan.recipient != address(0), "VeilSolver: zero recipient");

        if (plan.tokenIn != address(0)) {
            // ERC20 transfer
            uint256 fee    = (plan.amountIn * feeBps) / 10_000;
            uint256 netAmt = plan.amountIn - fee;

            require(
                IERC20(plan.tokenIn).transferFrom(user, address(this), plan.amountIn),
                "VeilSolver: token transfer failed"
            );
            if (fee > 0) IERC20(plan.tokenIn).transfer(feeRecipient, fee);
            IERC20(plan.tokenIn).transfer(plan.recipient, netAmt);
            return netAmt;
        } else {
            // Native ETH transfer
            require(msg.value == plan.amountIn, "VeilSolver: ETH amount mismatch");
            uint256 fee    = (plan.amountIn * feeBps) / 10_000;
            uint256 netAmt = plan.amountIn - fee;

            if (fee > 0) { (bool f,) = payable(feeRecipient).call{value: fee}(""); require(f); }
            (bool s,) = payable(plan.recipient).call{value: netAmt}(""); require(s);
            return netAmt;
        }
    }

    // ─── ARBITRARY_CALL ───────────────────────────────────────────────────────
    // Pull optional ERC20 from user → forward approved amount + calldata to target
    // If tokenIn is zero: pure ETH call (msg.value forwarded)
    function _executeArbitraryCall(ActionPlan calldata plan, address user) internal returns (uint256) {
        require(plan.target != address(0), "VeilSolver: zero target");

        if (plan.tokenIn != address(0) && plan.amountIn > 0) {
            uint256 fee    = (plan.amountIn * feeBps) / 10_000;
            uint256 netAmt = plan.amountIn - fee;

            require(
                IERC20(plan.tokenIn).transferFrom(user, address(this), plan.amountIn),
                "VeilSolver: token transfer failed"
            );
            if (fee > 0) IERC20(plan.tokenIn).transfer(feeRecipient, fee);
            IERC20(plan.tokenIn).approve(plan.target, netAmt);
        }

        (bool success, ) = plan.target.call{value: plan.ethValue}(plan.callData);
        require(success, "VeilSolver: arbitrary call failed");
        return 0;
    }

    // ─── Plan hash — MUST match signer.ts exactly ────────────────────────────
    function getPlanHash(ActionPlan calldata plan) external pure returns (bytes32) {
        return _getPlanHash(plan);
    }

    function _getPlanHash(ActionPlan calldata plan) internal pure returns (bytes32) {
        return keccak256(abi.encode(
            uint8(plan.actionType),
            plan.tokenIn,
            plan.tokenOut,
            plan.amountIn,
            plan.minAmountOut,
            plan.recipient,
            plan.target,
            keccak256(plan.callData),
            plan.ethValue,
            plan.deadline,
            plan.intentHash
        ));
    }

    function _recoverSigner(bytes32 hash, bytes memory sig) internal pure returns (address) {
        bytes32 ethHash = keccak256(abi.encodePacked(
            "\x19Ethereum Signed Message:\n32", hash
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

    // ─── Admin ────────────────────────────────────────────────────────────────
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

    receive() external payable {}

    modifier onlyOwner() {
        require(msg.sender == owner, "VeilSolver: not owner");
        _;
    }
}
