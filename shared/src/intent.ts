// ─── Intent Types ────────────────────────────────────────────────────────────
// An Intent is what the user WANTS. NOT a transaction.
// The solver figures out HOW to execute it.

export interface TradingIntent {
  tokenIn: string         // token address user is selling
  tokenOut: string        // token address user wants
  amountIn: string        // amount in wei (string to avoid BigInt issues)
  maxSlippageBps: number  // e.g. 150 = 1.5%
  deadlineSeconds: number
  userAddress: string
  chainId: number
  nonce: string           // random — prevents replay attacks
  strategyId?: string     // 0G Storage root hash of encrypted strategy prompt
}

// What the TEE + LLM produces after reading the intent
export interface ExecutionPlan {
  tokenIn: string
  tokenOut: string
  amountIn: string
  minAmountOut: string    // computed: expectedOut * (1 - slippage)
  route: string[]         // pool addresses in execution order
  deadline: number        // unix timestamp
  intentHash: string      // keccak256 of original intent
  reasoning?: string      // private — never emitted onchain
}

// What the Solver API returns to the frontend
export interface SolveResponse {
  plan: ExecutionPlan
  signature: string       // ECDSA over plan hash, signed by solver key
  attestation: {
    chatID: string        // ZG-Res-Key header from TEE provider
    isVerified: boolean   // result of processResponse()
    provider: string      // 0G Compute provider address
    model: string
    timestamp: number
  }
  auditRootHash: string   // 0G Storage retrieval key
}

// 0G network config
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
