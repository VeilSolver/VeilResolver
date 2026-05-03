"use client"

import Link from "next/link"

export default function CTAFooter() {
  return (
    <div style={S.ctaStrip}>
      <video
        src="https://duty-bucket-test.s3.ap-south-1.amazonaws.com/uploads/1777716576496-7688616-uhd_4096_2160_24fps.mp4"
        autoPlay muted loop playsInline
        style={S.stripVideo}
      />
      <div style={S.ctaOverlay} />
      <div style={S.ctaContent} className="vs-cta-content">
        <div style={S.ctaBadge}>GET STARTED</div>
        <h2 style={S.ctaHeading}>Ready to build?</h2>
        <p style={S.ctaSubtext}>
          Private intent solver. Two-line SDK. No mempool exposure.
        </p>
        <div style={S.ctaButtons}>
          <Link href="/demo" style={S.ctaPrimaryWhite}>
            <span style={{ fontSize: 16 }}>⬡</span> Launch Demo
          </Link>
          <Link href="/docs" style={S.ctaGhostWhite}>Read the Docs</Link>
        </div>
        <div style={S.ctaNote}>VeilSolver · 0G APAC Hackathon 2026</div>
      </div>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  ctaStrip: {
    position: "relative",
    width: "100%",
    height: "80vh",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  stripVideo: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  ctaOverlay: {
    position: "absolute",
    inset: 0,
    background: "linear-gradient(to right, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.45) 55%, rgba(0,0,0,0.1) 100%)",
    zIndex: 1,
  },
  ctaContent: {
    position: "absolute",
    zIndex: 2,
    maxWidth: 520,
    padding: "0 60px",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
  },
  ctaBadge: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "2.5px",
    color: "rgba(255,255,255,0.5)",
    marginBottom: 18,
  },
  ctaHeading: {
    fontSize: "clamp(44px, 5vw, 72px)" as any,
    fontWeight: 700,
    color: "#ffffff",
    letterSpacing: "-1.5px",
    marginBottom: 20,
    fontFamily: "var(--font-mono), 'IBM Plex Mono', monospace",
  },
  ctaSubtext: {
    fontSize: 18,
    color: "rgba(255,255,255,0.5)",
    marginBottom: 40,
    lineHeight: 1.65,
    fontFamily: "var(--font-mono), 'IBM Plex Mono', monospace",
  },
  ctaButtons: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    marginBottom: 44,
    flexWrap: "wrap",
  },
  ctaNote: {
    fontSize: 13,
    color: "rgba(255,255,255,0.22)",
    letterSpacing: "0.5px",
    fontFamily: "var(--font-mono), 'IBM Plex Mono', monospace",
  },
  ctaPrimaryWhite: {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    background: "#ffffff",
    color: "#111111",
    textDecoration: "none",
    padding: "16px 32px",
    borderRadius: 8,
    fontSize: 16,
    fontWeight: 700,
    letterSpacing: "0.3px",
    fontFamily: "var(--font-mono), 'IBM Plex Mono', monospace",
    boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
  },
  ctaGhostWhite: {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    background: "transparent",
    color: "rgba(255,255,255,0.75)",
    textDecoration: "none",
    padding: "16px 32px",
    borderRadius: 8,
    fontSize: 16,
    fontWeight: 600,
    border: "1px solid rgba(255,255,255,0.25)",
    fontFamily: "var(--font-mono), 'IBM Plex Mono', monospace",
  },
}
