import { HUB, COLORS } from '../config/appliances.js'

// 中央 AI 大腦核心：圓形同心環 + 放射刻度 + 分段弧 + 中央發光核（維持 teal）。
// 旋轉用 SVG 原生 animateTransform 繞中心點轉（穩定、不會飛）；核心不縮放，避免跳動。
const R = 116 // 外環半徑

// 放射狀刻度（每 6 格一根長刻度）
const TICKS = Array.from({ length: 72 }, (_, i) => {
  const a = (i / 72) * Math.PI * 2
  const long = i % 6 === 0
  const r2 = R - (long ? 13 : 6)
  return {
    x1: Math.cos(a) * R,
    y1: Math.sin(a) * R,
    x2: Math.cos(a) * r2,
    y2: Math.sin(a) * r2,
    long,
  }
})

export default function Hub({ activeCount }) {
  const lit = activeCount > 0
  const { x, y } = HUB

  return (
    <g>
      <defs>
        <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={COLORS.highlight} stopOpacity="1" />
          <stop offset="22%" stopColor={COLORS.active} stopOpacity="0.9" />
          <stop offset="60%" stopColor={COLORS.accent} stopOpacity="0.45" />
          <stop offset="100%" stopColor={COLORS.accent} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* 外環放射刻度：繞中心極慢旋轉 */}
      <g opacity="0.5" filter="url(#glow)">
        <animateTransform
          attributeName="transform"
          type="rotate"
          from={`0 ${x} ${y}`}
          to={`360 ${x} ${y}`}
          dur="60s"
          repeatCount="indefinite"
        />
        <circle cx={x} cy={y} r={R} fill="none" stroke={COLORS.accent2} strokeWidth="1" opacity="0.4" />
        {TICKS.map((t, i) => (
          <line
            key={i}
            x1={x + t.x1}
            y1={y + t.y1}
            x2={x + t.x2}
            y2={y + t.y2}
            stroke={t.long ? COLORS.active : COLORS.accent2}
            strokeWidth={t.long ? 1.6 : 1}
          />
        ))}
      </g>

      {/* 中環：反向更慢的分段弧 */}
      <g filter="url(#glow)">
        <animateTransform
          attributeName="transform"
          type="rotate"
          from={`360 ${x} ${y}`}
          to={`0 ${x} ${y}`}
          dur="50s"
          repeatCount="indefinite"
        />
        <circle
          cx={x}
          cy={y}
          r={R - 26}
          fill="none"
          stroke={COLORS.active}
          strokeWidth="2"
          strokeDasharray="40 26"
          opacity="0.5"
        />
      </g>

      {/* 內環：靜止細環 */}
      <circle cx={x} cy={y} r={R - 46} fill="none" stroke={COLORS.accent2} strokeWidth="1" opacity="0.4" />

      {/* 中央發光核：穩定發光，只在亮起時很輕微地呼吸（不縮放） */}
      <circle cx={x} cy={y} r={R - 34} fill="url(#coreGlow)" filter="url(#glow)" opacity={lit ? 0.95 : 0.62}>
        {lit && (
          <animate attributeName="opacity" values="0.82;1;0.82" dur="1.6s" repeatCount="indefinite" />
        )}
      </circle>

      {/* 核心亮點：穩定 */}
      <circle cx={x} cy={y} r="15" fill={COLORS.highlight} filter="url(#glowDot)" opacity={lit ? 1 : 0.85} />
    </g>
  )
}
