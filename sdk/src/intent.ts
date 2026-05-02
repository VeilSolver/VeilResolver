import { ethers } from "ethers"
import type { TradingIntent } from "./types"

export function buildIntent(params: {
  tokenIn: string
  tokenOut: string
  amountIn: string       // human-readable e.g. "100"
  decimalsIn: number
  maxSlippageBps: number
  userAddress: string
  chainId: number
  deadlineSeconds?: number
  strategyId?: string
}): TradingIntent {
  const amountWei = BigInt(
    Math.floor(parseFloat(params.amountIn) * 10 ** params.decimalsIn)
  ).toString()

  return {
    tokenIn: params.tokenIn,
    tokenOut: params.tokenOut,
    amountIn: amountWei,
    maxSlippageBps: params.maxSlippageBps,
    deadlineSeconds: params.deadlineSeconds ?? 120,
    userAddress: params.userAddress,
    chainId: params.chainId,
    nonce: ethers.hexlify(ethers.randomBytes(32)),
    strategyId: params.strategyId
  }
}
