export interface TradingIntent {
  tokenIn: string
  tokenOut: string
  amountIn: string
  maxSlippageBps: number
  deadlineSeconds: number
  userAddress: string
  chainId: number
  nonce: string
  strategyId?: string
}

export interface ExecutionPlan {
  tokenIn: string
  tokenOut: string
  amountIn: string
  minAmountOut: string
  route: string[]
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
