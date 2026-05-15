import * as os from "os"
import * as path from "path"
import * as fs from "fs/promises"
import { Indexer } from "@0gfoundation/0g-ts-sdk"
import { decrypt } from "eciesjs"
import type { TradingIntent, ExecutionPlan } from "veilsolver-sdk"
import { NETWORKS } from "veilsolver-sdk/dist/types"


const OG_API_URL = "https://compute-network-6.integratenetwork.work/v1/proxy/chat/completions"
const OG_MODEL   = "qwen/qwen-2.5-7b-instruct"

// Always appended — custom strategies define rules, this enforces output format
const JSON_FORMAT_CONSTRAINT = `
CRITICAL OUTPUT RULES:
- Respond with ONLY a single valid JSON object. No markdown, no prose, no code fences.
- Your entire response must be parseable by JSON.parse().
- TWO valid output shapes:

  Shape 1 — REJECTION (use when strategy rules forbid this intent):
  {"error": "<reason why rejected>"}

  Shape 2 — EXECUTION PLAN (use when intent is allowed):
  {
    actionType, tokenIn, tokenOut, amountIn, minAmountOut, route,
    recipient, target, callData, ethValue, deadline, intentHash, reasoning
  }
  Use zero values ("0x0000000000000000000000000000000000000000", "0", [], "0x") for unused fields.

- If your strategy defines rules that this intent violates, use Shape 1.
- Otherwise use Shape 2.
`

const SOLVER_SYSTEM_PROMPT = `
You are VeilSolver, a MEV-resistant transaction execution engine running inside
a Trusted Execution Environment (TEE). You receive a user's private trading intent
and compute the optimal execution plan for it.

You support three action types:
- SWAP: exchange tokenIn for tokenOut via a DEX
- TRANSFER: send tokenIn (or native ETH if tokenIn is address(0)) to a recipient
- ARBITRARY_CALL: call any contract with encoded calldata

You must respond ONLY with valid JSON matching this exact schema:
{
  "actionType": "SWAP" | "TRANSFER" | "ARBITRARY_CALL",
  "tokenIn": "0x...",
  "tokenOut": "0x...",
  "amountIn": "string (wei)",
  "minAmountOut": "string (wei)",
  "route": ["0xTokenIn", "0xTokenOut"],
  "recipient": "0x...",
  "target": "0x...",
  "callData": "0x",
  "ethValue": "0",
  "deadline": <unix timestamp>,
  "intentHash": "0x...",
  "reasoning": "private explanation — NOT emitted onchain"
}

Rules by action type:

SWAP:
  - minAmountOut = floor(amountIn * (1 - slippage/10000)). Never exceed declared slippage.
  - route = [tokenIn address, tokenOut address]
  - recipient = "0x0000000000000000000000000000000000000000"
  - target = "0x0000000000000000000000000000000000000000"
  - callData = "0x"
  - ethValue = "0"

TRANSFER:
  - recipient = the destination address from intent
  - tokenOut = "0x0000000000000000000000000000000000000000"
  - minAmountOut = "0"
  - route = []
  - target = "0x0000000000000000000000000000000000000000"
  - callData = "0x"
  - ethValue = "0" (for ERC20) or amountIn (for ETH if tokenIn is zero address)

ARBITRARY_CALL:
  - target = contract to call from intent
  - callData = encoded calldata from intent
  - ethValue = ETH to send (or "0")
  - tokenOut = "0x0000000000000000000000000000000000000000"
  - minAmountOut = "0"
  - route = []
  - recipient = "0x0000000000000000000000000000000000000000"

Common rules for all types:
  - deadline = the unix timestamp provided in the intent
  - intentHash = the nonce value provided exactly as-is
  - reasoning field is private — it stays inside the TEE. Never put it onchain.
  - No prose, no markdown, no explanation outside the JSON object.
  - Respond with ONLY the JSON object, nothing else.
  - Always populate ALL fields, use zero values for unused ones.
`

// ─── Strategy Registry: fetch + decrypt custom strategy from 0G Storage ──────
async function resolveSystemPrompt(strategyId?: string): Promise<string> {
  if (!strategyId) return SOLVER_SYSTEM_PROMPT + JSON_FORMAT_CONSTRAINT

  const network   = (process.env.NETWORK as keyof typeof NETWORKS) || "testnet"
  const netConfig = NETWORKS[network]
  const indexer   = new Indexer(netConfig.storageIndexer)
  const tmpPath   = path.join(os.tmpdir(), `vs-strategy-${strategyId.slice(0, 16)}.bin`)

  try {
    const err = await indexer.download(strategyId, tmpPath, false)
    if (err) throw new Error(`Download failed: ${err}`)

    const encryptedHex  = await fs.readFile(tmpPath, "utf-8")
    const privateKeyBuf = Buffer.from(process.env.SOLVER_PRIVATE_KEY!.replace("0x", ""), "hex")
    const decrypted     = decrypt(privateKeyBuf, Buffer.from(encryptedHex, "hex"))
    const { prompt }    = JSON.parse(Buffer.from(decrypted).toString("utf-8"))

    console.log(`[Strategy] Loaded custom strategy: ${strategyId.slice(0, 16)}...`)
    return prompt as string
  } catch (e: any) {
    console.error(`[Strategy] Failed to load strategy, using default:`, e.message)
    return SOLVER_SYSTEM_PROMPT
  } finally {
    await fs.unlink(tmpPath).catch(() => {})
  }
}

// ─── Core: call 0G AI router, get execution plan ─────────────────────────────
export async function solveIntent(intent: TradingIntent): Promise<{
  plan: ExecutionPlan
  chatID: string
  isVerified: boolean
}> {
  const apiKey       = process.env.OG_API_KEY!
  const systemPrompt = await resolveSystemPrompt(intent.strategyId)

  console.log(`[Inference] Action:   ${intent.action}`)
  console.log(`[Inference] Model:    ${OG_MODEL}`)
  console.log(`[Inference] Endpoint: ${OG_API_URL}`)
  const t0 = Date.now()

  const response = await fetch(OG_API_URL, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: OG_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: buildIntentPrompt(intent) }
      ],
      temperature: 0.1
    })
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`[Inference] 0G AI router error ${response.status}: ${body}`)
  }

  const data    = await response.json()
  const chatID  = data.id || ""
  const rawPlan = data.choices?.[0]?.message?.content

  if (!rawPlan) throw new Error("[Inference] Empty response from 0G AI router")

  console.log(`[Inference] ✓ Response in ${Date.now() - t0}ms | chatID: ${chatID}`)
  console.log(`[Inference] Raw: ${rawPlan.slice(0, 120).replace(/\n/g, " ")}...`)

  let plan: ExecutionPlan
  try {
    // Strip code fences, then find outermost {...} — handles model markdown leakage
    const fenceStripped = rawPlan.replace(/```json\n?|```/g, "").trim()
    const start = fenceStripped.indexOf("{")
    const end   = fenceStripped.lastIndexOf("}")
    if (start === -1 || end === -1) throw new Error("No JSON object found in response")
    const cleaned = fenceStripped.slice(start, end + 1)
    const parsed  = JSON.parse(cleaned)

    // Strategy rejected the intent (e.g. $100 cap policy)
    if (parsed.error) throw new Error(`Strategy rejected: ${parsed.error}`)

    // Strip any non-digit suffix the model may add (e.g. "100000000 wei" → "100000000")
    const wei = (v: any, fallback: string) =>
      v != null ? String(v).replace(/[^0-9]/g, "") || fallback : fallback

    // Ensure all required fields are present with safe defaults
    plan = {
      actionType:   parsed.actionType   ?? intent.action,
      tokenIn:      parsed.tokenIn      ?? intent.tokenIn,
      tokenOut:     parsed.tokenOut     ?? "0x0000000000000000000000000000000000000000",
      amountIn:     wei(parsed.amountIn, intent.amountIn),
      minAmountOut: wei(parsed.minAmountOut, "0"),
      route:        Array.isArray(parsed.route) ? parsed.route : [],
      recipient:    parsed.recipient    ?? "0x0000000000000000000000000000000000000000",
      target:       parsed.target       ?? "0x0000000000000000000000000000000000000000",
      callData:     typeof parsed.callData === "string" ? parsed.callData : "0x",
      ethValue:     wei(parsed.ethValue, "0"),
      deadline:     parsed.deadline,
      intentHash:   parsed.intentHash   ?? intent.nonce,
      reasoning:    parsed.reasoning,
    }
  } catch (e: any) {
    if (e instanceof Error && e.message.startsWith("Strategy rejected:")) throw e
    throw new Error(`[Inference] Invalid JSON from model: ${rawPlan}`)
  }

  const isVerified = true
  console.log(`[Inference] Plan ✓ | action: ${plan.actionType} | intentHash: ${plan.intentHash?.slice(0, 18)}...`)
  return { plan, chatID, isVerified }
}

// ─── Build intent prompt ──────────────────────────────────────────────────────
function buildIntentPrompt(intent: TradingIntent): string {
  const deadlineTs = Math.floor(Date.now() / 1000) + intent.deadlineSeconds

  const base = `
Action Type:    ${intent.action}
Token In:       ${intent.tokenIn}
Amount In:      ${intent.amountIn} wei
maxSlippageBps: ${intent.maxSlippageBps}
Max Slippage:   ${intent.maxSlippageBps} bps (${intent.maxSlippageBps / 100}%)
Deadline:       ${deadlineTs} (unix timestamp)
User:           ${intent.userAddress}
Nonce:          ${intent.nonce}
`.trim()

  const extra: string[] = []

  if (intent.action === "SWAP") {
    extra.push(`Token Out:    ${intent.tokenOut}`)
    extra.push(`Compute minAmountOut = floor(${intent.amountIn} * (1 - ${intent.maxSlippageBps}/10000)).`)
    extra.push(`Set route = ["${intent.tokenIn}", "${intent.tokenOut}"].`)
  }

  if (intent.action === "TRANSFER") {
    extra.push(`Recipient:    ${intent.recipient}`)
    extra.push(`Set recipient = "${intent.recipient}".`)
    extra.push(`Set minAmountOut = "0", route = [], target = zero address.`)
  }

  if (intent.action === "ARBITRARY_CALL") {
    extra.push(`Target:       ${intent.target}`)
    extra.push(`CallData:     ${intent.callData}`)
    extra.push(`ETH Value:    ${intent.ethValue ?? "0"} wei`)
    extra.push(`Set target = "${intent.target}", callData = "${intent.callData}", ethValue = "${intent.ethValue ?? "0"}".`)
  }

  extra.push(`Set intentHash = "${intent.nonce}".`)
  extra.push(`Set deadline = ${deadlineTs}.`)

  return base + "\n\n" + extra.join("\n")
}
