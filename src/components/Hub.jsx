import { HUB } from '../config/appliances.js'
import { COLORS, FONT, MOTION } from '../config/theme.js'

// ⚠ R 必須與 routing.js 的 RING_R 一致 —— 走線的接點(pad)就落在這個半徑上。
const R = 116

// ============================================================================
// 中央 AI 中樞。極簡版：一圈 hairline + 一個字，沒有同心環、放射刻度、旋轉弧、發光核。
// active 時整體提亮一階（純白高光），不做脈動。
// ============================================================================
export default function Hub({ activeCount = 0 }) {
  const { x, y } = HUB
  const live = activeCount > 0
  return (
    <g style={{ transition: `opacity ${MOTION.dur}s ${MOTION.easeCss}` }}>
      <circle
        cx={x}
        cy={y}
        r={R}
        fill="none"
        stroke={live ? COLORS.lineActive : COLORS.lineStrong}
        strokeWidth="1"
        style={{ transition: `stroke ${MOTION.dur}s ${MOTION.easeCss}` }}
      />
      <text
        x={x}
        y={y + 6}
        textAnchor="middle"
        fontSize="19"
        fill={live ? COLORS.text : COLORS.text2}
        style={{ fontFamily: FONT, letterSpacing: '3px', transition: `fill ${MOTION.dur}s ${MOTION.easeCss}` }}
      >
        AI 大腦
      </text>
    </g>
  )
}
