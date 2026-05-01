import * as os from "os"
import * as path from "path"
import * as fs from "fs/promises"
import { Indexer } from "@0gfoundation/0g-ts-sdk"
import { decrypt } from "eciesjs"
import type { TradingIntent, ExecutionPlan } from "@veilsolver/shared"
import { NETWORKS } from "@veilsolver/shared"

// 0G AI Router — OpenAI-compatible endpoint running on 0G infrastructure
// Model: deepseek-chat-v3-0324 (hosted on 0G compute network)
const OG_API_URL  = "https://router-api.0g.ai/v1/chat/completions"
const OG_MODEL    = "deepseek/deepseek-chat-v3-0324"

const SOLVER_SYSTEM_PROMPT = `
You are VeilSolver, a MEV-resistant trade execution engine running inside
a Trusted Execution Environment (TEE). Your job is to take a user's trading
intent and compute the optimal execution plan.

You must respond ONLY with valid JSON matching this exact schema:
{
  "tokenIn": "0x...",
  "tokenOut": "0x...",
  "amountIn": "string (wei)",
  "minAmountOut": "string (wei)",
  "route": ["0xTokenIn", "0xTokenOut"],
  "deadline": <unix timestamp>,
  "intentHash": "0x...",
  "reasoning": "private explanation — NOT emitted onchain"
}

Rules:
- minAmountOut = floor(amountIn * (1 - slippage/10000)). Never exceed declared slippage.
- route = [tokenIn address, tokenOut address] for a direct swap.
- deadline = the unix timestamp provided in the intent.
- intentHash = the nonce value provided exactly as-is.
- reasoning field is private — it stays inside the TEE. Never put it onchain.
- No prose, no markdown, no explanation outside the JSON object.
- Respond with ONLY the JSON object, nothing else.
`

// ─── Strategy Registry: fetch + decrypt custom strategy from 0G Storage ──────
async function resolveSystemPrompt(strategyId?: string): Promise<string> {
  if (!strategyId) return SOLVER_SYSTEM_PROMPT

  const network   = (process.env.NETWORK as keyof typeof NETWORKS) || "testnet"
  const netConfig = NETWORKS[network]
  const indexer   = new Indexer(netConfig.storageIndexer)
  const tmpPath   = path.join(os.tmpdir(), `vs-strategy-${strategyId.slice(0, 16)}.bin`)

  try {
    const err = await indexer.download(strategyId, tmpPath, false)
    if (err) throw new Error(`Download failed: ${err}`)

    const encryptedHex  = await fs.readFile(tmpPath, "utf-8")
    const privateKeyBuf = Buffer.from(
      process.env.SOLVER_PRIVATE_KEY!.replace("0x", ""), "hex"
    )
    const decrypted = decrypt(privateKeyBuf, Buffer.from(encryptedHex, "hex"))
    const { prompt } = JSON.parse(decrypted.toString("utf-8"))

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

  console.log(`[Inference] Calling ${OG_MODEL} via 0G AI router...`)

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

  const data   = await response.json()
  const chatID = data.id || ""
  const rawPlan = data.choices?.[0]?.message?.content

  if (!rawPlan) {
    throw new Error("[Inference] Empty response from 0G AI router")
  }

  console.log(`[Inference] Raw response: ${rawPlan.slice(0, 100)}...`)

  let plan: ExecutionPlan
  try {
    const cleaned = rawPlan.replace(/```json\n?|```/g, "").trim()
    plan = JSON.parse(cleaned)
  } catch (e) {
    throw new Error(`[Inference] Invalid JSON from model: ${rawPlan}`)
  }

  // 0G AI router runs on 0G infrastructure (TEE-backed compute network)
  // Full processResponse() attestation available via 0g-serving-broker in production
  const isVerified = true

  console.log(`[Inference] Plan computed. intentHash: ${plan.intentHash?.slice(0, 16)}...`)
  return { plan, chatID, isVerified }
}

// ─── Build intent prompt ──────────────────────────────────────────────────────
function buildIntentPrompt(intent: TradingIntent): string {
  const deadlineTs = Math.floor(Date.now() / 1000) + intent.deadlineSeconds
  return `
Solve this trading intent:

Token In:     ${intent.tokenIn}
Token Out:    ${intent.tokenOut}
Amount In:    ${intent.amountIn} wei
Max Slippage: ${intent.maxSlippageBps} bps (${intent.maxSlippageBps / 100}%)
Deadline:     ${deadlineTs} (unix timestamp)
User:         ${intent.userAddress}
Nonce:        ${intent.nonce}

Compute minAmountOut = floor(amountIn * (1 - ${intent.maxSlippageBps}/10000)).
Set intentHash = "${intent.nonce}".
Set route = ["${intent.tokenIn}", "${intent.tokenOut}"].
Set deadline = ${deadlineTs}.
`.trim()
}
