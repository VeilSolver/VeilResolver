"use client"

import { motion, Variants } from "motion/react"

const draw: Variants = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: (i: number) => ({
    pathLength: 1,
    opacity: 1,
    transition: {
      pathLength: { delay: i * 0.5, type: "spring", duration: 1.5, bounce: 0 },
      opacity:    { delay: i * 0.5, duration: 0.01 },
    },
  }),
}

const shape: React.CSSProperties = {
  strokeWidth: 10,
  strokeLinecap: "round" as const,
  fill: "transparent",
}

export default function PathDrawing() {
  return (
    <motion.svg
      width="600"
      height="600"
      viewBox="0 0 600 600"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.3 }}
      style={{ maxWidth: "min(600px, 90vw)", width: "100%", height: "auto" }}
    >
      <motion.circle cx="100" cy="100" r="80" stroke="#ff0088" variants={draw} custom={1} style={shape} />
      <motion.line x1="220" y1="30" x2="360" y2="170" stroke="#8df0cc" variants={draw} custom={2} style={shape} />
      <motion.line x1="220" y1="170" x2="360" y2="30" stroke="#8df0cc" variants={draw} custom={2.5} style={shape} />
      <motion.rect width="140" height="140" x="410" y="30" rx="20" stroke="#0d63f8" variants={draw} custom={3} style={shape} />

      <motion.circle cx="100" cy="300" r="80" stroke="#0d63f8" variants={draw} custom={2} style={shape} />
      <motion.line x1="220" y1="230" x2="360" y2="370" stroke="#ff0088" variants={draw} custom={3} style={shape} />
      <motion.line x1="220" y1="370" x2="360" y2="230" stroke="#ff0088" variants={draw} custom={3.5} style={shape} />
      <motion.rect width="140" height="140" x="410" y="230" rx="20" stroke="#8df0cc" variants={draw} custom={4} style={shape} />

      <motion.circle cx="100" cy="500" r="80" stroke="#8df0cc" variants={draw} custom={3} style={shape} />
      <motion.line x1="220" y1="430" x2="360" y2="570" stroke="#0d63f8" variants={draw} custom={4} style={shape} />
      <motion.line x1="220" y1="570" x2="360" y2="430" stroke="#0d63f8" variants={draw} custom={4.5} style={shape} />
      <motion.rect width="140" height="140" x="410" y="430" rx="20" stroke="#ff0088" variants={draw} custom={5} style={shape} />
    </motion.svg>
  )
}
