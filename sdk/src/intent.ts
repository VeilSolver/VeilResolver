import { ethers } from "ethers"
import type { TradingIntent, ActionType } from "./types"

export function buildIntent(params: {
  action: ActionType
  tokenIn: string
  tokenOut: string
  amountIn: string
  decimalsIn: number
  maxSlippageBps: number
  userAddress: string
  chainId: number
  deadlineSeconds?: number
  strategyId?: string
  recipient?: string
  target?: string
  callData?: string
  ethValue?: string
}): TradingIntent {
  const amountWei = BigInt(
    Math.floor(parseFloat(params.amountIn) * 10 ** params.decimalsIn)
  ).toString()

  return {
    action:          params.action,
    tokenIn:         params.tokenIn,
    tokenOut:        params.tokenOut,
    amountIn:        amountWei,
    maxSlippageBps:  params.maxSlippageBps,
    deadlineSeconds: params.deadlineSeconds ?? 120,
    userAddress:     params.userAddress,
    chainId:         params.chainId,
    nonce:           ethers.hexlify(ethers.randomBytes(32)),
    strategyId:      params.strategyId,
    recipient:       params.recipient,
    target:          params.target,
    callData:        params.callData,
    ethValue:        params.ethValue,
  }
}
