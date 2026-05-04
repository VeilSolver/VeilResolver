import { ethers } from "ethers"
import type { TradingIntent, SolveResponse, ActionType } from "veilsolver-sdk"

export type { TradingIntent, SolveResponse, ActionType }

const SOLVER_API = process.env.NEXT_PUBLIC_SOLVER_API || "http://localhost:4000"

// ─── Encrypt intent before sending to solver ──────────────────────────────────
export async function encryptIntent(
  intent: TradingIntent,
  solverPublicKey: string
): Promise<string> {
  const { encrypt } = await import("eciesjs")
  const json      = JSON.stringify(intent)
  const bytes     = Buffer.from(json, "utf-8")
  const pubKey    = Buffer.from(solverPublicKey.replace("0x", ""), "hex")
  const encrypted = encrypt(pubKey, bytes)
  return Buffer.from(encrypted).toString("hex")
}

// ─── Build intent ─────────────────────────────────────────────────────────────
export function buildIntent(params: {
  action: ActionType
  tokenIn: string
  tokenOut: string
  amountIn: string
  decimalsIn: number
  maxSlippageBps: number
  userAddress: string
  chainId: number
  // TRANSFER
  recipient?: string
  // ARBITRARY_CALL
  target?: string
  callData?: string
  ethValue?: string
}): TradingIntent {
  const amountWei = BigInt(
    Math.floor(parseFloat(params.amountIn) * 10 ** params.decimalsIn)
  ).toString()

  return {
    action:         params.action,
    tokenIn:        params.tokenIn,
    tokenOut:       params.tokenOut,
    amountIn:       amountWei,
    maxSlippageBps: params.maxSlippageBps,
    deadlineSeconds: 120,
    userAddress:    params.userAddress,
    chainId:        params.chainId,
    nonce:          ethers.hexlify(ethers.randomBytes(32)),
    recipient:      params.recipient,
    target:         params.target,
    callData:       params.callData,
    ethValue:       params.ethValue,
  }
}

// ─── Call solver API ──────────────────────────────────────────────────────────
export async function callSolverAPI(
  intent: TradingIntent,
  encryptedIntent: string,
  apiUrl?: string
): Promise<SolveResponse> {
  const base = apiUrl || SOLVER_API
  const res  = await fetch(`${base}/solve`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ intent, encryptedIntent })
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || `Solver API error: ${res.status}`)
  }

  return res.json()
}

// ─── VeilSolver ABI — matches generalized ActionPlan struct ──────────────────
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
  )`,
  `function executedIntents(bytes32) external view returns (bool)`,
  `function solverKey() external view returns (address)`,
]

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
]

// ─── Submit settlement to 0G Chain ───────────────────────────────────────────
export async function submitSettlement({
  solveResult,
  contractAddress,
  signer,
}: {
  solveResult:     SolveResponse
  contractAddress: string
  signer:          ethers.Signer
}): Promise<ethers.TransactionReceipt | null> {
  const contract = new ethers.Contract(contractAddress, VEILSOLVER_ABI, signer)
  const { plan, signature, attestation, auditRootHash } = solveResult

  // For SWAP and ERC20 TRANSFER: approve VeilSolver to spend tokenIn
  const needsApproval = (plan.actionType === "SWAP" || plan.actionType === "TRANSFER") &&
                        plan.tokenIn !== ethers.ZeroAddress

  if (needsApproval) {
    const token = new ethers.Contract(plan.tokenIn, ERC20_ABI, signer)
    const approveTx = await token.approve(contractAddress, BigInt(plan.amountIn))
    await approveTx.wait()
  }

  const planTuple = [
    plan.actionType === "SWAP"           ? 0 :
    plan.actionType === "TRANSFER"       ? 1 : 2,
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

  // Native ETH transfer: pass msg.value
  const ethValue = plan.actionType === "TRANSFER" && plan.tokenIn === ethers.ZeroAddress
    ? BigInt(plan.amountIn)
    : plan.actionType === "ARBITRARY_CALL" && BigInt(plan.ethValue) > BigInt(0)
      ? BigInt(plan.ethValue)
      : BigInt(0)

  const tx = await contract.executeAction(
    planTuple,
    await signer.getAddress(),
    attestation.chatID,
    auditRootHash,
    { value: ethValue }
  )

  return tx.wait()
}
