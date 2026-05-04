export type ActionType = 'SWAP' | 'TRANSFER' | 'ARBITRARY_CALL'

export const ACTION_TYPE_ID: Record<ActionType, number> = {
  SWAP:           0,
  TRANSFER:       1,
  ARBITRARY_CALL: 2,
}

export interface TradingIntent {
  action: ActionType
  tokenIn: string
  tokenOut: string
  amountIn: string
  maxSlippageBps: number
  deadlineSeconds: number
  userAddress: string
  chainId: number
  nonce: string
  strategyId?: string
  recipient?: string
  target?: string
  callData?: string
  ethValue?: string
}

export interface ExecutionPlan {
  actionType: ActionType
  tokenIn: string
  tokenOut: string
  amountIn: string
  minAmountOut: string
  route: string[]
  recipient: string
  target: string
  callData: string
  ethValue: string
  deadline: number
  intentHash: string
  reasoning?: string
}

export interface SolveResponse {
  plan: ExecutionPlan
  signature: string
  attestation: {
    chatID: string
    isVerified: boolean
    provider: string
    model: string
    timestamp: number
  }
  auditRootHash: string
}

export const NETWORKS = {
  testnet: {
    chainId: 16602,
    rpcUrl: "https://evmrpc-testnet.0g.ai",
    explorerUrl: "https://chainscan-galileo.0g.ai",
    storageIndexer: "https://indexer-storage-testnet-turbo.0g.ai",
    name: "0G Galileo Testnet"
  },
  mainnet: {
    chainId: 16661,
    rpcUrl: "https://evmrpc.0g.ai",
    explorerUrl: "https://chainscan.0g.ai",
    storageIndexer: "https://indexer-storage-turbo.0g.ai",
    name: "0G Aristotle Mainnet"
  }
}
