import { HUB } from '../config/appliances.js'
import { COLORS, MOTION, RADIUS } from '../config/theme.js'
import { HubGlow } from './NodeFx.jsx'
import { LINE_W, LINE_W_IDLE } from '../config/fx.js'

// ============================================================================
// 中央 AI 核心。與九個家電同一個性質，所以畫法也一模一樣：
// 純黑挖空 + 白框，active（有任何一張卡片在感應）時提亮一階並補上會呼吸的淡藍光暈。
//
// ⚠ x/y 是【中心】，rect 要自己減半 —— 與 ApplianceBlock 同一個約定。
// ⚠ fill="#000" 不是配色選擇：投影機的黑 = 不出光，這塊是實體展品的預留位。
//    所以這裡【不放任何文字】。原本置中的「AI 大腦」四個字會直接把光打在展品上。
// ============================================================================
export default function Hub({ activeCount = 0, fx = true }) {
  const { x, y, w, h } = HUB
  const live = activeCount > 0
  return (
    <g>
      {/* 光暈畫在黑塊【之前】：往框內溢的那半截要被 fill="#000" 蓋掉，
          才會只剩外圍在發光。與 NodeFx 的分層理由相同。 */}
      {live && fx && <HubGlow />}
      <rect
        x={x - w / 2}
        y={y - h / 2}
        width={w}
        height={h}
        rx={RADIUS.sm}
        fill="#000"
        stroke={live ? COLORS.lineActive : COLORS.lineStrong}
        strokeWidth={live ? LINE_W : LINE_W_IDLE}
        style={{
          transition: `stroke ${MOTION.dur}s ${MOTION.easeCss}, stroke-width ${MOTION.dur}s ${MOTION.easeCss}`,
        }}
      />
    </g>
  )
}
