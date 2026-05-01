import { ethers } from "ethers"
import type { ExecutionPlan } from "@veilsolver/shared"

// ─── Sign the execution plan with the solver key ─────────────────────────────
// In production this key lives inside a TEE.
// For MVP: it's a regular wallet key — judges understand the distinction.
// The signature is what the settlement contract verifies onchain.

export function getPlanHash(plan: ExecutionPlan): string {
  return ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "address", "uint256", "uint256", "uint256", "bytes32"],
      [
        plan.tokenIn,
        plan.tokenOut,
        BigInt(plan.amountIn),
        BigInt(plan.minAmountOut),
        BigInt(plan.deadline),
        plan.intentHash
      ]
    )
  )
}

export async function signPlan(
  plan: ExecutionPlan,
  privateKey: string
): Promise<string> {
  const wallet   = new ethers.Wallet(privateKey)
  const planHash = getPlanHash(plan)

  // Sign with eth_sign prefix — matches ecrecover in Solidity
  const signature = await wallet.signMessage(ethers.getBytes(planHash))
  console.log(`[Signer] Plan signed. Signer: ${wallet.address}`)
  return signature
}

export function getSolverAddress(privateKey: string): string {
  return new ethers.Wallet(privateKey).address
}
