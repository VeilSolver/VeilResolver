import Nav from "../components/Nav"

// ─── Code block component ─────────────────────────────────────────────────────
function CodeBlock({ lang, code }: { lang: string; code: string }) {
  return (
    <div style={S.codeWrap}>
      <span style={S.codeLang}>{lang}</span>
      <pre style={S.pre}>
        <code style={S.code}>{code}</code>
      </pre>
    </div>
  )
}

// ─── Section heading ──────────────────────────────────────────────────────────
function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} style={S.sectionTitle}>
      {children}
    </h2>
  )
}

// ─── Function doc row ─────────────────────────────────────────────────────────
function FnDoc({
  name, signature, returns, description
}: { name: string; signature: string; returns: string; description: string }) {
  return (
    <div style={S.fnDoc}>
      <div style={S.fnHeader}>
        <span style={S.fnName}>{name}</span>
        <span style={S.fnReturns}>→ {returns}</span>
      </div>
      <div style={S.fnSig}>{signature}</div>
      <p style={S.fnDesc}>{description}</p>
    </div>
  )
}

// ─── Page (server component — no interactivity needed) ────────────────────────
export default function DocsPage() {
  return (
    <div style={S.root}>
      <Nav />

      <main style={S.main}>
        {/* Page header */}
        <div style={S.pageHeader}>
          <div style={S.pageTitleRow}>
            <h1 style={S.pageTitle}>SDK Documentation</h1>
            <span style={S.versionBadge}>@veilsolver/sdk v0.1.0</span>
          </div>
          <p style={S.pageSubtitle}>
            TypeScript SDK for building MEV-resistant DeFi applications on 0G.
            Two functions to integrate private intent execution into any protocol.
          </p>

          {/* Quick nav */}
          <div style={S.quickNav}>
            {[
              ["Installation",      "#install"],
              ["Quick Start",       "#quickstart"],
              ["buildIntent",       "#buildintent"],
              ["uploadStrategy",    "#strategy"],
              ["Architecture",      "#arch"],
            ].map(([label, href]) => (
              <a key={href} href={href} style={S.quickNavPill}>{label}</a>
            ))}
          </div>
        </div>

        {/* ── Installation ────────────────────────────────────────────────── */}
        <section style={S.section} id="install">
          <SectionHeading id="install">Installation</SectionHeading>
          <CodeBlock lang="bash" code={`npm install @veilsolver/sdk ethers`} />
        </section>

        {/* ── Quick Start ─────────────────────────────────────────────────── */}
        <section style={S.section} id="quickstart">
          <SectionHeading id="quickstart">Quick Start</SectionHeading>
          <p style={S.prose}>
            Use <code style={S.inlineCode}>VeilSolverClient</code> for the full pipeline in a single call.
            It handles encryption, TEE inference, plan signing, and on-chain settlement.
          </p>
          <CodeBlock lang="typescript" code={`import { VeilSolverClient } from "@veilsolver/sdk"
import { ethers } from "ethers"

const solver = new VeilSolverClient({
  apiUrl:          "https://solver.veilsolver.xyz",
  contractAddress: "0x02553ef7529118EB33E199b7329732d4F2884cEb",
  solverPublicKey: "0x039a5b81f4b2bc0c181b1292f3aeb55721de43dc7e3d07c6c44ba3aa08e7caae04"
})

// Full pipeline: encrypt → TEE → sign → settle
const { solveResponse, receipt } = await solver.solve({
  tokenIn:        "0x0683F96B376cd819C12Bdb0c723b7D508ceF42Cf",  // USDC
  tokenOut:       "0x2550713236C759e185068ba531E2f63dc0de41D2",  // WETH
  amountIn:       "100",      // human-readable — 100 USDC
  decimalsIn:     6,
  maxSlippageBps: 50,         // 0.5%
  signer                      // ethers.Signer from MetaMask
})

console.log("tx:", receipt?.hash)
console.log("min received:", solveResponse.plan.minAmountOut)`} />
        </section>

        {/* ── Individual functions ─────────────────────────────────────────── */}
        <section style={S.section} id="buildintent">
          <SectionHeading id="buildintent">Individual Functions</SectionHeading>
          <p style={S.prose}>
            For step-by-step control, use the individual functions directly.
            All functions are pure TypeScript — no React dependency.
          </p>

          <FnDoc
            name="buildIntent"
            signature="buildIntent({ tokenIn, tokenOut, amountIn, decimalsIn, maxSlippageBps, userAddress, chainId, strategyId? })"
            returns="TradingIntent"
            description="Constructs a TradingIntent from human-readable parameters. Converts amountIn to wei string using decimalsIn. Generates a cryptographically random 32-byte nonce for replay protection. chainId prevents cross-chain replay attacks."
          />
          <CodeBlock lang="typescript" code={`import { buildIntent } from "@veilsolver/sdk"

const intent = buildIntent({
  tokenIn:        "0xUSDC...",
  tokenOut:       "0xWETH...",
  amountIn:       "100",   // 100 USDC — human-readable
  decimalsIn:     6,
  maxSlippageBps: 50,      // 0.5%
  userAddress:    "0xYourWallet...",
  chainId:        16602,   // 0G testnet
  strategyId:     "0abc…"  // optional: 0G Storage root hash
})`} />

          <FnDoc
            name="encryptIntent"
            signature="encryptIntent(intent: TradingIntent, solverPublicKey: string)"
            returns="Promise<string>"
            description="Encrypts the intent using ECIES with the solver's enclave public key. Returns a hex-encoded ciphertext. The solver API receives this alongside the plaintext intent (used for routing) but cannot read the plaintext without the enclave private key."
          />
          <CodeBlock lang="typescript" code={`import { encryptIntent } from "@veilsolver/sdk"

const SOLVER_PUBKEY = "0x039a5b81f4b2bc0c181b1292f3aeb55721de43dc7e3d07c6c44ba3aa08e7caae04"
const encryptedIntent = await encryptIntent(intent, SOLVER_PUBKEY)
// encryptedIntent: "0x04a3b9..." — ECIES ciphertext`} />

          <FnDoc
            name="callSolverAPI"
            signature="callSolverAPI(intent: TradingIntent, encryptedIntent: string, apiUrl: string)"
            returns="Promise<SolveResponse>"
            description="POSTs to /solve with the intent and encrypted blob. The solver API forwards to 0G Compute (GLM-5-FP8 in Intel TDX), verifies the TEE attestation, signs the plan, stores the audit record to 0G Storage, and returns the full SolveResponse."
          />
          <CodeBlock lang="typescript" code={`import { callSolverAPI } from "@veilsolver/sdk"

const response = await callSolverAPI(
  intent,
  encryptedIntent,
  "https://solver.veilsolver.xyz"
)

// response.plan         — execution plan (tokenIn, tokenOut, minAmountOut, route, deadline)
// response.signature    — ECDSA hex, verified by VeilSolver.sol
// response.attestation  — { chatID, isVerified, provider, model, timestamp }
// response.auditRootHash — 0G Storage root hash (empty string if storage failed)`} />

          <FnDoc
            name="submitSettlement"
            signature="submitSettlement({ solveResult, contractAddress, signer })"
            returns="Promise<TransactionReceipt | null>"
            description="Approves ERC20 spend, then calls executePlan() on VeilSolver.sol. The contract verifies the ECDSA signature, checks the deadline and replay mapping, deducts the fee, and routes the swap through the DEX. Returns the ethers TransactionReceipt on success."
          />
          <CodeBlock lang="typescript" code={`import { submitSettlement } from "@veilsolver/sdk"

const receipt = await submitSettlement({
  solveResult:     response,
  contractAddress: "0x02553ef7529118EB33E199b7329732d4F2884cEb",
  signer           // ethers.Signer — must have tokenIn balance + approval
})

console.log("tx hash:", receipt?.hash)
console.log("block:",   receipt?.blockNumber)`} />
        </section>

        {/* ── Strategy Registry ────────────────────────────────────────────── */}
        <section style={S.section} id="strategy">
          <SectionHeading id="strategy">Strategy Registry</SectionHeading>
          <p style={S.prose}>
            Upload private system prompts to 0G Storage. Each prompt is ECIES-encrypted before
            upload — only the TEE can decrypt it. The returned <code style={S.inlineCode}>strategyId</code> is
            the 0G Storage merkle root hash — safe to share publicly.
          </p>
          <CodeBlock lang="typescript" code={`import { VeilSolverClient } from "@veilsolver/sdk"

const solver = new VeilSolverClient({ apiUrl, contractAddress, solverPublicKey })

// 1. Upload your private strategy prompt
const strategyId = await solver.uploadStrategy({
  prompt: "You are a conservative DeFi executor. Never route through more than 2 pools...",
  signer
})
// strategyId = 0G Storage root hash — share with your users

// 2. Use it in a trade — TEE fetches + decrypts it internally
const { receipt } = await solver.solve({
  tokenIn, tokenOut, amountIn, decimalsIn,
  maxSlippageBps: 50,
  strategyId,    // ← activates your custom strategy
  signer
})`} />

          <div style={S.infoBox}>
            <div style={S.infoBoxTitle}>Privacy guarantee</div>
            <p style={S.infoBoxText}>
              The encrypted blob is stored on 0G Storage. The <code style={S.inlineCodeDark}>strategyId</code> is
              a content-addressed root hash — publicly retrievable, but the blob is ECIES encrypted.
              The operator cannot read strategy contents. Only the TEE enclave can decrypt using its
              private key — which never leaves the Intel TDX hardware boundary.
            </p>
          </div>
        </section>

        {/* ── Architecture ─────────────────────────────────────────────────── */}
        <section style={S.section} id="arch">
          <SectionHeading id="arch">Architecture</SectionHeading>
          <p style={S.prose}>
            VeilSolver is a three-layer system. The client layer handles encryption and settlement.
            The solver layer orchestrates TEE inference and storage. The chain layer enforces all
            guarantees via smart contract.
          </p>

          <CodeBlock lang="plaintext" code={`User → buildIntent() → encryptIntent() → POST /solve
         ↓ (ECIES encrypted, unreadable to solver)
Solver API → 0G Compute (GLM-5-FP8 in Intel TDX enclave)
         ↓ (execution plan computed inside enclave)
Solver API → signPlan() → storeAuditRecord() → 0G Storage
         ↓
SolveResponse { plan, signature, attestation, auditRootHash }
         ↓
submitSettlement() → VeilSolver.sol → DEX swap → receipt`} />

          <div style={S.archGrid}>
            {[
              {
                layer: "Client",
                items: [
                  "buildIntent() — TradingIntent from form values",
                  "encryptIntent() — ECIES, local computation",
                  "submitSettlement() — ERC20 approve + executePlan()",
                ]
              },
              {
                layer: "Solver API",
                items: [
                  "inference.ts — 0G Compute, broker singleton",
                  "signer.ts — ECDSA plan hash (matches Solidity)",
                  "storage.ts — 0G Storage audit trail",
                ]
              },
              {
                layer: "VeilSolver.sol",
                items: [
                  "ecrecover(planHash, sig) == solverKey",
                  "executedIntents[hash] — replay protection",
                  "minAmountOut enforced — MEV shield",
                ]
              },
            ].map(card => (
              <div key={card.layer} style={S.archCard}>
                <div style={S.archLayer}>{card.layer}</div>
                {card.items.map(item => (
                  <div key={item} style={S.archItem}>
                    <span style={S.archBullet}>›</span>
                    <span style={S.archItemText}>{item}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Security model table */}
          <div style={S.tableWrap}>
            <div style={S.tableTitle}>SECURITY MODEL</div>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Guarantee</th>
                  <th style={S.th}>Enforcement</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Intent contents private",    "ECIES encryption — only enclave key decrypts"],
                  ["Strategy logic private",      "TeeML — host cannot read enclave memory"],
                  ["Execution plan authentic",    "ECDSA — contract verifies via ecrecover"],
                  ["Audit record immutable",      "0G Storage merkle root — content-addressed"],
                  ["No replay",                  "On-chain mapping — EVM state is final"],
                  ["MEV bounded",                "minAmountOut enforced by VeilSolver.sol"],
                ].map(([g, e]) => (
                  <tr key={g} style={S.tr}>
                    <td style={S.td}>{g}</td>
                    <td style={{ ...S.td, color: "#7c3aed" }}>{e}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Footer */}
        <div style={S.docFooter}>
          <span>VeilSolver · 0G APAC Hackathon 2026</span>
          <span style={{ fontStyle: "italic", opacity: 0.6 }}>
            Privacy is an architecture property, not a policy promise.
          </span>
        </div>
      </main>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100vh",
    background: "#f0e8d8",
    color: "#111111",
    fontFamily: "var(--font-mono), 'IBM Plex Mono', monospace",
  },
  main: {
    maxWidth: 900,
    margin: "0 auto",
    padding: "36px 28px 80px",
  },

  // Page header
  pageHeader: { marginBottom: 52 },
  pageTitleRow: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    marginBottom: 12,
    flexWrap: "wrap" as const,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: 700,
    color: "#111111",
    letterSpacing: "-0.5px",
  },
  versionBadge: {
    fontSize: 11,
    fontWeight: 700,
    color: "#7c3aed",
    background: "rgba(124,58,237,0.06)",
    border: "1px solid rgba(124,58,237,0.15)",
    padding: "4px 10px",
    borderRadius: 4,
    letterSpacing: "0.3px",
  },
  pageSubtitle: {
    fontSize: 14,
    color: "rgba(17,17,17,0.5)",
    lineHeight: 1.65,
    maxWidth: 600,
    marginBottom: 24,
  },
  quickNav: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap" as const,
  },
  quickNavPill: {
    fontSize: 12,
    fontWeight: 500,
    color: "#7c3aed",
    background: "rgba(124,58,237,0.06)",
    border: "1px solid rgba(124,58,237,0.15)",
    padding: "6px 14px",
    borderRadius: 6,
    textDecoration: "none",
    letterSpacing: "0.2px",
    transition: "all 0.15s",
    fontFamily: "var(--font-mono), 'IBM Plex Mono', monospace",
  },

  // Sections
  section: { marginBottom: 60 },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: "#111111",
    letterSpacing: "-0.3px",
    marginBottom: 16,
    paddingTop: 8,
    borderTop: "1px solid rgba(0,0,0,0.08)",
  },
  prose: {
    fontSize: 13,
    color: "rgba(17,17,17,0.5)",
    lineHeight: 1.7,
    marginBottom: 18,
  },
  inlineCode: {
    background: "rgba(124,58,237,0.08)",
    color: "#5b21b6",
    padding: "1px 6px",
    borderRadius: 3,
    fontSize: "0.95em",
    fontFamily: "var(--font-mono), 'IBM Plex Mono', monospace",
  },

  // Code blocks (dark — contrast sections)
  codeWrap: {
    position: "relative",
    marginBottom: 20,
    borderRadius: 8,
    overflow: "hidden",
    border: "1px solid rgba(0,0,0,0.12)",
  },
  codeLang: {
    position: "absolute",
    top: 10,
    right: 14,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "1px",
    color: "rgba(196,181,253,0.6)",
    textTransform: "uppercase" as const,
    fontFamily: "var(--font-mono), 'IBM Plex Mono', monospace",
  },
  pre: {
    background: "#111111",
    padding: "20px 20px 20px 20px",
    margin: 0,
    overflowX: "auto" as const,
    lineHeight: 1.65,
  },
  code: {
    color: "#c4b5fd",
    fontSize: 12,
    fontFamily: "var(--font-mono), 'IBM Plex Mono', monospace",
    whiteSpace: "pre" as const,
  },

  // Function docs
  fnDoc: {
    background: "#ffffff",
    border: "1px solid rgba(0,0,0,0.07)",
    borderRadius: 8,
    boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
    padding: "16px 18px",
    marginBottom: 12,
  },
  fnHeader: {
    display: "flex",
    alignItems: "baseline",
    gap: 12,
    marginBottom: 6,
    flexWrap: "wrap" as const,
  },
  fnName: {
    fontSize: 14,
    fontWeight: 700,
    color: "#7c3aed",
    fontFamily: "var(--font-mono), 'IBM Plex Mono', monospace",
  },
  fnReturns: {
    fontSize: 11,
    color: "rgba(17,17,17,0.3)",
    fontFamily: "var(--font-mono), 'IBM Plex Mono', monospace",
  },
  fnSig: {
    fontSize: 11,
    color: "rgba(91,33,182,0.55)",
    fontFamily: "var(--font-mono), 'IBM Plex Mono', monospace",
    marginBottom: 8,
    lineHeight: 1.5,
    wordBreak: "break-all" as const,
  },
  fnDesc: {
    fontSize: 12,
    color: "rgba(17,17,17,0.5)",
    lineHeight: 1.65,
    margin: 0,
  },

  // Info box
  infoBox: {
    background: "rgba(124,58,237,0.04)",
    border: "1px solid rgba(124,58,237,0.18)",
    borderRadius: 8,
    padding: "16px 18px",
    marginTop: 12,
  },
  infoBoxTitle: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "1.5px",
    color: "#7c3aed",
    marginBottom: 8,
    textTransform: "uppercase" as const,
  },
  infoBoxText: {
    fontSize: 12,
    color: "rgba(17,17,17,0.5)",
    lineHeight: 1.65,
    margin: 0,
  },
  inlineCodeDark: {
    background: "rgba(124,58,237,0.08)",
    color: "#5b21b6",
    padding: "1px 5px",
    borderRadius: 3,
    fontSize: "0.92em",
    fontFamily: "var(--font-mono), 'IBM Plex Mono', monospace",
  },

  // Architecture
  archGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 14,
    marginTop: 20,
    marginBottom: 28,
  },
  archCard: {
    background: "#ffffff",
    border: "1px solid rgba(0,0,0,0.07)",
    borderRadius: 8,
    boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
    padding: "16px 16px 18px",
  },
  archLayer: {
    fontSize: 11,
    fontWeight: 700,
    color: "#7c3aed",
    letterSpacing: "0.5px",
    marginBottom: 12,
    paddingBottom: 8,
    borderBottom: "1px solid rgba(124,58,237,0.1)",
  },
  archItem: {
    display: "flex",
    gap: 8,
    alignItems: "flex-start",
    marginBottom: 6,
  },
  archBullet: {
    color: "rgba(124,58,237,0.4)",
    flexShrink: 0,
    marginTop: 0,
  },
  archItemText: {
    fontSize: 11,
    color: "rgba(17,17,17,0.5)",
    lineHeight: 1.55,
    fontFamily: "var(--font-mono), 'IBM Plex Mono', monospace",
  },

  // Table
  tableWrap: {
    background: "#ffffff",
    border: "1px solid rgba(0,0,0,0.07)",
    borderRadius: 8,
    boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
    overflow: "hidden",
  },
  tableTitle: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "2px",
    color: "#7c3aed",
    padding: "12px 18px 10px",
    borderBottom: "1px solid rgba(0,0,0,0.07)",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
  },
  th: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "1px",
    color: "rgba(17,17,17,0.35)",
    padding: "10px 18px",
    textAlign: "left" as const,
    borderBottom: "1px solid rgba(0,0,0,0.06)",
    background: "rgba(124,58,237,0.02)",
  },
  tr: {
    borderBottom: "1px solid rgba(0,0,0,0.05)",
  },
  td: {
    fontSize: 12,
    color: "rgba(17,17,17,0.6)",
    padding: "10px 18px",
    verticalAlign: "top" as const,
    fontFamily: "var(--font-mono), 'IBM Plex Mono', monospace",
  },

  // Footer
  docFooter: {
    marginTop: 80,
    paddingTop: 20,
    borderTop: "1px solid rgba(0,0,0,0.08)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap" as const,
    gap: 8,
    fontSize: 11,
    color: "rgba(17,17,17,0.25)",
  },
}
