import { Indexer, MemData } from "@0gfoundation/0g-ts-sdk"
import { ethers } from "ethers"
import type { TradingIntent, ExecutionPlan, SolveResponse } from "veilsolver-sdk"
import { NETWORKS } from "veilsolver-sdk/dist/types"

const NETWORK   = (process.env.NETWORK as keyof typeof NETWORKS) || "testnet"
const netConfig = NETWORKS[NETWORK]

// ─── Audit Record: everything stored per intent ───────────────────────────────
// encryptedIntent stays encrypted — only user can read it
// attestation + plan are public — anyone can verify execution was honest

export interface AuditRecord {
  version: "1.0"
  intentHash: string
  userAddress: string
  encryptedIntent: string          // ECIES encrypted — only user decrypts
  attestation: SolveResponse["attestation"]
  plan: Omit<ExecutionPlan, "reasoning"> // reasoning stays private
  outcome?: {
    txHash: string
    amountOut: string
    blockNumber: number
    gasUsed: string
  }
  timestamp: number
}

// ─── Store audit record to 0G Storage ────────────────────────────────────────
// Returns root hash — this is the retrieval key, stored in the onchain event
export async function storeAuditRecord(
  record: AuditRecord,
  signerKey: string
): Promise<string> {
  const provider = new ethers.JsonRpcProvider(netConfig.rpcUrl)
  const signer   = new ethers.Wallet(signerKey, provider)
  const indexer  = new Indexer(netConfig.storageIndexer)

  const json   = JSON.stringify(record, null, 2)
  const bytes  = new TextEncoder().encode(json)
  const memData = new MemData(bytes)

  const [tree, treeErr] = await memData.merkleTree()
  if (treeErr) throw new Error(`[Storage] Merkle tree error: ${treeErr}`)

  console.log(`[Storage] Uploading audit record (${bytes.length} bytes)...`)
  const [tx, uploadErr] = await indexer.upload(memData, netConfig.rpcUrl, signer)
  if (uploadErr) throw new Error(`[Storage] Upload failed: ${uploadErr}`)

  const rootHash = tree!.rootHash()
  if (!rootHash) throw new Error("[Storage] Failed to compute root hash")
  console.log(`[Storage] ✓ Stored. Root hash: ${rootHash}`)
  console.log(`[Storage] View: ${netConfig.explorerUrl.replace("chainscan", "storagescan")}`)

  return rootHash
}

// ─── Store raw bytes to 0G Storage (used for encrypted strategy blobs) ───────
export async function storeRawBytes(
  data: string,
  signerKey: string
): Promise<string> {
  const provider = new ethers.JsonRpcProvider(netConfig.rpcUrl)
  const signer   = new ethers.Wallet(signerKey, provider)
  const indexer  = new Indexer(netConfig.storageIndexer)

  const bytes   = new TextEncoder().encode(data)
  const memData = new MemData(bytes)

  const [tree, treeErr] = await memData.merkleTree()
  if (treeErr) throw new Error(`[Storage] Merkle tree error: ${treeErr}`)

  const [, uploadErr] = await indexer.upload(memData, netConfig.rpcUrl, signer)
  if (uploadErr) throw new Error(`[Storage] Upload failed: ${uploadErr}`)

  const rawHash = tree!.rootHash()
  if (!rawHash) throw new Error("[Storage] Failed to compute root hash")
  return rawHash
}

// ─── Build audit record from solve result ────────────────────────────────────
export function buildAuditRecord(
  intent: TradingIntent,
  encryptedIntent: string,
  solveResult: {
    plan: ExecutionPlan
    chatID: string
    isVerified: boolean
    signature: string
  },
  attestation: SolveResponse["attestation"]
): AuditRecord {
  // Strip private reasoning before storing
  const { reasoning: _, ...publicPlan } = solveResult.plan

  return {
    version: "1.0",
    intentHash: intent.nonce,
    userAddress: intent.userAddress,
    encryptedIntent,
    attestation,
    plan: publicPlan,
    timestamp: Date.now()
  }
}
