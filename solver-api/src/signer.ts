import { ethers } from "ethers"
import type { ExecutionPlan } from "@veilsolver/shared"
import { ACTION_TYPE_ID } from "@veilsolver/shared"

// ─── Plan hash — MUST match VeilSolver.sol _getPlanHash() exactly ────────────
//
// keccak256(abi.encode(
//   uint8(actionType), tokenIn, tokenOut, amountIn, minAmountOut,
//   recipient, target, keccak256(callData), ethValue, deadline, intentHash
// ))

export function getPlanHash(plan: ExecutionPlan): string {
  const safeCallData = typeof plan.callData === "string" && plan.callData.length > 0
    ? plan.callData
    : "0x"
  const callDataHash = ethers.keccak256(safeCallData)

  return ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint8", "address", "address", "uint256", "uint256",
       "address", "address", "bytes32", "uint256", "uint256", "bytes32"],
      [
        ACTION_TYPE_ID[plan.actionType],
        plan.tokenIn,
        plan.tokenOut,
        BigInt(plan.amountIn),
        BigInt(plan.minAmountOut),
        plan.recipient,
        plan.target,
        callDataHash,
        BigInt(plan.ethValue),
        BigInt(plan.deadline),
        plan.intentHash
      ]
    )
  )
}

export async function signPlan(plan: ExecutionPlan, privateKey: string): Promise<string> {
  const wallet    = new ethers.Wallet(privateKey)
  const planHash  = getPlanHash(plan)
  const signature = await wallet.signMessage(ethers.getBytes(planHash))

  console.log(`[Signer] actionType: ${plan.actionType}`)
  console.log(`[Signer] planHash:   ${planHash}`)
  console.log(`[Signer] signer:     ${wallet.address}`)
  console.log(`[Signer] signature:  ${signature.slice(0, 20)}...${signature.slice(-8)}`)
  return signature
}

export function getSolverAddress(privateKey: string): string {
  return new ethers.Wallet(privateKey).address
}
