import { APPLIANCES, VIEWBOX, RESERVED_SCREEN } from '../config/appliances.js'
import { FRAME, VLINES, HLINES, LINE_W } from '../config/frame.js'
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
  return (
    <svg
      viewBox={`0 0 ${VIEWBOX.w} ${VIEWBOX.h}`}
      preserveAspectRatio="xMidYMid meet"
      width="100%"
      height="100%"
    >
      {/* 線條框架：最底層。家電黑塊與資訊面板都疊在它前面。 */}
      <LineFrame />

      <ReservedScreen />

      {/* 分三層畫，不是「一個家電畫完換下一個」：
          走線 → 黑塊 → 狀態面板。走線可以穿過面板，但要讀成面板疊在線前面；
          若照家電逐一畫，排在後面的家電的線會蓋到前面家電的面板文字上。 */}
      {APPLIANCES.map((node) => (
        <ApplianceTrace key={`t-${node.id}`} node={node} active={showAll || activeIds.has(node.id)} />
      ))}
      {APPLIANCES.map((node) => (
        <ApplianceBlock key={`b-${node.id}`} node={node} active={showAll || activeIds.has(node.id)} />
      ))}

      <Hub activeCount={activeIds.size} />

      {APPLIANCES.map((node) => (
        <AppliancePanel key={`p-${node.id}`} node={node} active={showAll || activeIds.has(node.id)} />
      ))}
    </svg>
  )
}

// 大框 + 正交格線。數值全部來自 config/frame.js（業主指定），這裡只負責畫。
// 格線整條拉到大框兩端 —— 畫面上的斷點是前面的黑塊／面板遮出來的，不在這裡算。
function LineFrame() {
  const { x, y, w, h, r } = FRAME
  return (
    <g stroke={COLORS.frameLine} strokeWidth={LINE_W} fill="none">
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
}

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
