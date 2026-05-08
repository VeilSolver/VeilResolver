import "dotenv/config"
import express from "express"
import cors from "cors"
import { ethers } from "ethers"
import { solveIntent } from "./inference"
import { storeAuditRecord, buildAuditRecord, storeRawBytes } from "./storage"
import { signPlan, getSolverAddress } from "./signer"
import type { TradingIntent, SolveResponse } from "veilsolver-sdk"

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

  if (!intent || !intent.tokenIn || !intent.amountIn || !intent.userAddress) {
    return res.status(400).json({ error: "Missing required intent fields" })
  }

  const solveStart = Date.now()
  console.log(`\n${"─".repeat(56)}`)
  console.log(`[Solve] ▶  New intent`)
  console.log(`[Solve]    User:    ${intent.userAddress}`)
  console.log(`[Solve]    TokenIn: ${intent.tokenIn}`)
  console.log(`[Solve]    TokenOut:${intent.tokenOut}`)
  console.log(`[Solve]    Amount:  ${intent.amountIn} wei`)
  console.log(`[Solve]    Slippage:${intent.maxSlippageBps} bps`)
  console.log(`[Solve]    Nonce:   ${intent.nonce}`)
  console.log(`${"─".repeat(56)}`)

  try {
    // ── Step 1: TEE Inference ────────────────────────────────────────────────
    console.log(`[Step 1/4] TEE Inference...`)
    const t1 = Date.now()
    const { plan, chatID, isVerified } = await solveIntent(intent)
    console.log(`[Step 1/4] ✓ Done (${Date.now() - t1}ms)`)
    console.log(`           chatID:        ${chatID}`)
    console.log(`           isVerified:    ${isVerified}`)
    console.log(`           minAmountOut:  ${plan.minAmountOut}`)
    console.log(`           deadline:      ${plan.deadline}`)

    // ── Step 2: Sign the plan ────────────────────────────────────────────────
    console.log(`[Step 2/4] Signing plan...`)
    const t2 = Date.now()
    const signature = await signPlan(plan, process.env.SOLVER_PRIVATE_KEY!)
    console.log(`[Step 2/4] ✓ Done (${Date.now() - t2}ms)`)
    console.log(`           signature: ${signature.slice(0, 20)}...`)

    // ── Step 3: Build attestation ────────────────────────────────────────────
    const attestation: SolveResponse["attestation"] = {
      chatID,
      isVerified,
      provider: process.env.GLM5_PROVIDER_ADDRESS || "0xd9966e...",
      model:    "qwen-2.5-7b-instruct",
      timestamp: Date.now()
    }

    // ── Step 4: Store to 0G Storage ─────────────────────────────────────────
    console.log(`[Step 3/4] Storing audit record to 0G Storage...`)
    const t3 = Date.now()
    const auditRecord = buildAuditRecord(
      intent, encryptedIntent,
      { plan, chatID, isVerified, signature },
      attestation
    )

    let auditRootHash = ""
    try {
      auditRootHash = await storeAuditRecord(auditRecord, process.env.SOLVER_PRIVATE_KEY!)
      console.log(`[Step 3/4] ✓ Done (${Date.now() - t3}ms)`)
      console.log(`           rootHash: ${auditRootHash}`)
    } catch (storageErr: any) {
      console.error(`[Step 3/4] ✗ Storage failed (non-fatal): ${storageErr.message}`)
    }

    // ── Step 4: Return ───────────────────────────────────────────────────────
    const response: SolveResponse = { plan, signature, attestation, auditRootHash }

    const total = Date.now() - solveStart
    console.log(`[Step 4/4] ✓ Response sent`)
    console.log(`${"─".repeat(56)}`)
    console.log(`[Solve] ✅ Complete in ${total}ms | verified=${isVerified} | hash=${auditRootHash.slice(0,18)}...`)
    console.log(`${"─".repeat(56)}\n`)

    res.json(response)

  } catch (err: any) {
    console.error(`[Solve] ✗ FAILED (${Date.now() - solveStart}ms): ${err.message}`)
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
