import type { Metadata } from "next"
import { IBM_Plex_Mono } from "next/font/google"

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono"
})

export const metadata: Metadata = {
  title: "VeilSolver — MEV-resistant intent solver on 0G",
  description: "Private trade execution via TEE-attested AI on 0G Sealed Inference"
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <style>{`
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          html, body { height: 100%; }
          body {
            background: #f0e8d8;
            color: #111111;
            font-family: var(--font-mono), 'IBM Plex Mono', monospace;
            -webkit-font-smoothing: antialiased;
          }
          ::-webkit-scrollbar { width: 6px; }
          ::-webkit-scrollbar-track { background: #f0e8d8; }
          ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.18); border-radius: 3px; }
          ::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.3); }

          input[type=number]::-webkit-outer-spin-button,
          input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
          input[type=number] { -moz-appearance: textfield; }
          input::placeholder { color: rgba(0,0,0,0.3); }
          select option { background: #fff; color: #111; }

          @keyframes spin {
            from { transform: rotate(0deg); }
            to   { transform: rotate(360deg); }
          }
          @keyframes pulse-dot {
            0%, 100% { box-shadow: 0 0 0 0 rgba(17,17,17,0.4); }
            50%       { box-shadow: 0 0 0 6px rgba(17,17,17,0); }
          }
          @keyframes glow-breathe {
            0%, 100% { box-shadow: 0 2px 12px rgba(0,0,0,0.12); }
            50%       { box-shadow: 0 4px 24px rgba(0,0,0,0.22); }
          }
          @keyframes fade-up {
            from { opacity: 0; transform: translateY(12px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @keyframes scan {
            0%   { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
          @keyframes border-glow {
            0%, 100% { border-color: rgba(124,58,237,0.3); }
            50%       { border-color: rgba(124,58,237,0.7); }
          }
          @keyframes shimmer {
            0%   { background-position: -200% center; }
            100% { background-position: 200% center; }
          }
          @keyframes flicker {
            0%, 95%, 100% { opacity: 1; }
            96%            { opacity: 0.85; }
            97%            { opacity: 1; }
            98%            { opacity: 0.9; }
          }

          .step-active-dot {
            animation: pulse-dot 1.4s ease-in-out infinite;
          }
          .solve-btn-idle:hover {
            animation: glow-breathe 2s ease-in-out infinite;
          }

          /* ── Mobile responsive ─────────────────────────────────────────── */
          @media (max-width: 768px) {
            .vs-nav {
              width: calc(100vw - 32px) !important;
              padding: 0 14px !important;
            }
            .vs-nav-links a {
              padding: 6px 8px !important;
              font-size: 13px !important;
            }
            .vs-hero-section {
              padding: 108px 20px 40px !important;
            }
            .vs-main-inner {
              padding: 32px 20px 60px !important;
            }
            .vs-section-pad {
              padding: 64px 20px !important;
            }
            .vs-hero-content {
              padding: 0 16px !important;
            }
            .vs-problem-inner {
              flex-direction: column !important;
              gap: 40px !important;
            }
            .vs-problem-left {
              flex: none !important;
              position: static !important;
              width: 100% !important;
            }
            .vs-grid-3,
            .vs-demo-grid,
            .vs-strategy-grid,
            .vs-docs-grid {
              grid-template-columns: 1fr !important;
            }
            .vs-cap-grid {
              grid-template-columns: 1fr !important;
            }
            .vs-cap-grid .cap-item {
              grid-column: span 1 !important;
            }
            .vs-tee-points {
              grid-template-columns: 1fr !important;
              gap: 20px !important;
            }
            .vs-tee-content {
              padding: 48px 24px !important;
            }
            .vs-flow-diagram {
              overflow-x: auto !important;
            }
            .vs-cta-content {
              padding: 0 24px !important;
              max-width: 100% !important;
            }
          }
          @media (max-width: 480px) {
            .vs-nav-links {
              display: none !important;
            }
          }
          .result-card {
            animation: fade-up 0.4s ease forwards;
          }
          .spinner {
            display: inline-block;
            animation: spin 0.9s linear infinite;
          }
          .scan-line {
            position: absolute;
            top: 0; left: 0; right: 0;
            height: 2px;
            background: linear-gradient(90deg, transparent, rgba(124,58,237,0.5), transparent);
            animation: scan 2s linear infinite;
            pointer-events: none;
          }
        `}</style>
      </head>
      <body className={ibmPlexMono.variable}>
        {children}
      </body>
    </html>
  )
}
