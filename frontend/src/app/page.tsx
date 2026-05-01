"use client"

import Link from "next/link"
import ParticleBackground from "./components/ParticleBackground"

// ─── Feature cards ────────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: "🔐",
    title: "Privacy is Architecture",
    desc: "ECIES encryption enforced in hardware. Not a policy promise — a cryptographic guarantee.",
  },
  {
    icon: "⚡",
    title: "TEE-attested Execution",
    desc: "Intel TDX + 0G AI router. Enclave memory is physically unreadable. Not even the operator sees your strategy.",
  },
  {
    icon: "📋",
    title: "Strategy Registry",
    desc: "Upload private system prompts. Encrypted before they leave your browser. Only the TEE decrypts them.",
  },
  {
    icon: "🛡",
    title: "Replay Protection",
    desc: "On-chain intent mapping. Every nonce used exactly once. Replays revert at the EVM level.",
  },
  {
    icon: "🔒",
    title: "MEV Shield",
    desc: "minAmountOut enforced by VeilSolver.sol. Sandwich attacks revert on the back leg — bot loses gas.",
  },
  {
    icon: "⬡",
    title: "2-Line SDK",
    desc: "solver.solve({ ... }) is all you need. Composable with any protocol in two hours.",
  },
]

const PROBLEMS = [
  {
    title: "Leaked Intents",
    desc: "AI strategies exposed through API logs, inferred from patterns. Your alpha is not yours.",
  },
  {
    title: "Front-running",
    desc: "Transactions visible in the mempool before execution. Bots see your trade before it settles.",
  },
  {
    title: "No Privacy Guarantee",
    desc: '"Private" APIs are just policy promises, not architecture. One breach and your strategy is public.',
  },
]

const HOW_STEPS = [
  {
    num: "01",
    title: "Build & Encrypt",
    desc: "Intent encrypted ECIES client-side with the solver's enclave public key. The solver never sees plaintext.",
  },
  {
    num: "02",
    title: "TEE Inference",
    desc: "AI computes the execution plan inside an Intel TDX enclave. Strategy logic is private by hardware.",
  },
  {
    num: "03",
    title: "Atomic Settlement",
    desc: "Plan verified via ECDSA on 0G Chain. minAmountOut enforced by VeilSolver.sol. Sandwich attacks revert.",
  },
]

const INFRA = [
  {
    tag: "0G Compute",
    sub: "Sealed AI inference · Intel TDX · GLM-5-FP8",
    desc: "TeeML hardware attestation — enclave private key never exported. Your strategy executes in isolation.",
  },
  {
    tag: "0G Storage",
    sub: "Encrypted audit trail · Content-addressed · Immutable",
    desc: "Every solve hashed to a merkle root. Emitted in IntentExecuted events — queryable from chain, no index needed.",
  },
  {
    tag: "0G Chain",
    sub: "Settlement layer · EVM-compatible · chainId 16602",
    desc: "Cancun-compatible EVM. ecrecover enforces solver signature. executedIntents mapping blocks all replays.",
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <main style={S.main}>
      <ParticleBackground />

      {/* ── Minimal nav ──────────────────────────────────────────────────────── */}
      <header style={S.topNav}>
        <div style={S.navLogo}>
          <span style={S.logoHex}>⬡</span>
          <span style={S.logoText}>VeilSolver</span>
          <span style={S.logoDot} />
        </div>
        <nav style={S.navLinks}>
          <Link href="/demo"     style={S.navLink}>Demo</Link>
          <Link href="/strategy" style={S.navLink}>Strategy</Link>
          <Link href="/docs"     style={S.navLink}>Docs</Link>
        </nav>
        <Link href="/demo" style={S.navCta}>Launch App →</Link>
      </header>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 1 — Hero
      ════════════════════════════════════════════════════════════════════════ */}
      <section style={S.hero}>
        <div style={S.heroInner}>
          {/* Badge */}
          <div style={S.badge}>
            <span style={S.badgeDot} />
            TRACK 5 — PRIVACY &amp; SOVEREIGN INFRASTRUCTURE
          </div>

          {/* Headline */}
          <h1 style={S.headline}>
            <span style={S.headlineGradient}>VeilSolver</span>
          </h1>

          <h2 style={S.subheadline}>MEV-resistant trade execution</h2>

          <p style={S.bodyText}>
            Encrypted intents · TEE-computed plans · Zero mempool exposure
          </p>

          {/* CTAs */}
          <div style={S.ctaRow}>
            <Link href="/demo" style={S.ctaPrimary}>
              <span style={{ fontSize: 16 }}>⬡</span> Try Demo
            </Link>
            <Link href="/docs" style={S.ctaGhost}>
              Read Docs →
            </Link>
          </div>

          {/* Stats */}
          <div style={S.statsRow}>
            <div style={S.stat}>
              <span style={S.statVal}>$0</span>
              <span style={S.statLabel}>MEV leaked</span>
            </div>
            <div style={S.statSep}>·</div>
            <div style={S.stat}>
              <span style={S.statVal}>TEE</span>
              <span style={S.statLabel}>attested</span>
            </div>
            <div style={S.statSep}>·</div>
            <div style={S.stat}>
              <span style={S.statVal}>0G</span>
              <span style={S.statLabel}>native</span>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div style={S.scrollIndicator}>↓ scroll</div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 2 — Problem
      ════════════════════════════════════════════════════════════════════════ */}
      <section style={S.section}>
        <div style={S.sectionInner}>
          <div style={S.sectionBadge}>THE PROBLEM</div>
          <h2 style={S.sectionHeading}>$1B+ lost to MEV every year</h2>
          <p style={S.sectionSub}>
            Existing solutions protect transactions — not the AI strategies that produce them.
          </p>

          <div style={S.problemGrid}>
            {PROBLEMS.map(p => (
              <div key={p.title} style={S.problemCard}>
                <div style={S.problemLine} />
                <h3 style={S.problemTitle}>{p.title}</h3>
                <p style={S.problemDesc}>{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 3 — How It Works  (dark contrast section)
      ════════════════════════════════════════════════════════════════════════ */}
      <section style={{ ...S.section, background: "#111111" }}>
        <div style={S.sectionInner}>
          <div style={{ ...S.sectionBadge, color: "rgba(196,181,253,0.7)" }}>HOW IT WORKS</div>
          <h2 style={{ ...S.sectionHeading, color: "#ffffff" }}>Three steps. Zero leaks.</h2>

          <div style={S.stepsRow}>
            {HOW_STEPS.map((step, i) => (
              <div key={step.num} style={S.stepCard}>
                <div style={S.stepNumBadge}>{step.num}</div>
                <h3 style={S.stepTitle}>{step.title}</h3>
                <p style={S.stepDesc}>{step.desc}</p>
                {i < HOW_STEPS.length - 1 && (
                  <div style={S.stepArrow}>→</div>
                )}
              </div>
            ))}
          </div>

          {/* Flow diagram */}
          <div style={S.flowDiagram}>
            <div style={S.flowBox}>User</div>
            <div style={S.flowArrow}>—— ECIES ——→</div>
            <div style={S.flowBox}>Solver API</div>
            <div style={S.flowArrow}>—— TDX ——→</div>
            <div style={S.flowBoxHighlight}>TEE Enclave</div>
            <div style={S.flowArrow}>—— ECDSA ——→</div>
            <div style={S.flowBox}>0G Chain</div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 4 — Features
      ════════════════════════════════════════════════════════════════════════ */}
      <section style={S.section}>
        <div style={S.sectionInner}>
          <div style={S.sectionBadge}>CAPABILITIES</div>
          <h2 style={S.sectionHeading}>Every guarantee enforced by cryptography</h2>

          <div style={S.featGrid}>
            {FEATURES.map(f => (
              <div key={f.title} style={S.featCard}>
                <div style={S.featIcon}>{f.icon}</div>
                <h3 style={S.featTitle}>{f.title}</h3>
                <p style={S.featDesc}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 5 — Built on 0G
      ════════════════════════════════════════════════════════════════════════ */}
      <section style={S.section}>
        <div style={S.sectionInner}>
          <div style={S.sectionBadge}>INFRASTRUCTURE</div>
          <h2 style={S.sectionHeading}>Built on 0G</h2>
          <p style={S.sectionSub}>
            Full-stack decentralized AI infrastructure — compute, storage, and settlement.
          </p>

          <div style={S.infraGrid}>
            {INFRA.map(card => (
              <div key={card.tag} style={S.infraCard}>
                <div style={S.infraHeader}>
                  <span style={S.infraTag}>{card.tag}</span>
                  <span style={S.infraSub}>{card.sub}</span>
                </div>
                <div style={S.infraDivider} />
                <p style={S.infraDesc}>{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 6 — CTA Footer  (dark contrast section)
      ════════════════════════════════════════════════════════════════════════ */}
      <section style={{ ...S.ctaSection, background: "#111111" }}>
        <div style={S.ctaSectionInner}>
          <div style={S.ctaGlowOrb} />
          <h2 style={{ ...S.ctaHeading, color: "#ffffff" }}>Ready to build?</h2>
          <p style={{ ...S.ctaSubtext, color: "rgba(255,255,255,0.45)" }}>
            Private intent solver. Two-line SDK. No mempool exposure.
          </p>
          <div style={S.ctaButtons}>
            <Link href="/demo" style={S.ctaPrimary}>
              <span style={{ fontSize: 16 }}>⬡</span> Launch Demo
            </Link>
            <Link href="/docs" style={{ ...S.ctaGhost, color: "rgba(255,255,255,0.65)", border: "1px solid rgba(255,255,255,0.2)" }}>
              Read the Docs
            </Link>
          </div>
          <div style={{ ...S.ctaFooterNote, color: "rgba(255,255,255,0.2)" }}>
            VeilSolver · 0G APAC Hackathon 2026
          </div>
        </div>
      </section>
    </main>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  main: {
    minHeight: "100vh",
    background: "#f0e8d8",
    color: "#111111",
    fontFamily: "var(--font-mono), 'IBM Plex Mono', monospace",
    overflowX: "hidden",
    position: "relative",
  },

  // Top nav
  topNav: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    height: 56,
    padding: "0 40px",
    background: "rgba(240,232,216,0.9)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    borderBottom: "1px solid rgba(0,0,0,0.08)",
  },
  navLogo: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    textDecoration: "none",
    userSelect: "none",
  },
  logoHex: {
    fontSize: 20,
    color: "#7c3aed",
  },
  logoText: {
    fontSize: 16,
    fontWeight: 700,
    color: "#111111",
    letterSpacing: "-0.3px",
  },
  logoDot: {
    width: 5,
    height: 5,
    borderRadius: "50%",
    background: "#7c3aed",
    marginBottom: 10,
  },
  navLinks: {
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
  navLink: {
    fontSize: 13,
    fontWeight: 500,
    color: "rgba(17,17,17,0.5)",
    textDecoration: "none",
    padding: "6px 14px",
    borderRadius: 6,
    letterSpacing: "0.2px",
    transition: "color 0.15s",
  },
  navCta: {
    fontSize: 12,
    fontWeight: 700,
    color: "#ffffff",
    textDecoration: "none",
    background: "#111111",
    border: "1px solid rgba(0,0,0,0.2)",
    padding: "7px 16px",
    borderRadius: 6,
    letterSpacing: "0.3px",
  },

  // Hero
  hero: {
    position: "relative",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 56,
    zIndex: 1,
  },
  heroInner: {
    textAlign: "center",
    maxWidth: 780,
    padding: "0 24px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 0,
    animation: "fade-up 0.8s ease forwards",
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "2px",
    color: "#7c3aed",
    background: "rgba(124,58,237,0.07)",
    border: "1px solid rgba(124,58,237,0.18)",
    padding: "6px 16px",
    borderRadius: 4,
    marginBottom: 40,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "#7c3aed",
    animation: "pulse-dot 1.8s ease-in-out infinite",
  },
  headline: {
    fontSize: "clamp(64px, 10vw, 120px)",
    fontWeight: 700,
    lineHeight: 1.0,
    letterSpacing: "-2px",
    marginBottom: 24,
  },
  headlineGradient: {
    background: "linear-gradient(135deg, #111111, #7c3aed 50%, #111111)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },
  subheadline: {
    fontSize: "clamp(22px, 3vw, 32px)",
    fontWeight: 700,
    color: "#111111",
    letterSpacing: "-0.5px",
    marginBottom: 16,
  },
  bodyText: {
    fontSize: 15,
    color: "rgba(17,17,17,0.5)",
    lineHeight: 1.6,
    letterSpacing: "0.3px",
    marginBottom: 44,
  },
  ctaRow: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    marginBottom: 52,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  ctaPrimary: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    background: "#111111",
    color: "#ffffff",
    textDecoration: "none",
    padding: "14px 28px",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: "0.3px",
    boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
    border: "1px solid rgba(0,0,0,0.2)",
    transition: "all 0.2s ease",
    fontFamily: "var(--font-mono), 'IBM Plex Mono', monospace",
  },
  ctaGhost: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    background: "transparent",
    color: "rgba(17,17,17,0.65)",
    textDecoration: "none",
    padding: "14px 28px",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    letterSpacing: "0.3px",
    border: "1px solid rgba(0,0,0,0.15)",
    transition: "all 0.2s ease",
    fontFamily: "var(--font-mono), 'IBM Plex Mono', monospace",
  },
  statsRow: {
    display: "flex",
    alignItems: "center",
    gap: 20,
  },
  stat: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 2,
  },
  statVal: {
    fontSize: 20,
    fontWeight: 700,
    color: "#111111",
  },
  statLabel: {
    fontSize: 10,
    color: "rgba(17,17,17,0.35)",
    letterSpacing: "0.5px",
  },
  statSep: {
    fontSize: 18,
    color: "rgba(17,17,17,0.2)",
  },
  scrollIndicator: {
    position: "absolute",
    bottom: 32,
    left: "50%",
    transform: "translateX(-50%)",
    fontSize: 11,
    color: "rgba(17,17,17,0.25)",
    letterSpacing: "2px",
    animation: "fade-up 0.6s ease 1.2s both",
  },

  // Sections
  section: {
    position: "relative",
    zIndex: 1,
    padding: "96px 40px",
  },
  sectionInner: {
    maxWidth: 1080,
    margin: "0 auto",
  },
  sectionBadge: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "2.5px",
    color: "#7c3aed",
    marginBottom: 16,
  },
  sectionHeading: {
    fontSize: "clamp(28px, 4vw, 44px)",
    fontWeight: 700,
    color: "#111111",
    letterSpacing: "-0.5px",
    marginBottom: 16,
    lineHeight: 1.15,
  },
  sectionSub: {
    fontSize: 15,
    color: "rgba(17,17,17,0.45)",
    lineHeight: 1.6,
    marginBottom: 52,
    maxWidth: 560,
  },

  // Problem
  problemGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 20,
  },
  problemCard: {
    background: "#ffffff",
    border: "1px solid rgba(0,0,0,0.07)",
    borderRadius: 12,
    padding: "28px 24px",
    boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
    position: "relative",
    overflow: "hidden",
  },
  problemLine: {
    width: 32,
    height: 2,
    background: "linear-gradient(90deg, #7c3aed, transparent)",
    marginBottom: 16,
  },
  problemTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: "#111111",
    marginBottom: 10,
    letterSpacing: "-0.2px",
  },
  problemDesc: {
    fontSize: 12,
    color: "rgba(17,17,17,0.5)",
    lineHeight: 1.65,
  },

  // How It Works (dark section — cards use dark styles)
  stepsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 24,
    marginBottom: 48,
    position: "relative",
  },
  stepCard: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 12,
    padding: "28px 24px",
    position: "relative",
  },
  stepNumBadge: {
    fontSize: 11,
    fontWeight: 700,
    color: "#c4b5fd",
    background: "rgba(124,58,237,0.3)",
    border: "1px solid rgba(124,58,237,0.5)",
    borderRadius: 4,
    padding: "3px 8px",
    display: "inline-block",
    marginBottom: 16,
    letterSpacing: "1px",
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: "#ffffff",
    marginBottom: 10,
  },
  stepDesc: {
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
    lineHeight: 1.65,
  },
  stepArrow: {
    position: "absolute",
    top: "50%",
    right: -18,
    transform: "translateY(-50%)",
    fontSize: 18,
    color: "rgba(255,255,255,0.3)",
    zIndex: 2,
  },
  flowDiagram: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 0,
    flexWrap: "wrap",
    rowGap: 16,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10,
    padding: "20px 28px",
  },
  flowBox: {
    fontSize: 12,
    fontWeight: 600,
    color: "rgba(255,255,255,0.7)",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: 6,
    padding: "8px 14px",
    whiteSpace: "nowrap" as const,
  },
  flowBoxHighlight: {
    fontSize: 12,
    fontWeight: 700,
    color: "#c4b5fd",
    background: "rgba(124,58,237,0.25)",
    border: "1px solid rgba(124,58,237,0.5)",
    borderRadius: 6,
    padding: "8px 14px",
    whiteSpace: "nowrap" as const,
  },
  flowArrow: {
    fontSize: 11,
    color: "rgba(255,255,255,0.3)",
    padding: "0 8px",
    letterSpacing: "0.5px",
    whiteSpace: "nowrap" as const,
  },

  // Features
  featGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 18,
  },
  featCard: {
    background: "#ffffff",
    border: "1px solid rgba(0,0,0,0.07)",
    borderRadius: 12,
    padding: "24px 20px",
    boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
  },
  featIcon: {
    fontSize: 22,
    marginBottom: 12,
    display: "block",
  },
  featTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: "#111111",
    marginBottom: 8,
    letterSpacing: "-0.2px",
  },
  featDesc: {
    fontSize: 12,
    color: "rgba(17,17,17,0.5)",
    lineHeight: 1.65,
  },

  // Infra
  infraGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 18,
  },
  infraCard: {
    background: "#ffffff",
    border: "1px solid rgba(0,0,0,0.07)",
    borderRadius: 12,
    padding: "24px 22px",
    boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
  },
  infraHeader: {
    marginBottom: 14,
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
  },
  infraTag: {
    fontSize: 14,
    fontWeight: 700,
    color: "#7c3aed",
    letterSpacing: "-0.2px",
  },
  infraSub: {
    fontSize: 10,
    color: "rgba(17,17,17,0.4)",
    letterSpacing: "0.3px",
  },
  infraDivider: {
    height: 1,
    background: "linear-gradient(90deg, rgba(124,58,237,0.3), transparent)",
    marginBottom: 14,
  },
  infraDesc: {
    fontSize: 12,
    color: "rgba(17,17,17,0.5)",
    lineHeight: 1.65,
  },

  // CTA Section (dark — overridden inline in JSX)
  ctaSection: {
    position: "relative",
    zIndex: 1,
    padding: "120px 40px 100px",
    textAlign: "center",
    overflow: "hidden",
  },
  ctaSectionInner: {
    maxWidth: 560,
    margin: "0 auto",
    position: "relative",
    zIndex: 1,
  },
  ctaGlowOrb: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: 500,
    height: 500,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(124,58,237,0.15) 0%, rgba(124,58,237,0.05) 50%, transparent 70%)",
    pointerEvents: "none",
  },
  ctaHeading: {
    fontSize: "clamp(32px, 5vw, 52px)",
    fontWeight: 700,
    color: "#ffffff",
    letterSpacing: "-0.8px",
    marginBottom: 16,
  },
  ctaSubtext: {
    fontSize: 14,
    color: "rgba(255,255,255,0.45)",
    marginBottom: 40,
    lineHeight: 1.6,
  },
  ctaButtons: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    marginBottom: 48,
    flexWrap: "wrap",
  },
  ctaFooterNote: {
    fontSize: 11,
    color: "rgba(255,255,255,0.2)",
    letterSpacing: "0.5px",
  },
}
