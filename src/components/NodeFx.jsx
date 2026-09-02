import { motion } from 'framer-motion'
import { APPLIANCES, HUB } from '../config/appliances.js'
import { getRoute, roundedRoute, cometRoute } from '../config/routing.js'
import { MOTION, RADIUS } from '../config/theme.js'
import { FX, FX_BLUE, LINE_W, DOTS, BEAM_LAYERS, phaseOf } from '../config/fx.js'

// ============================================================================
// NFC 感應特效：黑塊白框 + 走線的淡藍光暈（呼吸 × 閃爍）、沿線掃過的能量光帶、
// 以及飛向中樞的彗星。核心白線不在這裡 —— 那是 ApplianceNode 的 ApplianceTrace，
// 因為它不受 ?nofx 管（「感應才亮起連接線」是行為本身，不是可以關掉的裝飾）。
//
// ⚠ 這一層必須畫在「走線之後、黑塊之前」（見 WallScene 的分層註解）：
//   1. 光暈是對稱擴散的，往框內溢的那半截要被黑塊的 fill="#000" 蓋掉，
//      才會只剩「黑塊外圍」在發光。投影機的黑 = 不出光，光溢進黑塊 = 實體展品被打亮。
//   2. 彗星每一輪的前段是停在起點（＝黑塊中心）等待的，停在黑塊底下就是隱形，
//      不需要另外做淡入淡出來製造封包之間的間隔。
// ============================================================================


// 濾鏡區域 = (黑塊 bbox ∪ 走線 bbox) 外擴 FX.pad。
//
// ⚠ 為什麼要一台一個 filter，不共用一個：filterUnits="userSpaceOnUse" 的
//   x/y/width/height 寫死在 <filter> 上、所有使用者共用，九個元素就會各配一份
//   全畫布緩衝 = 9 × 1920×1080 = 18.7 Mpx。逐台裁緊之後總共只有 2.19 Mpx。
//
// ⚠ 也不能改用 objectBoundingBox 省事：socket 的走線是完美垂直線（960,900→960,656），
//   bbox 寬 0 → 濾鏡塌成零尺寸，光暈整個消失而且不報錯。frameGlow 已經記過這個坑。
//
// 用未倒角的折點算 bbox 就夠 —— 圓角只會讓路徑往內縮，不會超出折線的外框。
function regionOf(node) {
  const { pts } = getRoute(node.id)
  const xs = [node.x - node.w / 2, node.x + node.w / 2, ...pts.map((p) => p.x)]
  const ys = [node.y - node.h / 2, node.y + node.h / 2, ...pts.map((p) => p.y)]
  const x = Math.min(...xs) - FX.pad
  const y = Math.min(...ys) - FX.pad
  return { x, y, w: Math.max(...xs) - x + FX.pad, h: Math.max(...ys) - y + FX.pad }
}

// 兩層「膨脹 → 模糊 → 衰減」，輸出【只有光暈、不含 SourceGraphic】。
// 亮芯由 ApplianceTrace / ApplianceBlock 提供，這裡不重畫；
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
          x: HUB.x - HUB.w / 2 - FX.pad,
          y: HUB.y - HUB.h / 2 - FX.pad,
          w: HUB.w + FX.pad * 2,
          h: HUB.h + FX.pad * 2,
        }}
      />

      {/* 彗星光點：用漸層而不是模糊濾鏡。漸層由 Chrome 直接光柵化並會抖動，
          天生沒有色帶，而且成本接近零 —— 一顆會動的元素若掛濾鏡，濾鏡就得跟著動。 */}
      {/* ⚠ 亮的部分要夠寬：拖尾是一串間距 4.2 單位的光點，若亮芯只有 2 單位寬，
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

// 能量光帶：一段亮帶沿整條線緩慢掃過（比彗星慢一半），做出能量湧過導線的感覺。
//
// dasharray = 「亮帶長, 其餘全部」→ 整條線上永遠只有一段亮帶；
// dashoffset 從 length 掃到 0 時，亮帶就從家電端往中樞端跑。
//
// ⚠ 不能塞進 .fx-glow 的濾鏡群組。濾鏡之所以便宜是因為內容完全靜態、結果被柵格化快取；
//   放一個每幀在動的東西進去，兩層高斯就變成每幀重跑。
//
// ⚠ 這是這一版唯一「每幀重繪路徑 bbox」的成本。掉幀先關 FX.beam.on。
function EnergyBeam({ d, length, index }) {
  const dur = length / FX.beam.speed
  // 短線（socket 只有 244）容不下 200 的長帶，整組【等比】縮 ——
  // 逐層各自 clamp 的話最寬的兩層會撞成一樣長，錐形就沒了。
  const scale = Math.min(1, (length * 0.55) / BEAM_LAYERS[0].band)
  const head = BEAM_LAYERS[0].band * scale
  return (
    <g className="fx-beam">
      {BEAM_LAYERS.map((L, i) => {
        const band = L.band * scale
        // 窄帶要落在寬帶正中，否則各層會對齊在前緣、看起來像一支箭頭而不是一團光
        const shift = (head - band) / 2
        return (
          <path
            key={i}
            d={d}
            fill="none"
            stroke={L.c}
            strokeWidth={L.w}
            strokeOpacity={L.o}
            strokeLinecap="round"
            style={{
              strokeDasharray: `${band.toFixed(2)} ${Math.max(1, length - band).toFixed(2)}`,
              animationDuration: `${dur.toFixed(3)}s`,
              animationDelay: `${(-phaseOf(index) * dur).toFixed(3)}s`,
              '--beam-from': (length - shift).toFixed(2),
              '--beam-to': (-shift).toFixed(2),
            }}
          />
        )
      })}
    </g>
  )
}

// 一台家電的感應特效。只在 active 時掛載（WallScene 用 AnimatePresence 包）。
//
// ⚠ 進退場的 opacity 一定要放在外層 motion.g，呼吸／閃爍放在內層的 g ——
//   CSS animation 的層級高於 inline style，掛同一個元素的話
//   framer-motion 的 exit={{opacity:0}} 會被動畫吃掉，退場完全看不見。
//   三層 opacity（進退場 × 閃爍 × 呼吸）相乘。
export function ApplianceFx({ node, index }) {
  const { d, length } = roundedRoute(node.id)
  // 彗星走的是【兩端都伸進黑塊裡】的完整軌跡，不是畫出來的那條 ——
  // 等待期要停在家電框心（黑塊底下＝隱形），抵達核心後也要繼續往裡面跑到拖尾被吃完，
  // 否則會在核心邊緣「啪」地重置。其餘三者（亮芯 / 光暈 / 光帶）一律吃 roundedRoute。
  const comet = cometRoute(node.id)

  // 等速：九條線速度一律 FX.speed，長線就飛久一點。
  // ⚠ 長度要用【倒角後】的，不是折線長度（每個 90° 角短約 0.43r）。
  // ⚠ 不要反過來用固定週期去縮放飛行時間 —— 走線長度差好幾倍，
  //   那樣短線會比長線快好幾倍。
  const travel = comet.length / FX.speed
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
      {/* ⚠ 九條的閃爍相位一定要錯開。九條線同時忽明忽暗會讀成投影機壞掉，不是能量感。 */}
      <g
        className="fx-flicker"
        style={{
          animationDuration: `${FX.flickerDur}s`,
          animationDelay: `${(-phaseOf(index) * FX.flickerDur).toFixed(3)}s`,
        }}
      >
        <g
          className="fx-glow"
          filter={`url(#fxGlow-${node.id})`}
          stroke={FX_BLUE}
          strokeWidth={LINE_W}
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
      </g>

      {FX.beam.on && <EnergyBeam d={d} length={length} index={index} />}

      <g className="fx-comet">
        {DOTS.map((dot, i) => (
          <circle key={i} cx="0" cy="0" r={dot.r} fill="url(#fxDot)" opacity={dot.o}>
            {/* 拖尾：每節用自己的 animateMotion 沿同一條路徑落後一點點。
                不用 rotate="auto" 的單一拖尾形狀 —— 走線是折線（轉角 90/90/45），
                rotate 在頂點會瞬間甩 90°，拖尾看得出彈一下。 */}
            <animateMotion
              path={comet.d}
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
// 幾何與 Hub.jsx 的黑塊一致（同一組 HUB.x/y/w/h + RADIUS.sm）。
// 不做「每顆彗星抵達就漣漪一次」—— 九台同時亮時那會變成雜訊。
// 中樞不掛閃爍：它是九條線的匯流點，跟著閃會讓整面牆一起抖。
export function HubGlow() {
  return (
    <rect
      className="fx-glow"
      x={HUB.x - HUB.w / 2}
      y={HUB.y - HUB.h / 2}
      width={HUB.w}
      height={HUB.h}
      rx={RADIUS.sm}
      fill="none"
      stroke={FX_BLUE}
      strokeWidth={LINE_W}
      filter="url(#fxGlow-hub)"
    />
  )
}
