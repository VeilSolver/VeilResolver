import { ethers } from "ethers"
import { buildIntent } from "./intent"
import { encryptIntent } from "./encrypt"
import { callSolverAPI } from "./client"
import { submitSettlement } from "./settle"
import { uploadStrategy } from "./strategy"
import type { SolveResponse } from "./types"

// Named exports — for integrators who want step-by-step control
export { buildIntent } from "./intent"
export { encryptIntent } from "./encrypt"
export { callSolverAPI } from "./client"
export { submitSettlement } from "./settle"
export { uploadStrategy } from "./strategy"
export { SolverAPIError, SettlementError, EncryptionError, StrategyError } from "./errors"
export type { TradingIntent, SolveResponse, ExecutionPlan, ActionType } from "./types"
export { ACTION_TYPE_ID } from "./types"

export interface VeilSolverConfig {
  apiUrl: string
  contractAddress: string
  solverPublicKey: string  // hex compressed secp256k1 — from /health or env
  network?: "testnet" | "mainnet"
}

export interface SolveParams {
  action?: import("./types").ActionType  // default: SWAP
  tokenIn: string
  tokenOut: string
  amountIn: string       // human-readable e.g. "100"
  decimalsIn: number
  maxSlippageBps: number
  signer: ethers.Signer
  strategyId?: string
  deadlineSeconds?: number
  recipient?: string
  target?: string
  callData?: string
  ethValue?: string
}

export interface SolveResult {
  solveResponse: SolveResponse
  receipt: ethers.TransactionReceipt | null
}

// VeilSolverClient — one-liner integration for external projects
export class VeilSolverClient {
  constructor(private config: VeilSolverConfig) {}

  // Full flow: build → encrypt → solve → approve ERC20 → settle
  async solve(params: SolveParams): Promise<SolveResult> {
    const userAddress = await params.signer.getAddress()
    const network = await params.signer.provider!.getNetwork()

    const intent = buildIntent({
      action:          params.action ?? "SWAP",
      tokenIn:         params.tokenIn,
      tokenOut:        params.tokenOut,
      amountIn:        params.amountIn,
      decimalsIn:      params.decimalsIn,
      maxSlippageBps:  params.maxSlippageBps,
      userAddress,
      chainId:         Number(network.chainId),
      deadlineSeconds: params.deadlineSeconds,
      strategyId:      params.strategyId,
      recipient:       params.recipient,
      target:          params.target,
      callData:        params.callData,
      ethValue:        params.ethValue,
    })

    const encryptedIntent = await encryptIntent(intent, this.config.solverPublicKey)
    const solveResponse = await callSolverAPI(intent, encryptedIntent, this.config.apiUrl)
    const receipt = await submitSettlement({
      solveResult: solveResponse,
      contractAddress: this.config.contractAddress,
      signer: params.signer
    })

    return { solveResponse, receipt }
  }

  // Upload a private strategy — encrypted client-side, solver API never sees plaintext
  async uploadStrategy(params: { prompt: string; signer: ethers.Signer }): Promise<string> {
    return uploadStrategy({
      prompt: params.prompt,
      solverPublicKey: this.config.solverPublicKey,
      apiUrl: this.config.apiUrl
    })
  }
}
