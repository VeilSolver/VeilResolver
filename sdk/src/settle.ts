import { ethers } from "ethers"
import type { SolveResponse } from "./types"
import { SettlementError } from "./errors"

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)"
]

const VEILSOLVER_ABI = [
  "function executePlan(tuple(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, address[] route, uint256 deadline, bytes32 intentHash, bytes signature) plan, address user, string attestationChatID, string auditRootHash)"
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

    // Approve exact amount — never approve max uint256 to a DEX router
    const token = new ethers.Contract(plan.tokenIn, ERC20_ABI, signer)
    const allowance: bigint = await token.allowance(userAddress, contractAddress)
    if (allowance < BigInt(plan.amountIn)) {
      const approveTx = await token.approve(contractAddress, BigInt(plan.amountIn))
      await approveTx.wait()
    }

    const contract = new ethers.Contract(contractAddress, VEILSOLVER_ABI, signer)

    const planTuple = [
      plan.tokenIn,
      plan.tokenOut,
      BigInt(plan.amountIn),
      BigInt(plan.minAmountOut),
      plan.route,
      BigInt(plan.deadline),
      plan.intentHash,
      signature
    ]

    const tx = await contract.executePlan(
      planTuple,
      userAddress,
      attestation.chatID,
      auditRootHash
    )

    return tx.wait()
  } catch (e: any) {
    throw new SettlementError(e.reason ?? e.shortMessage ?? e.message)
  }
}
