import { ethers } from "ethers"
import type { SolveResponse } from "./types"
import { ACTION_TYPE_ID } from "./types"
import { SettlementError } from "./errors"

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)"
]

const VEILSOLVER_ABI = [
  `function executeAction(
    tuple(
      uint8   actionType,
      address tokenIn,
      address tokenOut,
      uint256 amountIn,
      uint256 minAmountOut,
      address[] route,
      address recipient,
      address target,
      bytes   callData,
      uint256 ethValue,
      uint256 deadline,
      bytes32 intentHash,
      bytes   signature
    ) plan,
    address user,
    string  attestationChatID,
    string  auditRootHash
  )`
]

export async function submitSettlement(params: {
  solveResult: SolveResponse
  contractAddress: string
  signer: ethers.Signer
}): Promise<ethers.TransactionReceipt | null> {
  const { solveResult, contractAddress, signer } = params
  const { plan, signature, attestation, auditRootHash } = solveResult

  try {
    const userAddress = await signer.getAddress()

    // Approve ERC20 for SWAP and ERC20 TRANSFER
    const needsApproval =
      (plan.actionType === "SWAP" || plan.actionType === "TRANSFER") &&
      plan.tokenIn !== ethers.ZeroAddress

    if (needsApproval) {
      const token = new ethers.Contract(plan.tokenIn, ERC20_ABI, signer)
      const allowance: bigint = await token.allowance(userAddress, contractAddress)
      if (allowance < BigInt(plan.amountIn)) {
        const approveTx = await token.approve(contractAddress, BigInt(plan.amountIn))
        await approveTx.wait()
      }
    }

    const contract = new ethers.Contract(contractAddress, VEILSOLVER_ABI, signer)

    const planTuple = [
      ACTION_TYPE_ID[plan.actionType],
      plan.tokenIn,
      plan.tokenOut,
      BigInt(plan.amountIn),
      BigInt(plan.minAmountOut),
      plan.route,
      plan.recipient,
      plan.target,
      plan.callData,
      BigInt(plan.ethValue),
      BigInt(plan.deadline),
      plan.intentHash,
      signature
    ]

    // Pass msg.value for native ETH actions
    const ethValue =
      plan.actionType === "TRANSFER" && plan.tokenIn === ethers.ZeroAddress
        ? BigInt(plan.amountIn)
        : plan.actionType === "ARBITRARY_CALL" && BigInt(plan.ethValue) > 0n
          ? BigInt(plan.ethValue)
          : 0n

    const tx = await contract.executeAction(
      planTuple,
      userAddress,
      attestation.chatID,
      auditRootHash,
      { value: ethValue }
    )

    return tx.wait()
  } catch (e: any) {
    throw new SettlementError(e.reason ?? e.shortMessage ?? e.message)
  }
}
