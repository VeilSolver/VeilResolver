"use client"

import { useEffect } from "react"
import Link from "next/link"
import ParticleBackground from "./components/ParticleBackground"
import CTAFooter from "./components/CTAFooter"

// col-span per card: row1=[2,1]  row2=[1,2]  row3=[2,1]
const CAP_SPANS = [2, 1, 1, 2, 2, 1]

// each card: unique bg + text + accent from {white, black, beige} family
const CAP_THEMES = [
  { bg: '#111111',  border: '1px solid transparent',      title: '#f8f5ee',  desc: 'rgba(248,245,238,0.5)',  accent: 'rgba(248,245,238,0.35)' }, // full black
  { bg: '#ffffff',  border: '2px solid #111111',           title: '#111111',  desc: 'rgba(17,17,17,0.55)',    accent: '#111111'               }, // stark white
  { bg: '#f0ebe0',  border: '1px solid rgba(0,0,0,0.08)', title: '#111111',  desc: 'rgba(17,17,17,0.55)',    accent: 'rgba(17,17,17,0.22)'    }, // warm beige
  { bg: '#1e1b16',  border: '1px solid transparent',      title: '#f0ebe0',  desc: 'rgba(240,235,224,0.45)', accent: 'rgba(212,201,176,0.5)'  }, // deep warm dark
  { bg: '#faf9f6',  border: '1px solid #c8bc9e',           title: '#111111',  desc: 'rgba(17,17,17,0.55)',    accent: '#8a7d6a'                }, // pale warm white
  { bg: '#e2d9cb',  border: '1px solid rgba(0,0,0,0.07)', title: '#111111',  desc: 'rgba(17,17,17,0.6)',     accent: 'rgba(17,17,17,0.35)'    }, // mid beige
]

const FEATURES = [
  { title: "Privacy is Architecture",    desc: "ECIES encryption enforced in hardware. Not a policy promise — a cryptographic guarantee." },
  { title: "TEE-attested Execution",     desc: "Intel TDX + 0G AI router. Enclave memory is physically unreadable. Not even the operator sees your strategy." },
  { title: "Strategy Registry",          desc: "Upload private system prompts. Encrypted before they leave your browser. Only the TEE decrypts them." },
  { title: "Replay Protection",          desc: "On-chain intent mapping. Every nonce used exactly once. Replays revert at the EVM level." },
  { title: "MEV Shield",                 desc: "minAmountOut enforced by VeilSolver.sol. Sandwich attacks revert on the back leg — bot loses gas." },
  { title: "2-Line SDK",                 desc: "solver.solve({ ... }) is all you need. Composable with any protocol in two hours." },
]

const PROBLEMS = [
  { title: "Leaked Intents",        desc: "AI strategies exposed through API logs, inferred from patterns. Your alpha is not yours." },
  { title: "Front-running",         desc: "Transactions visible in the mempool before execution. Bots see your trade before it settles." },
  { title: "No Privacy Guarantee",  desc: '"Private" APIs are just policy promises, not architecture. One breach and your strategy is public.' },
]

const HOW_STEPS = [
  { num: "01", title: "Build & Encrypt",   desc: "Intent encrypted ECIES client-side with the solver's enclave public key. The solver never sees plaintext." },
  { num: "02", title: "TEE Inference",     desc: "AI computes the execution plan inside an Intel TDX enclave. Strategy logic is private by hardware." },
  { num: "03", title: "Atomic Settlement", desc: "Plan verified via ECDSA on 0G Chain. minAmountOut enforced by VeilSolver.sol. Sandwich attacks revert." },
]

const TEE_POINTS = [
  { label: "Intel TDX",              detail: "Hardware-isolated execution — host OS cannot read enclave memory" },
  { label: "ECDSA Attestation",      detail: "Solver signs every plan — contract verifies via ecrecover" },
  { label: "Zero knowledge leakage", detail: "strategy.reasoning stripped before serialization, never logged" },
  { label: "Key never exported",     detail: "Enclave private key lives inside TDX — rotation via updateSolverKey()" },
]

const INFRA = [
  { tag: "0G Compute", sub: "Sealed AI inference · Intel TDX · GLM-5-FP8",           desc: "TeeML hardware attestation — enclave private key never exported. Your strategy executes in isolation." },
  { tag: "0G Storage", sub: "Encrypted audit trail · Content-addressed · Immutable",  desc: "Every solve hashed to a merkle root. Emitted in IntentExecuted events — queryable from chain, no index needed." },
  { tag: "0G Chain",   sub: "Settlement layer · EVM-compatible · chainId 16602",      desc: "Cancun-compatible EVM. ecrecover enforces solver signature. executedIntents mapping blocks all replays." },
]

export default function LandingPage() {
  useEffect(() => {
    let fadeObserverRef: IntersectionObserver | null = null
    let capObserverRef: IntersectionObserver | null = null
    const cycleTimers: ReturnType<typeof setTimeout>[] = []

    import('animejs').then(({ animate, stagger }) => {
      // ── Stagger fade-up for basic card groups (fires once) ─────────────────
      document.querySelectorAll<HTMLElement>('[data-anime-card]').forEach(el => {
        el.style.opacity = '0'
        el.style.transform = 'translateY(36px)'
      })

      fadeObserverRef = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return
          const cards = entry.target.querySelectorAll('[data-anime-card]')
          if (cards.length) {
            animate(cards, {
              opacity: [0, 1],
              y: [36, 0],
              ease: 'outCubic',
              duration: 650,
              delay: stagger(85),
            })
          }
          fadeObserverRef!.unobserve(entry.target)
        })
      }, { threshold: 0.12 })

      document.querySelectorAll('[data-anime-group]').forEach(el => fadeObserverRef!.observe(el))

      // ── Capabilities: stagger entrance + accent line draw ─────────────────
      const capSection = document.querySelector('[data-cap-section]')
      if (capSection) {
        const capCards = capSection.querySelectorAll<HTMLElement>('.cap-item')
        const capAccents = capSection.querySelectorAll<HTMLElement>('.cap-accent')
        capCards.forEach(el => { el.style.opacity = '0'; el.style.transform = 'translateY(40px)' })
        capAccents.forEach(el => { el.style.width = '0px' })

        capObserverRef = new IntersectionObserver(entries => {
          entries.forEach(entry => {
            if (!entry.isIntersecting) return
            animate(capCards, {
              opacity: [0, 1],
              translateY: [40, 0],
              ease: 'outCubic',
              duration: 650,
              delay: stagger(90),
            })
            animate(capAccents, {
              width: ['0px', '32px'],
              ease: 'outCubic',
              duration: 500,
              delay: stagger(90, { start: 220 }),
            })
            capObserverRef!.unobserve(entry.target)
          })
        }, { threshold: 0.12 })
        capObserverRef.observe(capSection)
      }
    })

    return () => {
      fadeObserverRef?.disconnect()
      capObserverRef?.disconnect()
      cycleTimers.forEach(clearTimeout)
    }
  }, [])

  return (
    <main style={S.main}>
      <style>{`
        [data-anime-card] { will-change: transform, opacity; }
        .cap-item { will-change: transform, opacity; }
        .cap-item:hover { transform: translateY(-5px) !important; box-shadow: 0 12px 40px rgba(0,0,0,0.18) !important; }
        .cap-item:hover .cap-accent { width: 56px !important; }
        @keyframes threatPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(0.7); }
        }
        @keyframes flowTravel {
          0%   { left: -10px; opacity: 0; }
          8%   { opacity: 1; }
          92%  { opacity: 1; }
          100% { left: calc(100% + 10px); opacity: 0; }
        }
        .flow-connector { position: relative; flex: 1; height: 1px; background: rgba(0,0,0,0.12); align-self: center; overflow: visible; min-width: 24px; }
        .flow-connector::before {
          content: '';
          position: absolute;
          right: -1px; top: 50%;
          transform: translateY(-50%);
          border-left: 5px solid rgba(0,0,0,0.25);
          border-top: 3px solid transparent;
          border-bottom: 3px solid transparent;
        }
        .flow-connector::after {
          content: '';
          position: absolute;
          top: 50%; transform: translateY(-50%);
          width: 7px; height: 7px; border-radius: 50%;
          background: #111111;
          animation: flowTravel 2s cubic-bezier(.4,0,.6,1) infinite;
        }
        .flow-connector-2::after { animation-delay: 0.66s; }
        .flow-connector-3::after { animation-delay: 1.33s; }
      `}</style>
      <ParticleBackground />

      {/* ── Nav ────────────────────────────────────────────────────────────── */}
      <header style={S.topNav} className="vs-nav">
        <div style={S.navLogo}>
          <img src="/logo.png" alt="VeilSolver" style={{ width: 28, height: 28, objectFit: "contain" }} />
          <span style={S.logoText}>VeilSolver</span>
          <span style={S.logoDot} />
        </div>
        <nav style={S.navLinks} className="vs-nav-links">
          <Link href="/demo"     style={S.navLink}>Demo</Link>
          <Link href="/strategy" style={S.navLink}>Strategy</Link>
          <Link href="/docs"     style={S.navLink}>Docs</Link>
        </nav>
      </header>

      {/* ═══════════════════════════════════════════════════════════════════════
          HERO — ai.mp4 full-width background, text overlay
      ════════════════════════════════════════════════════════════════════════ */}
      <section style={S.hero}>
        <video src="https://duty-bucket-test.s3.ap-south-1.amazonaws.com/uploads/1777668831718-ai.mp4" autoPlay muted loop playsInline style={S.heroBgVideo} />
        <div style={S.heroOverlay} />
        <div style={S.heroContent} className="vs-hero-content">
          <h1 style={S.headline}>
            <span style={S.headlineWhite}>VeilSolver</span>
          </h1>
          <h2 style={S.subheadline}>MEV-resistant trade execution</h2>
          <p style={S.bodyText}>
            Encrypted intents · TEE-computed plans · Zero mempool exposure
          </p>
          <div style={S.ctaRow}>
            <Link href="/demo" style={S.ctaPrimaryWhite}>
              <span style={{ fontSize: 16 }}>⬡</span> Try Demo
            </Link>
            <Link href="/docs" style={S.ctaGhostWhite}>Read Docs →</Link>
          </div>
          <div style={S.statsRow}>
            <div style={S.stat}><span style={S.statVal}>$0</span><span style={S.statLabel}>MEV leaked</span></div>
            <div style={S.statSep}>·</div>
            <div style={S.stat}><span style={S.statVal}>TEE</span><span style={S.statLabel}>attested</span></div>
            <div style={S.statSep}>·</div>
            <div style={S.stat}><span style={S.statVal}>0G</span><span style={S.statLabel}>native</span></div>
          </div>
        </div>
        <div style={S.scrollIndicator}>↓ scroll</div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          PROBLEM
      ════════════════════════════════════════════════════════════════════════ */}
      <section style={S.problemSection} className="vs-section-pad">
        <div style={S.problemInner} className="vs-problem-inner">
          {/* Left */}
          <div style={S.problemLeft} className="vs-problem-left">
            <div style={S.problemBadge}>THE PROBLEM</div>
            <div style={S.problemBigNum}>$1B+</div>
            <p style={S.problemSubtext}>
              lost to MEV every year. Existing solutions protect transactions —
              not the AI strategies that produce them.
            </p>
            <div style={S.problemThreat}>
              <span style={S.problemDot} />
              <span style={S.problemThreatText}>active threat</span>
            </div>
          </div>
          {/* Right */}
          <div style={S.problemRight} data-anime-group>
            {PROBLEMS.map((p, i) => (
              <div key={p.title} style={S.problemCard} data-anime-card>
                <div style={S.problemCardNum}>0{i + 1}</div>
                <div style={S.problemCardBody}>
                  <div style={S.problemCardTitle}>{p.title}</div>
                  <div style={S.problemCardDesc}>{p.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          HOW IT WORKS
      ════════════════════════════════════════════════════════════════════════ */}
      <section style={S.sectionAlt} className="vs-section-pad">
        <div style={S.sectionInner}>
          <div style={S.sectionBadge}>HOW IT WORKS</div>
          <h2 style={S.sectionHeading}>Three steps. Zero leaks.</h2>
          <div style={S.threeGrid} className="vs-grid-3" data-anime-group>
            {HOW_STEPS.map(step => (
              <div key={step.num} style={S.card} data-anime-card>
                <div style={S.stepNum}>{step.num}</div>
                <h3 style={S.cardTitle}>{step.title}</h3>
                <p style={S.cardDesc}>{step.desc}</p>
              </div>
            ))}
          </div>
          <div style={S.flowDiagram} className="vs-flow-diagram">
            <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 0 }}>
              <div style={S.flowBox}>
                <div style={S.flowNodeTitle}>User</div>
                <div style={S.flowNodeSub}>client · ECIES encrypt</div>
              </div>
              <div className="flow-connector" />
              <div style={S.flowBox}>
                <div style={S.flowNodeTitle}>Solver API</div>
                <div style={S.flowNodeSub}>orchestrate · TDX route</div>
              </div>
              <div className="flow-connector flow-connector-2" />
              <div style={S.flowBoxHL}>
                <div style={S.flowNodeTitle}>TEE Enclave</div>
                <div style={S.flowNodeSub}>compute · private</div>
              </div>
              <div className="flow-connector flow-connector-3" />
              <div style={S.flowBox}>
                <div style={S.flowNodeTitle}>0G Chain</div>
                <div style={S.flowNodeSub}>settle · ECDSA verify</div>
              </div>
            </div>
          </div>
        </div>
      </section>

{/* ═══════════════════════════════════════════════════════════════════════
          FULL-WIDTH — deepmind.mp4
      ════════════════════════════════════════════════════════════════════════ */}
      <div style={S.videoStrip}>
        <video src="https://duty-bucket-test.s3.ap-south-1.amazonaws.com/uploads/1777668764485-deepmind.mp4" autoPlay muted loop playsInline style={S.stripVideo} />
        <div style={S.stripLabel}>
          <span style={S.stripDot} />
          GLM-5-FP8 · Intel TDX enclave · Sealed inference
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          FEATURES
      ════════════════════════════════════════════════════════════════════════ */}
    <section style={S.section} className="vs-section-pad" data-cap-section>
  <div style={S.sectionInner}>
    <div style={S.sectionBadge}>CAPABILITIES</div>
    <h2 style={S.sectionHeading}>Every guarantee enforced by cryptography</h2>
    <div className="vs-cap-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
      {FEATURES.map((f, i) => {
        const t = CAP_THEMES[i]
        return (
          <div key={f.title} className="cap-item" style={{
            ...S.card,
            gridColumn: `span ${CAP_SPANS[i]}`,
            background: t.bg,
            border: t.border,
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div className="cap-accent" style={{ ...S.cardAccent, background: t.accent, width: 32 }} />
            <h3 style={{ ...S.cardTitle, color: t.title }}>{f.title}</h3>
            <p style={{ ...S.cardDesc, color: t.desc }}>{f.desc}</p>
          </div>
        )
      })}
    </div>
  </div>
</section>

      {/* ═══════════════════════════════════════════════════════════════════════
          TEE ENCLAVE — wave video background, text overlay
      ════════════════════════════════════════════════════════════════════════ */}
      <div style={S.teeSection}>
        <video src="https://duty-bucket-test.s3.ap-south-1.amazonaws.com/uploads/1777668867535-15682105_3840_2160_30fps.mp4" autoPlay muted loop playsInline style={S.teeBgVideo} />
        <div style={S.teeVideoOverlay} />
        <div style={S.teeOverContent} className="vs-tee-content">
          <div style={S.teeBadge}>TEE ENCLAVE</div>
          <h2 style={S.teeHeading}>The enclave is the trust root</h2>
          <p style={S.teeSub}>
            A fully compromised server still cannot read your intent or forge a valid plan.<br />
            Hardware isolation — not operator promises.
          </p>
          <div style={S.teePointsGrid} className="vs-tee-points">
            {TEE_POINTS.map(p => (
              <div key={p.label} style={S.teePointOver}>
                <div style={S.teeCheckOver}>✓</div>
                <div>
                  <div style={S.teeLabelOver}>{p.label}</div>
                  <div style={S.teeDetailOver}>{p.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          BUILT ON 0G
      ════════════════════════════════════════════════════════════════════════ */}
      <section style={S.section} className="vs-section-pad">
        <div style={S.sectionInner}>
          <div style={S.sectionBadge}>INFRASTRUCTURE</div>
          <h2 style={S.sectionHeading}>Built on 0G</h2>
          <p style={S.sectionSub}>Full-stack decentralized AI infrastructure — compute, storage, and settlement.</p>
          <div style={S.threeGrid} className="vs-grid-3" data-anime-group>
            {INFRA.map(c => (
              <div key={c.tag} style={S.card} data-anime-card>
                <div style={S.infraTag}>{c.tag}</div>
                <div style={S.infraSub}>{c.sub}</div>
                <div style={S.infraDivider} />
                <p style={S.cardDesc}>{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          CTA — shared footer
      ════════════════════════════════════════════════════════════════════════ */}
      <CTAFooter />

    </main>
  )
}

const S: Record<string, React.CSSProperties> = {
  main: {
    minHeight: "100vh",
    background: "#f8f5ee",
    color: "#111111",
    fontFamily: "var(--font-mono), 'IBM Plex Mono', monospace",
    overflowX: "hidden",
    position: "relative",
  },

  // ── Nav ───────────────────────────────────────────────────────────────────
  topNav: {
    position: "fixed",
    top: 20,
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 100,
    width: "40%",
    display: "flex", alignItems: "center", justifyContent: "space-between",
    height: 64, padding: "0 28px",
    background: "rgba(248,245,238,0.45)",
    backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
    border: "1px solid rgba(0,0,0,0.08)",
    borderRadius: 14,
  },
  navLogo: { display: "flex", alignItems: "center", gap: 8, userSelect: "none" },
  logoText: { fontSize: 16, fontWeight: 700, color: "#111111", letterSpacing: "-0.3px" },
  logoDot:  { width: 5, height: 5, borderRadius: "50%", background: "#111111", marginBottom: 10 },
  navLinks: { display: "flex", alignItems: "center", gap: 4 },
  navLink:  { fontSize: 15, fontWeight: 500, color: "rgba(17,17,17,0.45)", textDecoration: "none", padding: "6px 16px", borderRadius: 6 },
  navCta:   { fontSize: 14, fontWeight: 700, color: "#ffffff", textDecoration: "none", background: "#111111", padding: "8px 20px", borderRadius: 6, letterSpacing: "0.3px" },

  // ── Hero — ai.mp4 background ──────────────────────────────────────────────
  hero: {
    position: "relative",
    width: "100%", height: "100vh",
    display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    overflow: "hidden",
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  heroBgVideo: {
    position: "absolute", inset: 0,
    width: "100%", height: "100%",
    objectFit: "cover",
    zIndex: 0,
  },
  heroOverlay: {
    position: "absolute", inset: 0,
    background: "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.35) 50%, rgba(0,0,0,0.65) 100%)",
    zIndex: 1,
  },
  heroContent: {
    position: "relative", zIndex: 2,
    textAlign: "center",
    display: "flex", flexDirection: "column", alignItems: "center",
    maxWidth: 800, padding: "0 32px",
    animation: "fade-up 0.8s ease forwards",
  },
  badge: {
    display: "inline-flex", alignItems: "center", gap: 8,
    fontSize: 11, fontWeight: 700, letterSpacing: "2px",
    color: "rgba(255,255,255,0.75)",
    background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)",
    padding: "7px 18px", borderRadius: 4, marginBottom: 40,
  },
  badgeDot: { width: 7, height: 7, borderRadius: "50%", background: "#ffffff", animation: "pulse-dot 1.8s ease-in-out infinite" },
  headline: { fontSize: "clamp(72px, 11vw, 128px)", fontWeight: 700, lineHeight: 1.0, letterSpacing: "-3px", marginBottom: 24 },
  headlineWhite: { color: "#ffffff" },
  subheadline: { fontSize: "clamp(22px, 3vw, 36px)", fontWeight: 700, color: "rgba(255,255,255,0.85)", letterSpacing: "-0.5px", marginBottom: 18 },
  bodyText: { fontSize: 18, color: "rgba(255,255,255,0.5)", lineHeight: 1.65, letterSpacing: "0.2px", marginBottom: 48 },
  ctaRow: { display: "flex", alignItems: "center", gap: 16, marginBottom: 56, flexWrap: "wrap", justifyContent: "center" },
  ctaPrimaryWhite: {
    display: "inline-flex", alignItems: "center", gap: 10,
    background: "#ffffff", color: "#111111", textDecoration: "none",
    padding: "16px 32px", borderRadius: 8, fontSize: 16, fontWeight: 700, letterSpacing: "0.3px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
    fontFamily: "var(--font-mono), 'IBM Plex Mono', monospace",
  },
  ctaGhostWhite: {
    display: "inline-flex", alignItems: "center", gap: 10,
    background: "transparent", color: "rgba(255,255,255,0.75)", textDecoration: "none",
    padding: "16px 32px", borderRadius: 8, fontSize: 16, fontWeight: 600,
    border: "1px solid rgba(255,255,255,0.25)",
    fontFamily: "var(--font-mono), 'IBM Plex Mono', monospace",
  },
  statsRow: { display: "flex", alignItems: "center", gap: 32 },
  stat:     { display: "flex", flexDirection: "column", alignItems: "center", gap: 4 },
  statVal:  { fontSize: 28, fontWeight: 700, color: "#ffffff" },
  statLabel:{ fontSize: 13, color: "rgba(255,255,255,0.4)", letterSpacing: "0.5px" },
  statSep:  { fontSize: 22, color: "rgba(255,255,255,0.2)" },
  scrollIndicator: {
    position: "absolute", bottom: 28, left: "50%", transform: "translateX(-50%)",
    fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: "2px", zIndex: 2,
    animation: "fade-up 0.6s ease 1.2s both",
  },

  // ── Problem section ───────────────────────────────────────────────────────
  problemSection: {
    position: "relative", zIndex: 1,
    background: "#0f0f0f",
    padding: "96px 40px",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  problemInner: {
    maxWidth: 1080, margin: "0 auto",
    display: "flex", alignItems: "flex-start", gap: 80,
  },
  problemLeft: {
    flex: "0 0 380px",
    display: "flex", flexDirection: "column" as const, alignItems: "flex-start",
    position: "sticky" as const, top: 120,
  },
  problemBadge: {
    fontSize: 11, fontWeight: 700, letterSpacing: "2.5px",
    color: "rgba(255,60,60,0.7)", marginBottom: 28,
  },
  problemBigNum: {
    fontSize: "clamp(72px, 10vw, 108px)", fontWeight: 700,
    color: "#ffffff", letterSpacing: "-3px", lineHeight: 1,
    marginBottom: 24,
  },
  problemSubtext: {
    fontSize: 16, color: "rgba(255,255,255,0.4)",
    lineHeight: 1.7, marginBottom: 36,
  },
  problemThreat: {
    display: "flex", alignItems: "center", gap: 10,
  },
  problemDot: {
    width: 8, height: 8, borderRadius: "50%",
    background: "#ff3c3c",
    animation: "threatPulse 1.6s ease-in-out infinite",
    display: "inline-block",
  },
  problemThreatText: {
    fontSize: 12, fontWeight: 600, letterSpacing: "1.5px",
    color: "rgba(255,60,60,0.6)", textTransform: "uppercase" as const,
  },
  problemRight: {
    flex: 1,
    display: "flex", flexDirection: "column" as const, gap: 2,
  },
  problemCard: {
    display: "flex", alignItems: "flex-start", gap: 24,
    padding: "32px 0",
    borderTop: "1px solid rgba(255,255,255,0.06)",
  },
  problemCardNum: {
    fontSize: 12, fontWeight: 700, color: "rgba(255,60,60,0.5)",
    letterSpacing: "1px", flexShrink: 0, paddingTop: 4,
  },
  problemCardBody: { flex: 1 },
  problemCardTitle: {
    fontSize: 22, fontWeight: 700, color: "#ffffff",
    marginBottom: 10, letterSpacing: "-0.3px",
  },
  problemCardDesc: {
    fontSize: 15, color: "rgba(255,255,255,0.4)", lineHeight: 1.7,
  },

  // ── Sections ──────────────────────────────────────────────────────────────
  section:    { position: "relative", zIndex: 1, padding: "96px 40px", background: "#f8f5ee" },
  sectionAlt: { position: "relative", zIndex: 1, padding: "96px 40px", background: "#ffffff" },
  sectionInner: { maxWidth: 1080, margin: "0 auto" },
  sectionBadge: { fontSize: 11, fontWeight: 700, letterSpacing: "2.5px", color: "#111111", marginBottom: 18, opacity: 0.45 },
  sectionHeading: { fontSize: "clamp(36px, 4vw, 56px)", fontWeight: 700, color: "#111111", letterSpacing: "-0.8px", marginBottom: 18, lineHeight: 1.1 },
  sectionSub: { fontSize: 17, color: "rgba(17,17,17,0.5)", lineHeight: 1.65, marginBottom: 52, maxWidth: 600 },

  // Grids
  threeGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 },
  sixGrid:   { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 },

  // Cards
  card: {
    background: "#ffffff", border: "1px solid rgba(0,0,0,0.07)",
    borderRadius: 14, padding: "32px 28px",
    boxShadow: "0 2px 16px rgba(0,0,0,0.05)",
    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s ease',
  cursor: 'pointer',
  zIndex: 1,
  },
  cardAccent: { height: 2, marginBottom: 18, transition: 'width 0.3s ease' },
  cardTitle:  { fontSize: 18, fontWeight: 700, color: "#111111", marginBottom: 12 },
  cardDesc:   { fontSize: 15, color: "rgba(17,17,17,0.55)", lineHeight: 1.7 },

  // Step badge
  stepNum: {
    fontSize: 12, fontWeight: 700, color: "#111111",
    background: "rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.1)",
    borderRadius: 4, padding: "4px 10px", display: "inline-block",
    marginBottom: 16, letterSpacing: "1px",
  },

  // Flow diagram
  flowDiagram: {
    marginTop: 32, border: "1px solid rgba(0,0,0,0.07)",
    borderRadius: 10, padding: "20px 28px",
  },
  flowBox: {
    fontSize: 13, fontWeight: 600, color: "#111111",
    background: "#ffffff", border: "1px solid rgba(0,0,0,0.1)",
    borderRadius: 6, padding: "10px 18px", whiteSpace: "nowrap" as const,
    flexShrink: 0,
  },
  flowBoxHL: {
    fontSize: 13, fontWeight: 700, color: "#111111",
    background: "rgba(0,0,0,0.06)", border: "1px solid rgba(0,0,0,0.2)",
    borderRadius: 6, padding: "10px 18px", whiteSpace: "nowrap" as const,
    flexShrink: 0,
  },
  flowArrow: { fontSize: 13, color: "rgba(17,17,17,0.3)", padding: "0 10px", whiteSpace: "nowrap" as const },

  // Flow node labels
  flowNodeTitle: { fontSize: 14, fontWeight: 700, color: "#111111", lineHeight: 1.3 },
  flowNodeSub:   { fontSize: 11, color: "rgba(17,17,17,0.4)", letterSpacing: "0.2px", marginTop: 4 },

  // Features
  featIcon: { fontSize: 28, marginBottom: 16, display: "block" },

  // TEE section — wave video background, text left
  teeSection: {
    position: "relative",
    width: "100%",
    minHeight: "80vh",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    borderRadius: 32,
  },
  teeBgVideo: {
    position: "absolute", top: 0, left: 0,
    width: "100%", height: "100%",
    objectFit: "cover", zIndex: 0,
  },
  // And if you can apply a hover state via CSS or a state hook:
cardHover: {
  transform: 'translateY(-8px)',
  boxShadow: '0 12px 24px rgba(0,0,0,0.1)',
  zIndex: 10, // Ensures the card stays on top of neighbors when it lifts
},
  teeVideoOverlay: {
    position: "absolute", inset: 0,
    background: "linear-gradient(to right, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.55) 55%, rgba(0,0,0,0.1) 100%)",
    zIndex: 1,
  },
  teeOverContent: {
    position: "relative", zIndex: 2,
    maxWidth: 560,
    padding: "80px 64px",
    display: "flex", flexDirection: "column" as const, alignItems: "flex-start",
  },
  teeBadge: {
    fontSize: 11, fontWeight: 700, letterSpacing: "2.5px",
    color: "rgba(255,255,255,0.45)",
    marginBottom: 18,
  },
  teeHeading: {
    fontSize: "clamp(36px, 4vw, 56px)", fontWeight: 700,
    color: "#ffffff", letterSpacing: "-0.8px", lineHeight: 1.1,
    marginBottom: 20,
  },
  teeSub: {
    fontSize: 17, color: "rgba(255,255,255,0.5)",
    lineHeight: 1.65, marginBottom: 52, maxWidth: 580,
  },
  teePointsGrid: {
    display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 32,
    width: "100%",
  },
  teePointOver: { display: "flex", alignItems: "flex-start", gap: 16 },
  teeCheckOver: {
    width: 28, height: 28, borderRadius: "50%",
    background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.25)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 14, color: "#ffffff", fontWeight: 700, flexShrink: 0, marginTop: 2,
  },
  teeLabelOver:  { fontSize: 17, fontWeight: 700, color: "#ffffff", marginBottom: 6 },
  teeDetailOver: { fontSize: 14, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 },

  // Legacy (unused now but kept to avoid TS errors)
  teePoints: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 28 },
  teePoint:  { display: "flex", alignItems: "flex-start", gap: 16 },
  teeCheck:  {
    width: 26, height: 26, borderRadius: "50%",
    background: "rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.12)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 13, color: "#111111", fontWeight: 700, flexShrink: 0, marginTop: 2,
  },
  teeLabel:  { fontSize: 16, fontWeight: 700, color: "#111111", marginBottom: 5 },
  teeDetail: { fontSize: 14, color: "rgba(17,17,17,0.5)", lineHeight: 1.6 },

  // Infra
  infraTag:     { fontSize: 18, fontWeight: 700, color: "#111111", marginBottom: 5 },
  infraSub:     { fontSize: 12, color: "rgba(17,17,17,0.4)", letterSpacing: "0.3px", marginBottom: 16 },
  infraDivider: { height: 1, background: "linear-gradient(90deg, rgba(0,0,0,0.15), transparent)", marginBottom: 16 },

  // ── Full-width video strips ───────────────────────────────────────────────
  videoStrip: {
    position: "relative", width: "100%", height: "65vh", overflow: "hidden",
  },
  stripVideo: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  stripLabel: {
    position: "absolute", bottom: 20, left: 28,
    display: "flex", alignItems: "center", gap: 10,
    fontSize: 13, fontWeight: 600, letterSpacing: "1px",
    color: "rgba(255,255,255,0.8)",
    background: "rgba(0,0,0,0.38)", backdropFilter: "blur(10px)",
    padding: "9px 18px", borderRadius: 6, zIndex: 2,
  },
  stripDot: { width: 8, height: 8, borderRadius: "50%", background: "#ffffff", animation: "pulse-dot 1.8s ease-in-out infinite", flexShrink: 0 },

  // ── CTA strip ─────────────────────────────────────────────────────────────
  ctaStrip: {
    position: "relative", width: "100%", height: "80vh",
    overflow: "hidden", display: "flex", alignItems: "center",
  },
  ctaOverlay: {
    position: "absolute", inset: 0,
    background: "linear-gradient(to right, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.45) 55%, rgba(0,0,0,0.1) 100%)",
    zIndex: 1,
  },
  ctaContent: {
    position: "relative", zIndex: 2,
    maxWidth: 520, padding: "0 60px",
    display: "flex", flexDirection: "column" as const, alignItems: "flex-start",
  },
  ctaHeading: { fontSize: "clamp(44px, 5vw, 72px)", fontWeight: 700, color: "#ffffff", letterSpacing: "-1.5px", marginBottom: 20 },
  ctaSubtext: { fontSize: 18, color: "rgba(255,255,255,0.5)", marginBottom: 40, lineHeight: 1.65 },
  ctaButtons: { display: "flex", alignItems: "center", gap: 16, marginBottom: 44, flexWrap: "wrap" },
  ctaNote:    { fontSize: 13, color: "rgba(255,255,255,0.22)", letterSpacing: "0.5px" },

  // Legacy - kept for inline overrides
  ctaPrimary: {
    display: "inline-flex", alignItems: "center", gap: 8,
    background: "#111111", color: "#ffffff", textDecoration: "none",
    padding: "14px 28px", borderRadius: 8, fontSize: 14, fontWeight: 700,
    fontFamily: "var(--font-mono), 'IBM Plex Mono', monospace",
  },
  ctaGhost: {
    display: "inline-flex", alignItems: "center", gap: 8,
    background: "transparent", color: "rgba(17,17,17,0.65)", textDecoration: "none",
    padding: "14px 28px", borderRadius: 8, fontSize: 14, fontWeight: 600,
    border: "1px solid rgba(0,0,0,0.14)",
    fontFamily: "var(--font-mono), 'IBM Plex Mono', monospace",
  },
}
