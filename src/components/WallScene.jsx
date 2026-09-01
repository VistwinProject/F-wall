import { memo } from 'react'
import { AnimatePresence } from 'framer-motion'
import { APPLIANCES, VIEWBOX, RESERVED_SCREEN } from '../config/appliances.js'
import { FRAME, VLINES, HLINES, LINE_W, GLOW } from '../config/frame.js'
import { COLORS } from '../config/theme.js'
import { ApplianceTrace, ApplianceBlock, AppliancePanel } from './ApplianceNode.jsx'
import Hub from './Hub.jsx'

// ============================================================================
// 牆面場景根節點。
//
// ⚠ 這裡有三個「不是樣式、是物理」的東西，改了牆上的實體展品就對不上位置：
//   1. viewBox 0 0 1920 1080 —— 座標系本身。
//   2. preserveAspectRatio="xMidYMid meet" + width/height 100% —— 換成 slice
//      或加上任何 padding / header，九個黑框會整體位移。
//   3. 黑框與電視預留區的 fill="#000" —— 投影機的黑 = 不出光，實體展品才不會被打亮。
//      這不是配色選擇，不要因為「純黑太重」而改成深灰。
// ============================================================================
export default function WallScene({ activeIds }) {
  // ?all 除錯用：強制所有家電 active（驗證面板/連線排版不打架），正式不會帶這參數。
  // portable/測試-全部亮.bat 靠這個參數，不要拿掉。
  const showAll =
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('all')
  const isActive = (id) => showAll || activeIds.has(id)
  return (
    <svg
      viewBox={`0 0 ${VIEWBOX.w} ${VIEWBOX.h}`}
      preserveAspectRatio="xMidYMid meet"
      width="100%"
      height="100%"
    >
      <defs>
        {/* 霓虹光暈：三層「膨脹 → 模糊 → 衰減」，最後把未模糊的原圖蓋回最上面
            讓亮芯保持銳利。參數在 config/frame.js 的 GLOW。

            ⚠ 每層都先 feMorphology dilate 再模糊，然後用 feComponentTransfer「衰減」。
              直覺上會想「模糊細線再放大」，但 SVG 濾鏡中間緩衝是 8-bit，放大不會
              產生新的階 —— 一條 1.5 寬的線用 σ=22 模糊後峰值只剩 7/255 階，×3.2 之後
              仍然只有 8 個值攤在 38px 半徑上，每階約 4.8px 的平台，肉眼就是一圈圈色塊。
              先膨脹到 15.5 寬再模糊，峰值有 85 階，再衰減到同樣亮度 → 色帶降到約 1.7px。
              要更亮請調 slope，不要回頭去放大。

            ⚠ filterUnits 必須是 userSpaceOnUse。SVG 預設的 objectBoundingBox 對
              「完美水平／垂直的 <line>」會塌成零寬高 → 光暈整個消失且不報錯。
              12 條格線全是軸對齊直線，必中。（F-table 的 beam-bloom 已踩過）

            ⚠ color-interpolation-filters="sRGB"：預設 linearRGB 會讓光暈中段偏亮偏濁。 */}
        <filter
          id="frameGlow"
          filterUnits="userSpaceOnUse"
          x="0"
          y="0"
          width={VIEWBOX.w}
          height={VIEWBOX.h}
          colorInterpolationFilters="sRGB"
        >
          <feMorphology in="SourceGraphic" operator="dilate" radius={GLOW.halo.dilate} result="fat3" />
          <feGaussianBlur in="fat3" stdDeviation={GLOW.halo.sd} result="b3" />
          <feComponentTransfer in="b3" result="halo">
            <feFuncA type="linear" slope={GLOW.halo.slope} />
          </feComponentTransfer>

          <feMorphology in="SourceGraphic" operator="dilate" radius={GLOW.mid.dilate} result="fat2" />
          <feGaussianBlur in="fat2" stdDeviation={GLOW.mid.sd} result="b2" />
          <feComponentTransfer in="b2" result="mid">
            <feFuncA type="linear" slope={GLOW.mid.slope} />
          </feComponentTransfer>

          <feMorphology in="SourceGraphic" operator="dilate" radius={GLOW.near.dilate} result="fat1" />
          <feGaussianBlur in="fat1" stdDeviation={GLOW.near.sd} result="b1" />
          <feComponentTransfer in="b1" result="near">
            <feFuncA type="linear" slope={GLOW.near.slope} />
          </feComponentTransfer>

          <feMerge>
            <feMergeNode in="halo" />
            <feMergeNode in="mid" />
            <feMergeNode in="near" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* 線條框架：最底層。家電黑塊與資訊面板都疊在它前面。 */}
      <LineFrame />

      <ReservedScreen />

      {/* 分三層畫，不是「一個家電畫完換下一個」：
          走線 → 黑塊 → 狀態面板。走線可以穿過面板，但要讀成面板疊在線前面；
          若照家電逐一畫，排在後面的家電的線會蓋到前面家電的面板文字上。 */}
      {APPLIANCES.map((node) => (
        <ApplianceTrace key={`t-${node.id}`} node={node} active={isActive(node.id)} />
      ))}
      {APPLIANCES.map((node) => (
        <ApplianceBlock key={`b-${node.id}`} node={node} active={isActive(node.id)} />
      ))}

      <Hub activeCount={activeIds.size} />

      {/* 面板層。用 AnimatePresence 掛載／卸載，拿走卡片時才有淡出 ——
          舊版是元件自己 return null，會瞬間消失。 */}
      <AnimatePresence>
        {APPLIANCES.filter((node) => isActive(node.id) && node.status).map((node) => (
          <AppliancePanel key={`p-${node.id}`} node={node} />
        ))}
      </AnimatePresence>
    </svg>
  )
}

// 大框 + 正交格線。數值全部來自 config/frame.js（業主指定），這裡只負責畫。
// 格線整條拉到大框兩端 —— 畫面上的斷點是前面的黑塊／面板遮出來的，不在這裡算。
// 完全靜態（不吃任何 prop、不隨 activeIds 變化），所以瀏覽器會把濾鏡結果柵格化後快取，
// 三層高斯只付一次、不是每幀。memo 只是讓 activeIds 變動時不做無謂的 reconcile。
const LineFrame = memo(function LineFrame() {
  const { x, y, w, h, r } = FRAME
  return (
    <g filter="url(#frameGlow)" stroke={COLORS.frameLine} strokeWidth={LINE_W} fill="none">
      {VLINES.map((vx) => (
        <line key={`v-${vx}`} x1={vx} y1={y} x2={vx} y2={y + h} />
      ))}
      {HLINES.map((hy) => (
        <line key={`h-${hy}`} x1={x} y1={hy} x2={x + w} y2={hy} />
      ))}
      {/* 大框畫在格線之後，四邊與倒角才會是完整連續的一圈 */}
      <rect x={x} y={y} width={w} height={h} rx={r} />
    </g>
  )
})

// 實體電視預留位：純黑矩形挖空（之後實機螢幕就裝在這），一條細線點出邊界。
// 與家電框同一階(lineStrong)，因為它也是實體展品的預留位。
function ReservedScreen() {
  const { x, y, w, h } = RESERVED_SCREEN
  return (
    <rect
      x={x - w / 2}
      y={y - h / 2}
      width={w}
      height={h}
      fill="#000"
      stroke={COLORS.lineStrong}
      strokeWidth="1"
    />
  )
}
