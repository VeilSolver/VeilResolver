import "dotenv/config"
import express from "express"
import cors from "cors"
import { ethers } from "ethers"
import { solveIntent } from "./inference"
import { storeAuditRecord, buildAuditRecord, storeRawBytes } from "./storage"
import { signPlan, getSolverAddress } from "./signer"
import type { TradingIntent, SolveResponse } from "@veilsolver/shared"

const app  = express()
const PORT = process.env.PORT || 4000

app.use(cors())
app.use(express.json())

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    solverAddress: getSolverAddress(process.env.SOLVER_PRIVATE_KEY!),
    network: process.env.NETWORK || "testnet",
    timestamp: Date.now()
  })
})

// ─── Main solve endpoint ──────────────────────────────────────────────────────
// POST /solve
// Body: { intent: TradingIntent, encryptedIntent: string }
//
// Flow:
//   1. Receive intent (we trust it's encrypted from frontend)
//   2. Call GLM-5-FP8 inside TEE → get attested execution plan
//   3. Sign the plan with solver key
//   4. Store audit record to 0G Storage
//   5. Return plan + signature + attestation + audit hash

app.post("/solve", async (req, res) => {
  const { intent, encryptedIntent } = req.body as {
    intent: TradingIntent
    encryptedIntent: string
  }

  // Basic validation
  if (!intent || !intent.tokenIn || !intent.amountIn || !intent.userAddress) {
    return res.status(400).json({ error: "Missing required intent fields" })
  }

  console.log(`\n[Server] New intent from ${intent.userAddress}`)
  console.log(`[Server] ${intent.amountIn} wei ${intent.tokenIn} → ${intent.tokenOut}`)

  try {
    // ── Step 1: TEE Inference ────────────────────────────────────────────────
    // GLM-5-FP8 inside Intel TDX + H100 computes the execution plan
    // isVerified = true means processResponse() confirmed TEE attestation
    const { plan, chatID, isVerified } = await solveIntent(intent)

    // ── Step 2: Sign the plan ────────────────────────────────────────────────
    // Settlement contract will verify this signature onchain
    const signature = await signPlan(plan, process.env.SOLVER_PRIVATE_KEY!)

    // ── Step 3: Build attestation object ────────────────────────────────────
    const attestation: SolveResponse["attestation"] = {
      chatID,
      isVerified,
      provider: process.env.GLM5_PROVIDER_ADDRESS || "0xd9966e...",
      model: "GLM-5-FP8",
      timestamp: Date.now()
    }

    // ── Step 4: Store to 0G Storage ─────────────────────────────────────────
    // Returns root hash — this is the public audit link
    const auditRecord = buildAuditRecord(
      intent, encryptedIntent,
      { plan, chatID, isVerified, signature },
      attestation
    )

    let auditRootHash = ""
    try {
      auditRootHash = await storeAuditRecord(
        auditRecord,
        process.env.SOLVER_PRIVATE_KEY!
      )
    } catch (storageErr) {
      // Don't fail the whole solve if storage is flaky
      console.error("[Server] Storage failed (non-fatal):", storageErr)
    }

    // ── Step 5: Return to frontend ───────────────────────────────────────────
    const response: SolveResponse = {
      plan,
      signature,
      attestation,
      auditRootHash
    }

    console.log(`[Server] ✓ Solve complete. TEE verified: ${isVerified}`)
    res.json(response)

  } catch (err: any) {
    console.error("[Server] Solve failed:", err.message)
    res.status(500).json({ error: err.message })
  }
})

// ─── Strategy upload endpoint ─────────────────────────────────────────────────
// POST /strategy
// Body: { encryptedPrompt: string } — already ECIES encrypted by client
// Server stores encrypted blob to 0G Storage, returns strategyId.
// Server never sees plaintext — encryption happened client-side.
app.post("/strategy", async (req, res) => {
  const { encryptedPrompt } = req.body as { encryptedPrompt: string }

  if (!encryptedPrompt || typeof encryptedPrompt !== "string") {
    return res.status(400).json({ error: "Missing encryptedPrompt" })
  }

  try {
    const strategyId = await storeRawBytes(
      encryptedPrompt,
      process.env.SOLVER_PRIVATE_KEY!
    )
    console.log(`[Strategy] Stored encrypted strategy: ${strategyId.slice(0, 16)}...`)
    res.json({ strategyId })
  } catch (err: any) {
    console.error("[Strategy] Upload failed:", err.message)
    res.status(500).json({ error: err.message })
  }
})

// ─── Audit retrieval endpoint ─────────────────────────────────────────────────
// GET /audit/:rootHash — anyone can verify execution by root hash
app.get("/audit/:rootHash", async (req, res) => {
  // In production: fetch from 0G Storage by root hash
  // For MVP: return the hash and a link to StorageScan
  const { rootHash } = req.params
  const network = process.env.NETWORK || "testnet"
  const scanBase = network === "mainnet"
    ? "https://storagescan.0g.ai"
    : "https://storagescan-galileo.0g.ai"

  res.json({
    rootHash,
    scanUrl: `${scanBase}/tx/${rootHash}`,
    message: "Fetch audit record from 0G Storage using this root hash"
  })
})

app.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════════╗`)
  console.log(`║   VeilSolver API running on :${PORT}   ║`)
  console.log(`╚══════════════════════════════════════╝`)
  console.log(`Solver address: ${getSolverAddress(process.env.SOLVER_PRIVATE_KEY || "0x" + "1".repeat(64))}`)
  console.log(`Network: ${process.env.NETWORK || "testnet"}`)
  console.log(`Health: http://localhost:${PORT}/health\n`)
})
