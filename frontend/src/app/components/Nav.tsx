"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

interface NavProps {
  address?: string
  onConnect?: () => void
}

const NAV_LINKS = [
  { label: "Demo",     href: "/demo"     },
  { label: "Strategy", href: "/strategy" },
  { label: "Docs",     href: "/docs"     },
]

export default function Nav({ address, onConnect }: NavProps) {
  const pathname = usePathname()

  return (
    <header style={S.header}>
      <div style={S.left}>
        <Link href="/" style={S.logoLink}>
          <span style={S.logoHex}>⬡</span>
          <span style={S.logoText}>VeilSolver</span>
          <span style={S.logoDot} />
        </Link>
      </div>

      <nav style={S.center}>
        {NAV_LINKS.map(link => {
          const isActive = pathname === link.href
          return (
            <Link
              key={link.href}
              href={link.href}
              style={isActive ? S.navLinkActive : S.navLink}
            >
              {link.label}
            </Link>
          )
        })}
      </nav>

      <div style={S.right}>
        {address ? (
          <div style={S.walletChip}>
            <span style={S.walletDot} />
            <span style={S.walletAddr}>{address.slice(0, 6)}…{address.slice(-4)}</span>
          </div>
        ) : onConnect ? (
          <button style={S.connectBtn} onClick={onConnect}>
            Connect
          </button>
        ) : null}
      </div>
    </header>
  )
}

const S: Record<string, React.CSSProperties> = {
  header: {
    position: "fixed",
    top: 20,
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 100,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    height: 64,
    padding: "0 28px",
    background: "rgba(248,245,238,0.55)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    border: "1px solid rgba(0,0,0,0.08)",
    borderRadius: 14,
    width: "clamp(500px, 48%, 720px)",
    gap: 8,
  },
  left: {
    display: "flex",
    alignItems: "center",
  },
  logoLink: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    textDecoration: "none",
    userSelect: "none",
  },
  logoHex: {
    fontSize: 20,
    color: "#111111",
  },
  logoText: {
    fontSize: 16,
    fontWeight: 700,
    color: "#111111",
    letterSpacing: "-0.3px",
    fontFamily: "var(--font-mono), 'IBM Plex Mono', monospace",
  },
  logoDot: {
    width: 5,
    height: 5,
    borderRadius: "50%",
    background: "#111111",
    marginBottom: 10,
  },
  center: {
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
  navLink: {
    fontSize: 15,
    fontWeight: 500,
    color: "rgba(17,17,17,0.45)",
    textDecoration: "none",
    padding: "6px 16px",
    borderRadius: 6,
    letterSpacing: "0.2px",
    fontFamily: "var(--font-mono), 'IBM Plex Mono', monospace",
    transition: "color 0.15s ease",
  },
  navLinkActive: {
    fontSize: 15,
    fontWeight: 600,
    color: "#111111",
    textDecoration: "none",
    padding: "6px 16px",
    borderRadius: 6,
    letterSpacing: "0.2px",
    fontFamily: "var(--font-mono), 'IBM Plex Mono', monospace",
    background: "rgba(0,0,0,0.06)",
    border: "1px solid rgba(0,0,0,0.12)",
  },
  right: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  walletChip: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    background: "rgba(0,0,0,0.05)",
    border: "1px solid rgba(0,0,0,0.1)",
    padding: "6px 12px",
    borderRadius: 6,
  },
  walletDot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: "#111111",
  },
  walletAddr: {
    fontSize: 13,
    color: "#111111",
    fontFamily: "var(--font-mono), 'IBM Plex Mono', monospace",
  },
  connectBtn: {
    background: "#111111",
    color: "#ffffff",
    border: "none",
    padding: "8px 18px",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 700,
    fontFamily: "var(--font-mono), 'IBM Plex Mono', monospace",
    letterSpacing: "0.3px",
  },
}
