import { motion } from 'framer-motion'
import { APPLIANCES, HUB } from '../config/appliances.js'
import { getRoute, linePath, routeLength } from '../config/routing.js'
import { MOTION, RADIUS } from '../config/theme.js'
import { FX, FX_BLUE, DOTS, phaseOf } from '../config/fx.js'

// ============================================================================
// NFC 感應特效：黑塊白框 + 走線的淡藍光暈（呼吸），以及沿著走線飛向中樞的彗星。
//
// ⚠ 這一層必須畫在「走線之後、黑塊之前」（見 WallScene 的分層註解）：
//   1. 光暈是對稱擴散的，往框內溢的那半截要被黑塊的 fill="#000" 蓋掉，
//      才會只剩「黑塊外圍」在發光。投影機的黑 = 不出光，光溢進黑塊 = 實體展品被打亮。
//   2. 彗星每一輪的前段是停在起點（＝黑塊中心）等待的，停在黑塊底下就是隱形，
//      不需要另外做淡入淡出來製造封包之間的間隔。
// ============================================================================

// 中樞圓環半徑 —— 必須與 Hub.jsx 的 R、routing.js 的 RING_R 一致。
const HUB_R = 116

// 濾鏡區域 = (黑塊 bbox ∪ 走線 bbox) 外擴 FX.pad。
//
// ⚠ 為什麼要一台一個 filter，不共用一個：filterUnits="userSpaceOnUse" 的
//   x/y/width/height 寫死在 <filter> 上、所有使用者共用，九個元素就會各配一份
//   全畫布緩衝 = 9 × 1920×1080 = 18.7 Mpx。逐台裁緊之後總共只有 2.19 Mpx。
//
// ⚠ 也不能改用 objectBoundingBox 省事：socket 的走線是完美垂直線（960,900→960,656），
//   bbox 寬 0 → 濾鏡塌成零尺寸，光暈整個消失而且不報錯。frameGlow 已經記過這個坑。
function regionOf(node) {
  const { pts } = getRoute(node.id)
  const xs = [node.x - node.w / 2, node.x + node.w / 2, ...pts.map((p) => p.x)]
  const ys = [node.y - node.h / 2, node.y + node.h / 2, ...pts.map((p) => p.y)]
  const x = Math.min(...xs) - FX.pad
  const y = Math.min(...ys) - FX.pad
  return { x, y, w: Math.max(...xs) - x + FX.pad, h: Math.max(...ys) - y + FX.pad }
}

// 兩層「膨脹 → 模糊 → 衰減」，輸出【只有光暈、不含 SourceGraphic】。
// 亮芯由既有的 ApplianceTrace / ApplianceBlock 提供，這裡不重畫；
// 光暈疊在白亮芯上約 0.2 alpha 的淡藍，剛好就是「白芯 + 淡藍外暈」。
function GlowFilter({ id, region }) {
  const { near, outer } = FX.glow
  return (
    <filter
      id={id}
      filterUnits="userSpaceOnUse"
      x={region.x}
      y={region.y}
      width={region.w}
      height={region.h}
      colorInterpolationFilters="sRGB"
    >
      {outer.dilate > 0 && (
        <feMorphology in="SourceGraphic" operator="dilate" radius={outer.dilate} result="fatO" />
      )}
      <feGaussianBlur in={outer.dilate > 0 ? 'fatO' : 'SourceGraphic'} stdDeviation={outer.sd} result="bO" />
      <feComponentTransfer in="bO" result="outerGlow">
        <feFuncA type="linear" slope={outer.slope} />
      </feComponentTransfer>

      {near.dilate > 0 && (
        <feMorphology in="SourceGraphic" operator="dilate" radius={near.dilate} result="fatN" />
      )}
      <feGaussianBlur in={near.dilate > 0 ? 'fatN' : 'SourceGraphic'} stdDeviation={near.sd} result="bN" />
      <feComponentTransfer in="bN" result="nearGlow">
        <feFuncA type="linear" slope={near.slope} />
      </feComponentTransfer>

      <feMerge>
        <feMergeNode in="outerGlow" />
        <feMergeNode in="nearGlow" />
      </feMerge>
    </filter>
  )
}

// 九台的光暈濾鏡 + 中樞的 + 彗星光點共用的漸層。掛在 WallScene 的 <defs> 裡。
export function FxDefs() {
  return (
    <>
      {APPLIANCES.map((n) => (
        <GlowFilter key={n.id} id={`fxGlow-${n.id}`} region={regionOf(n)} />
      ))}
      <GlowFilter
        id="fxGlow-hub"
        region={{
          x: HUB.x - HUB_R - FX.pad,
          y: HUB.y - HUB_R - FX.pad,
          w: (HUB_R + FX.pad) * 2,
          h: (HUB_R + FX.pad) * 2,
        }}
      />

      {/* 彗星光點：用漸層而不是模糊濾鏡。漸層由 Chrome 直接光柵化並會抖動，
          天生沒有色帶，而且成本接近零 —— 一顆會動的元素若掛濾鏡，濾鏡就得跟著動。 */}
      {/* ⚠ 亮的部分要夠寬：拖尾是一串間距 5.9 單位的光點，若亮芯只有 2 單位寬，
          它們就會讀成「一排跑動的圓點」而不是一道連續的彗尾。這裡讓 α≥0.6 的區域
          撐到半徑的 55%（頭 r=6.5 → 直徑約 7.2 > 間距），前後才連得起來。 */}
      <radialGradient id="fxDot">
        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
        <stop offset="35%" stopColor="#FFFFFF" stopOpacity="0.92" />
        <stop offset="55%" stopColor="#E8F4FF" stopOpacity="0.62" />
        <stop offset="75%" stopColor="#BFE2FF" stopOpacity="0.28" />
        <stop offset="90%" stopColor={FX_BLUE} stopOpacity="0.08" />
        <stop offset="100%" stopColor={FX_BLUE} stopOpacity="0" />
      </radialGradient>
    </>
  )
}

// 一台家電的感應特效。只在 active 時掛載（WallScene 用 AnimatePresence 包）。
//
// ⚠ 進退場的 opacity 一定要放在外層 motion.g、呼吸放在內層 g.fx-glow ——
//   CSS animation 的層級高於 inline style，兩者掛同一個元素的話
//   framer-motion 的 exit={{opacity:0}} 會被呼吸動畫吃掉，退場完全看不見。
export function ApplianceFx({ node, index }) {
  const { pts } = getRoute(node.id)
  const d = linePath(pts)

  // 等速：九條線速度一律 FX.speed，長線就飛久一點。
  // ⚠ 不要反過來用固定週期去縮放飛行時間 —— 走線長度差 3.4 倍
  //   （socket 244、sensor 833），那樣 socket 會比 sensor 快三倍多。
  const travel = routeLength(pts) / FX.speed
  const cycle = Math.max(travel / FX.duty, FX.minCycle)
  const travelFrac = travel / cycle

  // keyPoints 是「路徑長度的比例」，配 calcMode="linear" 就是等速。
  // "0;0;1" = 前段停在起點（藏在黑塊底下）→ 這就是封包之間的間隔，不用淡入淡出。
  const keyTimes = `0;${(1 - travelFrac).toFixed(4)};1`
  const phase = phaseOf(index) * cycle

  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: MOTION.dur, ease: MOTION.ease }}
    >
      <g
        className="fx-glow"
        filter={`url(#fxGlow-${node.id})`}
        stroke={FX_BLUE}
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect
          x={node.x - node.w / 2}
          y={node.y - node.h / 2}
          width={node.w}
          height={node.h}
          rx={RADIUS.sm}
        />
        <path d={d} />
      </g>

      <g className="fx-comet">
        {DOTS.map((dot, i) => (
          <circle key={i} cx="0" cy="0" r={dot.r} fill="url(#fxDot)" opacity={dot.o}>
            {/* 拖尾：每節用自己的 animateMotion 沿同一條路徑落後一點點。
                不用 rotate="auto" 的單一拖尾形狀 —— 走線是折線（轉角 90/90/45），
                rotate 在頂點會瞬間甩 90°，拖尾看得出彈一下。 */}
            <animateMotion
              path={d}
              dur={`${cycle.toFixed(3)}s`}
              begin={`-${(phase + dot.lag).toFixed(3)}s`}
              repeatCount="indefinite"
              calcMode="linear"
              keyPoints="0;0;1"
              keyTimes={keyTimes}
            />
          </circle>
        ))}
      </g>
    </motion.g>
  )
}

// 中樞的光暈。彗星要有個會回應的終點，否則資料飛到中樞就憑空消失。
// 不做「每顆彗星抵達就漣漪一次」—— 九台同時亮時那會變成雜訊。
export function HubGlow() {
  return (
    <circle
      className="fx-glow"
      cx={HUB.x}
      cy={HUB.y}
      r={HUB_R}
      fill="none"
      stroke={FX_BLUE}
      strokeWidth="1.5"
      filter="url(#fxGlow-hub)"
    />
  )
}
