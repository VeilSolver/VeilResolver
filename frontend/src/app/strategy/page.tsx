"use client"

import { useState } from "react"
import { uploadStrategy } from "veilsolver-sdk"
import Nav from "../components/Nav"
import CTAFooter from "../components/CTAFooter"

const API_URL       = process.env.NEXT_PUBLIC_SOLVER_API   ?? "http://localhost:4000"
const SOLVER_PUBKEY = process.env.NEXT_PUBLIC_SOLVER_PUBKEY ?? ""

const PLACEHOLDER_PROMPT = `You are a conservative DeFi execution optimizer.
Rules:
- Always set minAmountOut conservatively — prefer lower risk over maximising output.
- Never route through more than 2 pools.
- If slippage tolerance is below 0.3%, reject the trade with a clear message.
- Prefer stable → volatile routes over volatile → stable.
- Compute minAmountOut as: expectedOut * (1 - slippage) * 0.998 (extra 0.2% buffer).
Output valid JSON only. No markdown. No explanation outside the JSON.`

const HOW_IT_WORKS = [
  {
    num: "01",
    title: "Write your strategy prompt",
    desc: "Define custom execution rules for the AI solver — routing preferences, risk limits, slippage buffers.",
  },
  {
    num: "02",
    title: "Encrypted client-side",
    desc: "ECIES encrypted with the solver's enclave public key before it leaves your browser. The server never sees plaintext.",
  },
  {
    num: "03",
    title: "Stored on 0G Storage",
    desc: "Uploaded as an encrypted blob. Returns a root hash (strategyId) — the retrieval key. Only the TEE can decrypt it.",
  },
]

export default function StrategyPage() {
  const [prompt,     setPrompt]     = useState("")
  const [uploading,  setUploading]  = useState(false)
  const [error,      setError]      = useState("")
  const [strategyId, setStrategyId] = useState("")
  const [copied,     setCopied]     = useState(false)

  async function handleUpload() {
    if (!prompt.trim() || uploading) return
    setUploading(true)
    setError("")
    setStrategyId("")
    try {
      const id = await uploadStrategy({
        prompt,
        solverPublicKey: SOLVER_PUBKEY,
        apiUrl:          API_URL,
      })
      setStrategyId(id)
    } catch (e: any) {
      setError(e.message ?? "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(strategyId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={S.root}>
      <Nav />

      {/* ── Dark hero header ─────────────────────────────────────────────── */}
      <div style={S.hero} className="vs-hero-section">
        <div style={S.heroInner}>
          <div style={S.heroBadge}>STRATEGY REGISTRY</div>
          <h1 style={S.heroTitle}>Upload Strategy</h1>
          <p style={S.heroSub}>
            Private system prompts. Encrypted before they leave your browser.
            Only the TEE can decrypt and use them — the operator never sees plaintext.
          </p>
        </div>
      </div>

      <main style={S.main}>
        <div style={S.mainInner} className="vs-main-inner">
          <div style={S.layout} className="vs-strategy-grid">

            {/* ── Left column: how it works ──────────────────────────────── */}
            <div style={S.sidebar}>
              <div style={S.sideCard}>
                <div style={S.sideCardTitle}>HOW IT WORKS</div>
                <div style={S.stepsCol}>
                  {HOW_IT_WORKS.map((step, i) => (
                    <div key={step.num} style={S.miniStep}>
                      <div style={S.miniStepNum}>{step.num}</div>
                      <div style={S.miniStepBody}>
                        <div style={S.miniStepTitle}>{step.title}</div>
                        <div style={S.miniStepDesc}>{step.desc}</div>
                      </div>
                      {i < HOW_IT_WORKS.length - 1 && <div style={S.miniStepLine} />}
                    </div>
                  ))}
                </div>
              </div>

              {/* Usage tip */}
              <div style={S.usageCard}>
                <div style={S.sideCardTitle}>USING A STRATEGY</div>
                <p style={S.usageText}>
                  After uploading, copy the <span style={S.usageHighlight}>Strategy ID</span> and paste it
                  into the optional field on the Demo page. The TEE will fetch your encrypted strategy,
                  decrypt it inside the enclave, and use it as the system prompt for that trade.
                </p>
                <div style={S.usageStep}>
                  <span style={S.usageArrow}>→</span>
                  <span>Upload strategy here → get strategyId</span>
                </div>
                <div style={S.usageStep}>
                  <span style={S.usageArrow}>→</span>
                  <span>Paste into Demo page &quot;Strategy ID&quot; field</span>
                </div>
                <div style={S.usageStep}>
                  <span style={S.usageArrow}>→</span>
                  <span>TEE decrypts &amp; uses your custom rules</span>
                </div>
              </div>
            </div>

            {/* ── Right column: upload card ──────────────────────────────── */}
            <div style={S.uploadCol}>
              <div style={S.card}>
                <div style={S.cardInner}>
                  <div style={S.cardHeader}>
                    <span style={S.cardTitle}>Upload Strategy</span>
                    <span style={S.privatePill}>ECIES ENCRYPTED</span>
                  </div>

                  <div style={S.fieldGroup}>
                    <label style={S.fieldLabel}>SYSTEM PROMPT</label>
                    <textarea
                      style={S.textarea}
                      value={prompt}
                      onChange={e => setPrompt(e.target.value)}
                      placeholder={PLACEHOLDER_PROMPT}
                      rows={12}
                    />
                    <div style={S.charCount}>
                      {prompt.length} chars
                    </div>
                  </div>

                  <button
                    className={!uploading && prompt.trim() ? "solve-btn-idle" : ""}
                    style={uploading ? S.btnRunning : !prompt.trim() ? S.btnDisabled : S.btnPrimary}
                    onClick={handleUpload}
                    disabled={!prompt.trim() || uploading}
                  >
                    {uploading ? (
                      <><span className="spinner" style={{ fontSize: 16 }}>◌</span> Encrypting &amp; uploading…</>
                    ) : (
                      <><span style={{ fontSize: 16 }}>⬡</span> Upload Strategy</>
                    )}
                  </button>

                  {error && (
                    <div style={S.errorBox}>
                      <span style={{ flexShrink: 0 }}>⚠</span> {error}
                    </div>
                  )}

                  {/* Success state */}
                  {strategyId && (
                    <div className="result-card" style={S.successCard}>
                      <div style={S.successHeader}>
                        <span style={S.successTitle}>✓ Strategy Uploaded</span>
                        <span style={S.successBadge}>STORED ON 0G</span>
                      </div>

                      <div style={S.fieldLabel}>STRATEGY ID (0G STORAGE ROOT HASH)</div>
                      <div style={S.idBox} onClick={handleCopy} title="Click to copy">
                        <span style={S.idText}>{strategyId}</span>
                        <span style={copied ? S.copyDone : S.copyHint}>
                          {copied ? "✓ copied" : "copy"}
                        </span>
                      </div>

                      <div style={S.successNote}>
                        This ID is your strategy&apos;s retrieval key. It&apos;s public-safe —
                        the blob is ECIES encrypted, only the TEE can decrypt it.
                        Paste it into the Demo page to activate your strategy.
                      </div>
                    </div>
                  )}

                  <div style={S.privacyNote}>
                    <span style={{ fontSize: 11, flexShrink: 0 }}>🔒</span>
                    Encrypted with ECIES before upload · stored on 0G Storage · only TEE decrypts
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>

      {/* ── CTA Footer ──────────────────────────────────────────────────────── */}
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
    maxWidth: 1040,
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
    maxWidth: 560,
  },

  // ── Main content ───────────────────────────────────────────────────────────
  main: {
    background: "#f8f5ee",
    width: "100%",
  },
  mainInner: {
    maxWidth: 1040,
    margin: "0 auto",
    padding: "40px 64px 80px",
  },

  layout: {
    display: "grid",
    gridTemplateColumns: "320px 1fr",
    gap: 24,
    alignItems: "start",
  },
  sidebar: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },

  // Side cards
  sideCard: {
    background: "#ffffff",
    border: "1px solid rgba(0,0,0,0.07)",
    borderRadius: 14,
    boxShadow: "0 2px 16px rgba(0,0,0,0.05)",
    padding: "20px 20px 24px",
  },
  sideCardTitle: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "2px",
    color: "#7c3aed",
    marginBottom: 18,
  },
  stepsCol: {
    display: "flex",
    flexDirection: "column",
    gap: 0,
  },
  miniStep: {
    position: "relative",
    display: "flex",
    gap: 12,
    paddingBottom: 20,
  },
  miniStepNum: {
    fontSize: 10,
    fontWeight: 700,
    color: "#7c3aed",
    background: "rgba(124,58,237,0.06)",
    border: "1px solid rgba(124,58,237,0.18)",
    borderRadius: 4,
    padding: "2px 7px",
    letterSpacing: "0.5px",
    height: "fit-content",
    flexShrink: 0,
    marginTop: 2,
  },
  miniStepBody: {
    flex: 1,
  },
  miniStepTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: "#111111",
    marginBottom: 5,
  },
  miniStepDesc: {
    fontSize: 11,
    color: "rgba(17,17,17,0.45)",
    lineHeight: 1.6,
  },
  miniStepLine: {
    position: "absolute",
    left: 22,
    bottom: 0,
    width: 1,
    height: 16,
    background: "rgba(124,58,237,0.15)",
  },

  // Usage card
  usageCard: {
    background: "#ffffff",
    border: "1px solid rgba(0,0,0,0.07)",
    borderRadius: 14,
    boxShadow: "0 2px 16px rgba(0,0,0,0.05)",
    padding: "20px 20px 22px",
  },
  usageText: {
    fontSize: 12,
    color: "rgba(17,17,17,0.45)",
    lineHeight: 1.65,
    marginBottom: 16,
  },
  usageHighlight: {
    color: "#7c3aed",
    fontWeight: 600,
  },
  usageStep: {
    display: "flex",
    gap: 8,
    alignItems: "flex-start",
    fontSize: 11,
    color: "rgba(17,17,17,0.5)",
    marginBottom: 8,
    lineHeight: 1.5,
  },
  usageArrow: {
    color: "#7c3aed",
    flexShrink: 0,
  },

  // Upload card
  uploadCol: {},
  card: {
    background: "#ffffff",
    border: "1px solid rgba(0,0,0,0.07)",
    borderRadius: 14,
    boxShadow: "0 2px 16px rgba(0,0,0,0.05)",
    overflow: "hidden",
  },
  cardInner:  { padding: "24px 28px 28px" },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  cardTitle: { fontSize: 15, fontWeight: 700, color: "#111111" },
  privatePill: {
    fontSize: 10, fontWeight: 700, letterSpacing: "1px",
    color: "#7c3aed", background: "rgba(124,58,237,0.06)",
    border: "1px solid rgba(124,58,237,0.18)", padding: "3px 9px", borderRadius: 3,
  },

  // Field
  fieldGroup: { marginBottom: 16, position: "relative" },
  fieldLabel: {
    display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "1.5px",
    color: "rgba(17,17,17,0.4)", marginBottom: 8,
  },
  textarea: {
    width: "100%", background: "#ffffff", color: "#111111",
    border: "1px solid rgba(0,0,0,0.12)", borderRadius: 8,
    padding: "14px 16px", fontSize: 12, lineHeight: 1.65,
    fontFamily: "var(--font-mono), 'IBM Plex Mono', monospace",
    outline: "none", resize: "vertical" as const, minHeight: 200,
    boxSizing: "border-box" as const,
  },
  charCount: {
    fontSize: 10,
    color: "rgba(17,17,17,0.3)",
    marginTop: 6,
    textAlign: "right" as const,
  },

  // Buttons
  btnPrimary: {
    width: "100%", marginTop: 8, padding: "14px",
    background: "#111111",
    color: "#fff", border: "1px solid rgba(0,0,0,0.2)",
    borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 700,
    fontFamily: "var(--font-mono), monospace", letterSpacing: "0.3px",
    boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
  },
  btnRunning: {
    width: "100%", marginTop: 8, padding: "14px",
    background: "rgba(17,17,17,0.4)", color: "rgba(17,17,17,0.3)",
    border: "1px solid rgba(0,0,0,0.1)", borderRadius: 8,
    cursor: "not-allowed", fontSize: 14, fontWeight: 700,
    fontFamily: "var(--font-mono), monospace",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
  },
  btnDisabled: {
    width: "100%", marginTop: 8, padding: "14px",
    background: "rgba(17,17,17,0.04)", color: "rgba(17,17,17,0.2)",
    border: "1px solid rgba(0,0,0,0.05)", borderRadius: 8,
    cursor: "not-allowed", fontSize: 14, fontWeight: 600,
    fontFamily: "var(--font-mono), monospace",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
  },

  // Error
  errorBox: {
    marginTop: 12, background: "rgba(220,38,38,0.05)",
    border: "1px solid rgba(220,38,38,0.2)", borderRadius: 6,
    padding: "10px 14px", fontSize: 12, color: "#dc2626",
    display: "flex", gap: 8, alignItems: "flex-start",
  },

  // Success
  successCard: {
    marginTop: 16,
    background: "#ffffff",
    border: "1px solid rgba(22,163,74,0.2)", borderRadius: 10,
    padding: "18px 20px",
  },
  successHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  successTitle:  { fontSize: 14, fontWeight: 700, color: "#16a34a" },
  successBadge: {
    fontSize: 10, fontWeight: 700, letterSpacing: "1px",
    color: "#16a34a", background: "rgba(22,163,74,0.07)",
    border: "1px solid rgba(22,163,74,0.2)", padding: "2px 8px", borderRadius: 3,
  },
  idBox: {
    marginTop: 8, marginBottom: 12,
    background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.18)",
    borderRadius: 6, padding: "10px 14px", fontSize: 11,
    color: "#5b21b6", wordBreak: "break-all" as const,
    cursor: "pointer", display: "flex", justifyContent: "space-between",
    alignItems: "flex-start", gap: 12,
  },
  idText: { flex: 1, lineHeight: 1.5 },
  copyHint: {
    fontSize: 10, color: "rgba(124,58,237,0.45)", flexShrink: 0,
    marginTop: 1, textTransform: "uppercase" as const, letterSpacing: "0.5px",
  },
  copyDone: {
    fontSize: 10, color: "#16a34a", flexShrink: 0,
    marginTop: 1, textTransform: "uppercase" as const, letterSpacing: "0.5px",
  },
  successNote: {
    fontSize: 11,
    color: "rgba(17,17,17,0.4)",
    lineHeight: 1.6,
  },

  // Privacy
  privacyNote: {
    marginTop: 18, fontSize: 10, color: "rgba(17,17,17,0.3)",
    lineHeight: 1.5, letterSpacing: "0.3px",
    display: "flex", gap: 6, alignItems: "flex-start",
  },

}
