import { ethers } from "ethers"
import type { TradingIntent, SolveResponse } from "@veilsolver/shared"

const SOLVER_API = process.env.NEXT_PUBLIC_SOLVER_API || "http://localhost:4000"

// ─── Encrypt intent before sending to solver ──────────────────────────────────
// The solver API never sees plaintext intent — only the TEE can decrypt it.
// For MVP: we use a known solver public key registered in the contract.
// In production: fetched from the contract's enclaveKey() view function.

export async function encryptIntent(
  intent: TradingIntent,
  solverPublicKey: string // hex compressed secp256k1 pubkey
): Promise<string> {
  // Dynamic import — eciesjs is ESM only
  const { encrypt } = await import("eciesjs")
  const json    = JSON.stringify(intent)
  const bytes   = Buffer.from(json, "utf-8")
  const pubKey  = Buffer.from(solverPublicKey.replace("0x", ""), "hex")
  const encrypted = encrypt(pubKey, bytes)
  return Buffer.from(encrypted).toString("hex")
}

// ─── Build intent from form values ───────────────────────────────────────────

export function buildIntent(params: {
  tokenIn: string
  tokenOut: string
  amountIn: string     // human-readable e.g. "100" USDC
  decimalsIn: number
  maxSlippageBps: number
  userAddress: string
  chainId: number
}): TradingIntent {
  const amountWei = BigInt(
    Math.floor(parseFloat(params.amountIn) * 10 ** params.decimalsIn)
  ).toString()

  return {
    tokenIn: params.tokenIn,
    tokenOut: params.tokenOut,
    amountIn: amountWei,
    maxSlippageBps: params.maxSlippageBps,
    deadlineSeconds: 120, // 2 minutes
    userAddress: params.userAddress,
    chainId: params.chainId,
    nonce: ethers.hexlify(ethers.randomBytes(32)) // unique per intent
  }
}

// ─── Call solver API ──────────────────────────────────────────────────────────

export async function callSolverAPI(
  intent: TradingIntent,
  encryptedIntent: string
): Promise<SolveResponse> {
  const res = await fetch(`${SOLVER_API}/solve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ intent, encryptedIntent })
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || `Solver API error: ${res.status}`)
  }

  return res.json()
}

// ─── Submit settlement tx to 0G Chain ────────────────────────────────────────
// User signs and submits the executePlan() call themselves (self-custody)

const VEILSOLVER_ABI = [
  "function executePlan(tuple(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, address[] route, uint256 deadline, bytes32 intentHash, bytes signature), address user, string attestationChatID, string auditRootHash)"
]

export async function submitSettlement(
  solveResult: SolveResponse,
  contractAddress: string,
  signer: ethers.Signer
): Promise<ethers.TransactionReceipt | null> {
  const contract = new ethers.Contract(contractAddress, VEILSOLVER_ABI, signer)
  const { plan, signature, attestation, auditRootHash } = solveResult

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
    await signer.getAddress(),
    attestation.chatID,
    auditRootHash
  )

  return tx.wait()
}
