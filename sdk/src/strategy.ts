import { encryptIntent } from "./encrypt"
import { StrategyError } from "./errors"

// Strategy prompt is encrypted client-side with solver public key before upload.
// The solver API receives only the encrypted blob — never sees plaintext.
// Only the TEE (holding the solver private key) can decrypt and use the strategy.

export async function uploadStrategy(params: {
  prompt: string
  solverPublicKey: string  // hex compressed secp256k1
  apiUrl: string
}): Promise<string> {
  let encryptedPrompt: string
  try {
    encryptedPrompt = await encryptIntent({ prompt: params.prompt }, params.solverPublicKey)
  } catch (e: any) {
    throw new StrategyError(`Encryption failed: ${e.message}`)
  }

  const res = await fetch(`${params.apiUrl}/strategy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ encryptedPrompt })
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new StrategyError(err.error || `Strategy upload failed: ${res.status}`)
  }

  const { strategyId } = await res.json()
  return strategyId
}
