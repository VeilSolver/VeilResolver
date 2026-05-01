import type { TradingIntent, SolveResponse } from "@veilsolver/shared"
import { SolverAPIError } from "./errors"

export async function callSolverAPI(
  intent: TradingIntent,
  encryptedIntent: string,
  apiUrl: string
): Promise<SolveResponse> {
  const res = await fetch(`${apiUrl}/solve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ intent, encryptedIntent })
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new SolverAPIError(res.status, err.error || `Solver API error: ${res.status}`)
  }

  return res.json()
}
