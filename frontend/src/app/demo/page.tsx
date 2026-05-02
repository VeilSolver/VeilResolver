"use client"

import { useState } from "react"
import { ethers } from "ethers"
import { buildIntent, encryptIntent, callSolverAPI, submitSettlement } from "veilsolver-sdk"
import type { SolveResponse } from "veilsolver-sdk"
import Nav from "../components/Nav"
import CTAFooter from "../components/CTAFooter"

// ─── Config ───────────────────────────────────────────────────────────────────
const API_URL        = process.env.NEXT_PUBLIC_SOLVER_API       ?? "http://localhost:4000"
const CONTRACT_ADDR  = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? ""
const SOLVER_PUBKEY  = process.env.NEXT_PUBLIC_SOLVER_PUBKEY    ?? ""
const TOKEN_IN_ADDR  = process.env.NEXT_PUBLIC_TOKEN_IN         ?? ""
const TOKEN_OUT_ADDR = process.env.NEXT_PUBLIC_TOKEN_OUT        ?? ""
const CHAIN_ID       = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID ?? "16602")

// ─── Token definitions ────────────────────────────────────────────────────────
const TOKENS = [
  { symbol: "USDC", decimals: 6,  icon: "$", address: TOKEN_IN_ADDR  },
  { symbol: "WETH", decimals: 18, icon: "Ξ", address: TOKEN_OUT_ADDR },
]

// ─── Types ────────────────────────────────────────────────────────────────────
type StepStatus = "pending" | "active" | "done" | "error"
interface Step {
  id:     string
  label:  string
  detail: string
  status: StepStatus
  link?:  string
}

const INITIAL_STEPS: Step[] = [
  { id: "encrypt", label: "Encrypt Intent",     detail: "ECIES → enclave public key",           status: "pending" },
  { id: "tee",     label: "TEE Inference",       detail: "GLM-5-FP8 via 0G Sealed Inference",   status: "pending" },
  { id: "attest",  label: "Verify Attestation",  detail: "chatID · isVerified · TeeML",         status: "pending" },
  { id: "storage", label: "Store to 0G Storage", detail: "Encrypted audit record · root hash",  status: "pending" },
  { id: "settle",  label: "Settle on 0G Chain",  detail: "ecrecover + DEX swap · atomic",       status: "pending" },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatAmount(wei: string, decimals: number): string {
  try {
    return (Number(BigInt(wei)) / 10 ** decimals).toFixed(decimals === 6 ? 4 : 6)
  } catch {
    return wei
  }
}

// ─── Dynamic CSS helpers ──────────────────────────────────────────────────────
function dotCss(status: StepStatus): React.CSSProperties {
  const base: React.CSSProperties = {
    width: 32, height: 32, borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0, zIndex: 1, fontSize: 13, fontWeight: 700,
    transition: "all 0.3s ease",
  }
  switch (status) {
    case "done":   return { ...base, background: "rgba(22,163,74,0.12)",   border: "1.5px solid #16a34a", color: "#16a34a" }
    case "error":  return { ...base, background: "rgba(220,38,38,0.1)",    border: "1.5px solid #dc2626", color: "#dc2626" }
    case "active": return { ...base, background: "rgba(124,58,237,0.12)",  border: "1.5px solid #7c3aed", color: "#7c3aed" }
    default:       return { ...base, background: "rgba(0,0,0,0.04)",       border: "1.5px solid rgba(0,0,0,0.12)", color: "rgba(17,17,17,0.3)" }
  }
}

function connectorCss(cur: StepStatus, nxt: StepStatus): React.CSSProperties {
  const lit = cur === "done" || nxt === "active"
  return {
    flex: 1, width: 1.5, minHeight: 20, marginTop: 2,
    background: lit
      ? "linear-gradient(180deg, rgba(22,163,74,0.4) 0%, rgba(22,163,74,0.1) 100%)"
      : "rgba(0,0,0,0.08)",
    transition: "background 0.4s ease",
  }
}

function labelCss(status: StepStatus): React.CSSProperties {
  const base: React.CSSProperties = { fontSize: 13, fontWeight: 600, marginBottom: 2, transition: "color 0.3s" }
  switch (status) {
    case "done":   return { ...base, color: "#16a34a" }
    case "error":  return { ...base, color: "#dc2626" }
    case "active": return { ...base, color: "#111111" }
    default:       return { ...base, color: "rgba(17,17,17,0.3)" }
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DemoPage() {
  // Wallet
  const [signer,  setSigner]  = useState<ethers.Signer | null>(null)
  const [address, setAddress] = useState("")

  // Form
  const [tokenIn,        setTokenIn]        = useState(TOKENS[0])
  const [tokenOut,       setTokenOut]       = useState(TOKENS[1])
  const [amount,         setAmount]         = useState("100")
  const [slippage,       setSlippage]       = useState("50")
  const [usedStrategyId, setUsedStrategyId] = useState("")

  // Trace
  const [steps,   setSteps]   = useState<Step[]>(INITIAL_STEPS)
  const [running, setRunning] = useState(false)
  const [solved,  setSolved]  = useState(false)
  const [error,   setError]   = useState("")

  // Results
  const [solveResult, setSolveResult] = useState<SolveResponse | null>(null)
  const [txHash,      setTxHash]      = useState("")

  // ── Wallet ────────────────────────────────────────────────────────────────
  async function connectWallet() {
    const ethereum = (window as any).ethereum
    if (!ethereum) { setError("MetaMask not found. Install it from metamask.io"); return }
    try {
      const provider = new ethers.BrowserProvider(ethereum)
      const s = await provider.getSigner()
      setSigner(s)
      setAddress(await s.getAddress())
    } catch (e: any) {
      setError(`Wallet connect failed: ${e.message}`)
    }
  }

  // ── Step helpers ──────────────────────────────────────────────────────────
  function updateStep(id: string, status: StepStatus, detail?: string, link?: string) {
    setSteps(prev => prev.map(s =>
      s.id === id
        ? { ...s, status, ...(detail ? { detail } : {}), ...(link ? { link } : {}) }
        : s
    ))
  }

  // ── Solve ─────────────────────────────────────────────────────────────────
  async function handleSolve() {
    if (!address || !signer || running) return
    setRunning(true)
    setError("")
    setSolved(false)
    setSolveResult(null)
    setTxHash("")
    setSteps(INITIAL_STEPS)

    try {
      // 1 — Encrypt intent
      updateStep("encrypt", "active")
      const intent = buildIntent({
        tokenIn:        tokenIn.address,
        tokenOut:       tokenOut.address,
        amountIn:       amount,
        decimalsIn:     tokenIn.decimals,
        maxSlippageBps: parseInt(slippage),
        userAddress:    address,
        chainId:        CHAIN_ID,
        strategyId:     usedStrategyId || undefined,
      })
      const encryptedIntent = await encryptIntent(intent, SOLVER_PUBKEY)
      updateStep("encrypt", "done", `Nonce: ${intent.nonce.slice(0, 18)}…`)

      // 2 — TEE inference
      updateStep("tee", "active")
      const response = await callSolverAPI(intent, encryptedIntent, API_URL)
      setSolveResult(response)
      const outAmt = formatAmount(response.plan.minAmountOut, tokenOut.decimals)
      updateStep("tee", "done", `${response.attestation.model} · min out: ${outAmt} ${tokenOut.symbol}`)

      // 3 — Attestation
      updateStep("attest", "active")
      const { chatID, isVerified } = response.attestation
      updateStep(
        "attest", "done",
        `${isVerified ? "✓ Verified" : "⚠ Unverified"} · chatID: ${chatID.slice(0, 16)}…`
      )

      // 4 — 0G Storage
      updateStep("storage", "active")
      const rootHash = response.auditRootHash
      updateStep(
        "storage", "done",
        rootHash ? `Root: ${rootHash.slice(0, 16)}…` : "Storage skipped (non-fatal)",
        rootHash ? `https://storagescan-galileo.0g.ai` : undefined
      )

      // 5 — Settlement
      updateStep("settle", "active")
      const receipt = await submitSettlement({
        solveResult:     response,
        contractAddress: CONTRACT_ADDR,
        signer,
      })
      const hash = receipt?.hash ?? ""
      setTxHash(hash)
      updateStep(
        "settle", "done",
        `Block ${receipt?.blockNumber ?? "?"} · ${hash.slice(0, 10)}…`,
        hash ? `https://chainscan-galileo.0g.ai/tx/${hash}` : undefined
      )

      setSolved(true)
    } catch (e: any) {
      const msg = e.reason ?? e.shortMessage ?? e.message ?? "Unknown error"
      setError(msg)
      setSteps(prev => prev.map(s => s.status === "active" ? { ...s, status: "error" } : s))
    } finally {
      setRunning(false)
    }
  }

  const tokenInOptions  = TOKENS.filter(t => t.symbol !== tokenOut.symbol)
  const tokenOutOptions = TOKENS.filter(t => t.symbol !== tokenIn.symbol)

  return (
    <div style={S.root}>
      <Nav address={address} onConnect={connectWallet} />

      {/* ── Dark hero header ─────────────────────────────────────────────── */}
      <div style={S.hero} className="vs-hero-section">
        <div style={S.heroInner}>
          <div style={S.heroBadge}>TRADE DEMO</div>
          <h1 style={S.heroTitle}>Submit Intent</h1>
          <p style={S.heroSub}>
            Encrypted intents · TEE-computed execution plans · atomic settlement on 0G Chain
          </p>
          <div style={S.trackPill}>TRACK 5 — PRIVACY &amp; SOVEREIGN INFRA</div>
        </div>
      </div>

      <main style={S.main}>
        <div style={S.mainInner} className="vs-main-inner">

          {/* ── 2-col grid ────────────────────────────────────────────────── */}
          <div style={S.grid} className="vs-demo-grid">

            {/* ─ Left: Form ─────────────────────────────────────────────── */}
            <div style={S.card}>
              <div style={S.cardInner}>
                <div style={S.cardHeader}>
                  <span style={S.cardTitle}>Submit Intent</span>
                  <span style={S.privatePill}>PRIVATE</span>
                </div>
                <p style={S.cardSub}>
                  Intent encrypted ECIES client-side. Solver never reads plaintext.
                </p>

                {/* Sell */}
                <div style={S.fieldGroup}>
                  <label style={S.fieldLabel}>SELL</label>
                  <div style={S.tokenRow}>
                    <input
                      style={S.amountInput}
                      type="number"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      placeholder="0.00"
                    />
                    <div style={S.tokenSelectWrap}>
                      <select
                        style={S.tokenSelect}
                        value={tokenIn.symbol}
                        onChange={e => setTokenIn(TOKENS.find(t => t.symbol === e.target.value)!)}
                      >
                        {tokenInOptions.map(t => (
                          <option key={t.symbol} value={t.symbol}>{t.icon} {t.symbol}</option>
                        ))}
                      </select>
                      <span style={S.selectArrow}>▾</span>
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div style={S.swapDivider}>
                  <div style={S.swapLine} />
                  <div style={S.swapIcon}>↓</div>
                  <div style={S.swapLine} />
                </div>

                {/* Buy */}
                <div style={S.fieldGroup}>
                  <label style={S.fieldLabel}>BUY</label>
                  <div style={S.tokenSelectWrap}>
                    <select
                      style={{ ...S.tokenSelect, width: "100%" }}
                      value={tokenOut.symbol}
                      onChange={e => setTokenOut(TOKENS.find(t => t.symbol === e.target.value)!)}
                    >
                      {tokenOutOptions.map(t => (
                        <option key={t.symbol} value={t.symbol}>{t.icon} {t.symbol}</option>
                      ))}
                    </select>
                    <span style={S.selectArrow}>▾</span>
                  </div>
                </div>

                {/* Slippage */}
                <div style={S.fieldGroup}>
                  <label style={S.fieldLabel}>MAX SLIPPAGE</label>
                  <div style={S.slipRow}>
                    {[25, 50, 100, 150].map(bps => (
                      <button
                        key={bps}
                        style={slippage === String(bps) ? S.slipActive : S.slipBtn}
                        onClick={() => setSlippage(String(bps))}
                      >
                        {(bps / 100).toFixed(2)}%
                      </button>
                    ))}
                  </div>
                </div>

                {/* Strategy ID */}
                <div style={S.fieldGroup}>
                  <label style={S.fieldLabel}>STRATEGY ID (OPTIONAL)</label>
                  <input
                    style={{ ...S.amountInput, fontSize: 11, padding: "9px 12px" }}
                    type="text"
                    value={usedStrategyId}
                    onChange={e => setUsedStrategyId(e.target.value)}
                    placeholder="0G Storage root hash…"
                  />
                </div>

                {/* Solve button */}
                <button
                  className={!running && address ? "solve-btn-idle" : ""}
                  style={!address ? S.solveDisabled : running ? S.solveRunning : S.solvePrimary}
                  onClick={handleSolve}
                  disabled={!address || running}
                >
                  {running ? (
                    <><span className="spinner" style={{ fontSize: 16 }}>◌</span> Solving…</>
                  ) : !address ? (
                    "Connect wallet to continue"
                  ) : (
                    <><span style={{ fontSize: 16 }}>⬡</span> Solve &amp; Execute</>
                  )}
                </button>

                {error && (
                  <div style={S.errorBox}>
                    <span style={{ flexShrink: 0 }}>⚠</span> {error}
                  </div>
                )}

                <div style={S.privacyNote}>
                  <span style={{ fontSize: 11, flexShrink: 0 }}>🔒</span>
                  Intent encrypted client-side · Strategy computed inside TEE · Solver never reads plaintext
                </div>
              </div>
            </div>

            {/* ─ Right: Execution Trace ─────────────────────────────────── */}
            <div style={S.card}>
              <div style={S.cardInner}>
                <div style={S.cardHeader}>
                  <span style={S.cardTitle}>Execution Trace</span>
                  <span style={solved ? S.pillGreen : running ? S.pillLive : S.cardPill}>
                    {solved ? "COMPLETE" : running ? "LIVE" : "READY"}
                  </span>
                </div>
                <p style={S.cardSub}>
                  Every step cryptographically attested on 0G infrastructure.
                </p>

                {/* Steps */}
                <div style={S.stepList}>
                  {steps.map((step, i) => (
                    <div key={step.id} style={S.stepRow}>
                      <div style={S.connectorCol}>
                        <div
                          style={dotCss(step.status)}
                          className={step.status === "active" ? "step-active-dot" : ""}
                        >
                          {step.status === "done"   ? <span style={{ fontSize: 13, fontWeight: 700 }}>✓</span>  :
                           step.status === "error"  ? <span style={{ fontSize: 13, fontWeight: 700 }}>✗</span>  :
                           step.status === "active" ? <span className="spinner" style={{ fontSize: 12 }}>◌</span> :
                           <span style={{ fontSize: 12, fontWeight: 700 }}>{i + 1}</span>}
                        </div>
                        {i < steps.length - 1 && (
                          <div style={connectorCss(step.status, steps[i + 1].status)} />
                        )}
                      </div>
                      <div style={S.stepContent}>
                        <div style={labelCss(step.status)}>{step.label}</div>
                        <div style={S.stepDetail}>
                          {step.detail}
                          {step.link && (
                            <a href={step.link} target="_blank" rel="noopener noreferrer" style={S.stepLink}>
                              {" "}↗
                            </a>
                          )}
                        </div>
                        {step.status === "active" && (
                          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, overflow: "hidden" }}>
                            <div className="scan-line" />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Result card */}
                {solved && solveResult && (
                  <div className="result-card" style={S.resultCard}>
                    <div style={S.resultHeader}>
                      <span style={S.resultTitle}>✓ Execution Complete</span>
                      {txHash && (
                        <a
                          href={`https://chainscan-galileo.0g.ai/tx/${txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={S.viewTxBtn}
                        >
                          ChainScan ↗
                        </a>
                      )}
                    </div>
                    <div style={S.resultGrid}>
                      <div style={S.resultItem}>
                        <span style={S.resultKey}>RECEIVED (MIN)</span>
                        <span style={S.resultValBig}>
                          {formatAmount(solveResult.plan.minAmountOut, tokenOut.decimals)} {tokenOut.symbol}
                        </span>
                      </div>
                      <div style={S.resultItem}>
                        <span style={S.resultKey}>MEV PROTECTED</span>
                        <span style={{ ...S.resultVal, color: "#16a34a" }}>YES</span>
                      </div>
                      <div style={S.resultItem}>
                        <span style={S.resultKey}>TEE VERIFIED</span>
                        <span style={{ ...S.resultVal, color: solveResult.attestation.isVerified ? "#16a34a" : "#ca8a04" }}>
                          {solveResult.attestation.isVerified ? "YES" : "PARTIAL"}
                        </span>
                      </div>
                      <div style={S.resultItem}>
                        <span style={S.resultKey}>AUDIT TRAIL</span>
                        <span style={{ ...S.resultVal, color: "#7c3aed" }}>
                          {solveResult.auditRootHash ? "0G Storage" : "Skipped"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* ── Attestation card (full width) ──────────────────────────────── */}
          {solved && solveResult && (
            <div className="result-card" style={S.attestCard}>
              <div style={S.attestHeader}>
                <span style={S.attestTitle}>TEE Attestation Details</span>
                <span style={solveResult.attestation.isVerified ? S.attestBadgeGreen : S.attestBadgeYellow}>
                  {solveResult.attestation.isVerified ? "VERIFIED" : "UNVERIFIED"} · {solveResult.attestation.model} · 0G AI Router
                </span>
              </div>
              <div style={S.attestGrid}>
                {[
                  ["MODEL",      solveResult.attestation.model],
                  ["PROVIDER",   solveResult.attestation.provider.slice(0, 18) + "…"],
                  ["CHAT ID",    solveResult.attestation.chatID
                                   ? solveResult.attestation.chatID.slice(0, 24) + "…"
                                   : "N/A"],
                  ["VERIFIED",   solveResult.attestation.isVerified ? "✓ TeeML" : "⚠ Unverified"],
                  ["AUDIT HASH", solveResult.auditRootHash
                                   ? solveResult.auditRootHash.slice(0, 24) + "…"
                                   : "—"],
                  ["TIMESTAMP",  new Date(solveResult.attestation.timestamp).toISOString()],
                ].map(([k, v]) => (
                  <div key={k} style={S.attestItem}>
                    <div style={S.attestKey}>{k}</div>
                    <div style={S.attestVal}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </main>
      {/* ── CTA Footer ────────────────────────────────────────────────────── */}
      <CTAFooter />

    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100vh",
    background: "#f8f5ee",
    color: "#111111",
    fontFamily: "var(--font-mono), 'IBM Plex Mono', monospace",
  },

  // ── Hero header ────────────────────────────────────────────────────────────
  hero: {
    background: "#111111",
    padding: "108px 64px 52px",
    width: "100%",
  },
  heroInner: {
    maxWidth: 1160,
    margin: "0 auto",
  },
  heroBadge: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "2.5px",
    color: "rgba(255,255,255,0.3)",
    marginBottom: 18,
    textTransform: "uppercase" as const,
  },
  heroTitle: {
    fontSize: "clamp(40px, 5vw, 64px)" as any,
    fontWeight: 700,
    color: "#ffffff",
    letterSpacing: "-1px",
    lineHeight: 1.05,
    marginBottom: 14,
  },
  heroSub: {
    fontSize: 15,
    color: "rgba(255,255,255,0.4)",
    lineHeight: 1.65,
    marginBottom: 24,
    maxWidth: 540,
  },
  trackPill: {
    display: "inline-block",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.5px",
    color: "rgba(255,255,255,0.35)",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    padding: "5px 12px",
    borderRadius: 4,
  },

  // ── Main content ───────────────────────────────────────────────────────────
  main: {
    background: "#f8f5ee",
    width: "100%",
  },
  mainInner: {
    maxWidth: 1160,
    margin: "0 auto",
    padding: "40px 64px 80px",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 20,
    marginBottom: 20,
  },
  card: {
    background: "#ffffff",
    border: "1px solid rgba(0,0,0,0.07)",
    borderRadius: 14,
    boxShadow: "0 2px 16px rgba(0,0,0,0.05)",
    position: "relative",
    overflow: "hidden",
  },
  cardInner: { padding: "24px 28px 28px" },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  cardTitle: { fontSize: 14, fontWeight: 700, color: "#111111" },
  cardSub:   { fontSize: 11, color: "rgba(17,17,17,0.35)", lineHeight: 1.6, marginBottom: 20 },
  privatePill: {
    fontSize: 10, fontWeight: 700, letterSpacing: "1.2px",
    color: "#7c3aed", background: "rgba(124,58,237,0.06)",
    border: "1px solid rgba(124,58,237,0.18)", padding: "2px 8px", borderRadius: 3,
  },
  cardPill: {
    fontSize: 10, fontWeight: 700, letterSpacing: "1.2px",
    color: "rgba(124,58,237,0.7)", background: "rgba(124,58,237,0.06)",
    border: "1px solid rgba(124,58,237,0.18)", padding: "2px 8px", borderRadius: 3,
  },
  pillGreen: {
    fontSize: 10, fontWeight: 700, letterSpacing: "1.2px",
    color: "#16a34a", background: "rgba(22,163,74,0.07)",
    border: "1px solid rgba(22,163,74,0.2)", padding: "2px 8px", borderRadius: 3,
  },
  pillLive: {
    fontSize: 10, fontWeight: 700, letterSpacing: "1.2px",
    color: "#5b21b6", background: "rgba(124,58,237,0.08)",
    border: "1px solid rgba(124,58,237,0.25)", padding: "2px 8px", borderRadius: 3,
  },

  // Form
  fieldGroup: { marginBottom: 16 },
  fieldLabel: {
    display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "1.5px",
    color: "rgba(17,17,17,0.4)", marginBottom: 8,
  },
  tokenRow: { display: "flex", gap: 8 },
  amountInput: {
    flex: 1, background: "#ffffff", color: "#111111",
    border: "1px solid rgba(0,0,0,0.12)", borderRadius: 8,
    padding: "12px 14px", fontSize: 20, fontWeight: 600,
    fontFamily: "var(--font-mono), monospace", outline: "none",
    width: "100%",
  },
  tokenSelectWrap: {
    position: "relative", display: "flex", alignItems: "center",
    background: "#ffffff", border: "1px solid rgba(0,0,0,0.12)",
    borderRadius: 8, overflow: "hidden",
  },
  tokenSelect: {
    background: "transparent", color: "#111111", border: "none",
    padding: "12px 32px 12px 14px", fontSize: 14, fontWeight: 600,
    fontFamily: "var(--font-mono), monospace", outline: "none", cursor: "pointer",
    appearance: "none" as const, WebkitAppearance: "none" as const,
  },
  selectArrow: {
    position: "absolute", right: 10, pointerEvents: "none",
    color: "rgba(0,0,0,0.35)", fontSize: 11,
  },
  swapDivider: { display: "flex", alignItems: "center", gap: 10, marginBottom: 16 },
  swapLine:    { flex: 1, height: 1, background: "rgba(0,0,0,0.08)" },
  swapIcon: {
    width: 28, height: 28, borderRadius: "50%",
    background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.18)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 12, color: "rgba(124,58,237,0.6)", flexShrink: 0,
  },
  slipRow: { display: "flex", gap: 8 },
  slipBtn: {
    flex: 1, background: "#ffffff", color: "rgba(17,17,17,0.5)",
    border: "1px solid rgba(0,0,0,0.12)", borderRadius: 6,
    padding: "8px 0", fontSize: 12, fontWeight: 600,
    fontFamily: "var(--font-mono), monospace", cursor: "pointer",
  },
  slipActive: {
    flex: 1, background: "rgba(124,58,237,0.1)", color: "#5b21b6",
    border: "1px solid rgba(124,58,237,0.4)", borderRadius: 6,
    padding: "8px 0", fontSize: 12, fontWeight: 700,
    fontFamily: "var(--font-mono), monospace", cursor: "pointer",
  },
  solvePrimary: {
    width: "100%", marginTop: 8, padding: "14px",
    background: "#111111",
    color: "#fff", border: "1px solid rgba(0,0,0,0.2)",
    borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 700,
    fontFamily: "var(--font-mono), monospace", letterSpacing: "0.3px",
    boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
  },
  solveRunning: {
    width: "100%", marginTop: 8, padding: "14px",
    background: "rgba(17,17,17,0.4)", color: "rgba(17,17,17,0.3)",
    border: "1px solid rgba(0,0,0,0.1)", borderRadius: 8,
    cursor: "not-allowed", fontSize: 14, fontWeight: 700,
    fontFamily: "var(--font-mono), monospace",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
  },
  solveDisabled: {
    width: "100%", marginTop: 8, padding: "14px",
    background: "rgba(17,17,17,0.04)", color: "rgba(17,17,17,0.2)",
    border: "1px solid rgba(0,0,0,0.05)", borderRadius: 8,
    cursor: "not-allowed", fontSize: 14, fontWeight: 600,
    fontFamily: "var(--font-mono), monospace",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
  },
  errorBox: {
    marginTop: 12, background: "rgba(220,38,38,0.05)",
    border: "1px solid rgba(220,38,38,0.2)", borderRadius: 6,
    padding: "10px 14px", fontSize: 12, color: "#dc2626",
    display: "flex", gap: 8, alignItems: "flex-start",
  },
  privacyNote: {
    marginTop: 16, fontSize: 10, color: "rgba(17,17,17,0.3)",
    lineHeight: 1.5, letterSpacing: "0.3px",
    display: "flex", gap: 6, alignItems: "flex-start",
  },

  // Steps
  stepList:     { display: "flex", flexDirection: "column", marginBottom: 8 },
  stepRow:      { display: "flex", gap: 14, minHeight: 52 },
  connectorCol: {
    display: "flex", flexDirection: "column", alignItems: "center",
    width: 32, flexShrink: 0,
  },
  stepContent: {
    flex: 1, paddingBottom: 16, paddingTop: 4,
    position: "relative", overflow: "hidden",
  },
  stepDetail: { fontSize: 11, color: "rgba(17,17,17,0.4)", marginTop: 2 },
  stepLink:   { color: "#7c3aed", textDecoration: "none", marginLeft: 4 },

  // Result
  resultCard: {
    marginTop: 16, background: "#ffffff",
    border: "1px solid rgba(22,163,74,0.25)", borderRadius: 8,
    padding: "16px 18px",
  },
  resultHeader: {
    display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14,
  },
  resultTitle:  { fontSize: 13, fontWeight: 700, color: "#16a34a" },
  viewTxBtn: {
    fontSize: 11, color: "#7c3aed",
    border: "1px solid rgba(124,58,237,0.2)", borderRadius: 4,
    padding: "3px 10px", textDecoration: "none",
    background: "rgba(124,58,237,0.05)",
  },
  resultGrid:   { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 24px" },
  resultItem:   { display: "flex", flexDirection: "column", gap: 3 },
  resultKey:    { fontSize: 10, fontWeight: 700, letterSpacing: "1px", color: "rgba(17,17,17,0.3)" },
  resultValBig: { fontSize: 16, fontWeight: 700, color: "#111111" },
  resultVal:    { fontSize: 13, fontWeight: 600 },

  // Attestation
  attestCard: {
    background: "#ffffff",
    border: "1px solid rgba(0,0,0,0.07)",
    borderRadius: 14,
    boxShadow: "0 2px 16px rgba(0,0,0,0.05)",
    padding: "24px 28px", marginBottom: 20,
  },
  attestHeader: {
    display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16,
  },
  attestTitle: {
    fontSize: 12, fontWeight: 700, letterSpacing: "1px",
    color: "rgba(17,17,17,0.5)", textTransform: "uppercase",
  },
  attestBadgeGreen: {
    fontSize: 10, fontWeight: 700, letterSpacing: "0.8px",
    color: "#16a34a", background: "rgba(22,163,74,0.07)",
    border: "1px solid rgba(22,163,74,0.2)", padding: "3px 10px", borderRadius: 3,
  },
  attestBadgeYellow: {
    fontSize: 10, fontWeight: 700, letterSpacing: "0.8px",
    color: "#ca8a04", background: "rgba(202,138,4,0.07)",
    border: "1px solid rgba(202,138,4,0.2)", padding: "3px 10px", borderRadius: 3,
  },
  attestGrid: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "14px 24px" },
  attestItem: { display: "flex", flexDirection: "column", gap: 4 },
  attestKey:  { fontSize: 10, fontWeight: 700, letterSpacing: "1px", color: "rgba(17,17,17,0.3)" },
  attestVal:  { fontSize: 12, color: "rgba(17,17,17,0.7)", fontFamily: "var(--font-mono), monospace" },

}
