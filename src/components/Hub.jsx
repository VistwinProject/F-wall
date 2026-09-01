import { HUB } from '../config/appliances.js'
import { COLORS, FONT, MOTION } from '../config/theme.js'
import { HubGlow } from './NodeFx.jsx'
import { LINE_W_IDLE } from '../config/fx.js'

// ⚠ R 必須與 routing.js 的 RING_R 一致 —— 走線的接點(pad)就落在這個半徑上。
const R = 116

// ============================================================================
// 中央 AI 中樞。極簡版：一圈 hairline + 一個字，沒有同心環、放射刻度、旋轉弧、發光核。
// active 時整體提亮一階（純白高光），並補一圈會呼吸的淡藍光暈（見 NodeFx 的 HubGlow）。
// ============================================================================
export default function Hub({ activeCount = 0, fx = true }) {
  const { x, y } = HUB
  const live = activeCount > 0
  return (
    <g style={{ transition: `opacity ${MOTION.dur}s ${MOTION.easeCss}` }}>
      {/* 有卡片在感應時中樞也發光呼吸 —— 彗星飛過來要有個會回應的終點，
          否則資料抵達中樞就憑空消失。畫在圓環之前，白亮芯保持在最上面。 */}
      {live && fx && <HubGlow />}
      <circle
        cx={x}
        cy={y}
        r={R}
        fill="none"
        stroke={live ? COLORS.lineActive : COLORS.lineStrong}
        strokeWidth={LINE_W_IDLE}
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
