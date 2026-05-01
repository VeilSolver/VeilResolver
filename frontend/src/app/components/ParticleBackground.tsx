"use client"

import { useEffect, useRef } from "react"

interface Particle {
  x: number; y: number
  vx: number; vy: number
  size: number
  opacity: number
  pulse: number
  pulseSpeed: number
}

export default function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let animId: number
    let W = 0, H = 0
    const PARTICLE_COUNT = 70
    const CONNECTION_DIST = 130
    const particles: Particle[] = []

    function resize() {
      W = canvas!.width  = window.innerWidth
      H = canvas!.height = window.innerHeight
    }

    function initParticles() {
      particles.length = 0
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push({
          x: Math.random() * W,
          y: Math.random() * H,
          vx: (Math.random() - 0.5) * 0.25,
          vy: (Math.random() - 0.5) * 0.25,
          size: Math.random() * 1.8 + 0.4,
          opacity: Math.random() * 0.45 + 0.15,
          pulse: Math.random() * Math.PI * 2,
          pulseSpeed: 0.008 + Math.random() * 0.012,
        })
      }
    }

    function draw() {
      ctx!.clearRect(0, 0, W, H)

      // Move particles
      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy
        p.pulse += p.pulseSpeed
        // wrap around edges with a soft margin
        if (p.x < -20)  p.x = W + 20
        if (p.x > W+20) p.x = -20
        if (p.y < -20)  p.y = H + 20
        if (p.y > H+20) p.y = -20
      }

      // Draw connections between nearby particles
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        for (let j = i + 1; j < PARTICLE_COUNT; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const d  = Math.sqrt(dx * dx + dy * dy)
          if (d < CONNECTION_DIST) {
            const alpha = (1 - d / CONNECTION_DIST) * 0.12
            ctx!.strokeStyle = `rgba(0,0,0,${alpha * 0.6})`
            ctx!.lineWidth   = 0.8
            ctx!.beginPath()
            ctx!.moveTo(particles[i].x, particles[i].y)
            ctx!.lineTo(particles[j].x, particles[j].y)
            ctx!.stroke()
          }
        }
      }

      // Draw particles with pulsing glow
      for (const p of particles) {
        const glow = Math.sin(p.pulse) * 0.5 + 0.5
        const r    = p.size * (1 + glow * 0.4)
        const a    = p.opacity * (0.7 + glow * 0.3)

        // Outer glow ring
        ctx!.beginPath()
        const gradient = ctx!.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 4)
        gradient.addColorStop(0,   `rgba(124,58,237,${a * 0.2})`)
        gradient.addColorStop(0.5, `rgba(124,58,237,${a * 0.1})`)
        gradient.addColorStop(1,   `rgba(124,58,237,0)`)
        ctx!.fillStyle = gradient
        ctx!.arc(p.x, p.y, r * 4, 0, Math.PI * 2)
        ctx!.fill()

        // Core dot
        ctx!.beginPath()
        ctx!.fillStyle = `rgba(80,40,160,${a})`
        ctx!.arc(p.x, p.y, r, 0, Math.PI * 2)
        ctx!.fill()
      }

      // Occasional "data burst" — a hex-shaped flash at random particle
      if (Math.random() < 0.004) {
        const p = particles[Math.floor(Math.random() * PARTICLE_COUNT)]
        ctx!.strokeStyle = "rgba(124,58,237,0.3)"
        ctx!.lineWidth   = 0.8
        ctx!.beginPath()
        for (let k = 0; k < 6; k++) {
          const angle = (k * Math.PI) / 3
          const x = p.x + 8 * Math.cos(angle)
          const y = p.y + 8 * Math.sin(angle)
          k === 0 ? ctx!.moveTo(x, y) : ctx!.lineTo(x, y)
        }
        ctx!.closePath()
        ctx!.stroke()
      }

      animId = requestAnimationFrame(draw)
    }

    resize()
    initParticles()
    draw()

    window.addEventListener("resize", () => { resize(); initParticles() })
    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener("resize", () => { resize(); initParticles() })
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        opacity: 0.4,
      }}
    />
  )
}
