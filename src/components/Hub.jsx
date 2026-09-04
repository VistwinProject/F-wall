import { blockOf, HUB_ID } from '../config/wallTuning.js'
import { COLORS, MOTION, RADIUS } from '../config/theme.js'
import { FX, LINE_W, LINE_W_IDLE } from '../config/fx.js'

// ============================================================================
// 中央 AI 核心。與九個家電同一個性質，所以畫法也一模一樣：
// 純黑挖空 + 白框，active（有任何一張卡片在感應）時提亮一階並補上會呼吸的淡藍光暈。
//
// ⚠ x/y 是【中心】，rect 要自己減半 —— 與 ApplianceBlock 同一個約定。
// ⚠ fill="#000" 不是配色選擇：投影機的黑 = 不出光，這塊是實體展品的預留位。
//    所以這裡【不放任何文字】。置中的字會直接把投影光打在展品上。
// ============================================================================
export default function Hub({ activeCount = 0 }) {
  // ⚠ 幾何從 wallTuning 讀 —— 編輯模式搬動核心黑塊時這裡要跟著動。
  const { x, y, w, h } = blockOf(HUB_ID)
  const live = activeCount > 0
  return (
    <g>
      {/* 發光的外圈畫在底下那張 WebGL canvas 上（見 webgl/FrameLines.js）；
          這裡只負責把往框內溢的光蓋掉，並疊一圈銳利白框。 */}
      <rect
        x={x - w / 2}
        y={y - h / 2}
        width={w}
        height={h}
        rx={RADIUS.sm}
        fill="#000"
        // 與九個家電框同一個開關：關掉之後框完全交給 canvas 上的發光外圈，
        // 沒感應時就是全暗的一塊黑。黑底本身不能拿掉（要蓋住往框內溢的 bloom）。
        stroke={FX.svgBlockStroke ? (live ? COLORS.lineActive : COLORS.lineStrong) : 'none'}
        strokeWidth={live ? LINE_W : LINE_W_IDLE}
        style={{
          transition: `stroke ${MOTION.dur}s ${MOTION.easeCss}, stroke-width ${MOTION.dur}s ${MOTION.easeCss}`,
        }}
      />
    </g>
  )
}
