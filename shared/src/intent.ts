// ─── Action Types ─────────────────────────────────────────────────────────────
export type ActionType = 'SWAP' | 'TRANSFER' | 'ARBITRARY_CALL'

export const ACTION_TYPE_ID: Record<ActionType, number> = {
  SWAP:           0,
  TRANSFER:       1,
  ARBITRARY_CALL: 2,
}

// ─── Intent Types ─────────────────────────────────────────────────────────────
// Intent = what the user WANTS. Solver decides HOW.

export interface TradingIntent {
  action: ActionType        // what kind of action — solver dispatches on this
  tokenIn: string           // token address user is spending (address(0) = native ETH)
  tokenOut: string          // token address user wants (SWAP only)
  amountIn: string          // wei string
  maxSlippageBps: number    // 150 = 1.5%
  deadlineSeconds: number
  userAddress: string
  chainId: number
  nonce: string             // random 32 bytes — replay protection key
  strategyId?: string       // 0G Storage root hash of encrypted strategy prompt
  // TRANSFER specific
  recipient?: string        // who receives the tokens/ETH
  // ARBITRARY_CALL specific
  target?: string           // contract to call
  callData?: string         // ABI-encoded calldata
  ethValue?: string         // ETH to send with call (wei)
}

// ─── Execution Plan ───────────────────────────────────────────────────────────
// What the TEE produces. Every field maps to the Solidity ActionPlan struct.

export interface ExecutionPlan {
  actionType: ActionType
  // SWAP
  tokenIn: string
  tokenOut: string
  amountIn: string
  minAmountOut: string      // SWAP: computed from slippage. TRANSFER/CALL: "0"
  route: string[]           // SWAP: [tokenIn, tokenOut]. Others: []
  // TRANSFER
  recipient: string         // TRANSFER: recipient. Others: "0x0000...0000"
  // ARBITRARY_CALL
  target: string            // ARBITRARY_CALL: target contract. Others: "0x0000...0000"
  callData: string          // ARBITRARY_CALL: encoded calldata. Others: "0x"
  ethValue: string          // ARBITRARY_CALL/ETH_TRANSFER: wei. Others: "0"
  // common
  deadline: number
  intentHash: string
  reasoning?: string        // PRIVATE — never leave the enclave
}

// ─── API response ─────────────────────────────────────────────────────────────
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

// ─── 0G network config ────────────────────────────────────────────────────────
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
