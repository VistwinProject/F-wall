import { motion } from 'framer-motion'
import { APPLIANCES, VIEWBOX } from '../config/appliances.js'
import { COLORS, FONT, MOTION, RADIUS } from '../config/theme.js'
import { getRoute, linePath } from '../config/routing.js'

// ============================================================================
// 單一家電 = 一條走線 + 黑色挖空框 + active 時彈出的狀態面板。
// ============================================================================
// ----------------------------------------------------------------------------
// 刻意拆成三個「圖層」元件，讓 WallScene 分三批畫：先所有走線 → 所有黑塊 → 所有面板。
// 舊版是「一個家電畫完自己的走線+黑塊+面板」再換下一個，於是排在後面的家電，
// 走線會蓋在前面家電的面板文字上（例如浴室暖風機的線橫切過窗簾的面板）。
// 走線穿過面板是可以的，但要讀成「面板疊在線前面」，所以順序必須是全域分層。
// ----------------------------------------------------------------------------

// 走線：idle 極細灰線 → active 白高光。
// 幾何沿用 routing.js 的八方位佈線（含與黑塊的 CLEAR 淨空與避讓）。
export function ApplianceTrace({ node, active }) {
  const { pts } = getRoute(node.id)
  const t = `${MOTION.dur}s ${MOTION.easeCss}`
  return (
    <path
      d={linePath(pts)}
      fill="none"
      stroke={active ? COLORS.lineActive : COLORS.line}
      strokeWidth={active ? 1.5 : 1}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transition: `stroke ${t}, stroke-width ${t}` }}
    />
  )
}

// 黑色矩形 = 實體立方體模型的投影挖空區。
//
// ⚠ x/y/w/h 是「牆上實體展品的預留位」，不是版面裝飾：
//    rect 以 node.x/node.y 為【中心】，所以是 x - w/2, y - h/2。
//    改成左上角錨點而不轉換資料，每個框會位移半個自身尺寸，現場就對不上。
//    fill="#000" 同理 —— 投影機的黑 = 不出光，實體展品才不會被打亮。
//
// idle 用 lineStrong 而不是 line —— 這九個框是牆上實體展品的位置，
// attract 狀態（還沒有人刷卡）觀眾走近時就該看得到。投影機的黑會被環境光墊高，
// 0.10 那一階在現場幾乎看不見，所以框跟走線在這裡刻意分兩階。
export function ApplianceBlock({ node, active }) {
  const t = `${MOTION.dur}s ${MOTION.easeCss}`
  return (
    <rect
      x={node.x - node.w / 2}
      y={node.y - node.h / 2}
      width={node.w}
      height={node.h}
      rx={RADIUS.sm}
      fill="#000"
      stroke={active ? COLORS.lineActive : COLORS.lineStrong}
      strokeWidth={active ? 1.5 : 1}
      style={{ transition: `stroke ${t}, stroke-width ${t}` }}
    />
  )
}

// ============================================================================
// StatusPanel —— active 時在家電旁彈出的狀態面板。
//
// 版面邏輯（PW / PH / GAP / fitLabelSize / avoidX / panelDir 四向分支）整段沿用舊版：
// 面板永遠朝「外側」開，不跟往中樞的走線打架，且會自動水平避開鄰框。
// 換皮時如果動到 PW / PH，avoidX 的避讓結果會跟著變，要重跑 ?all 確認九個面板不重疊。
// ============================================================================
const PW = 220 // 面板寬
const PH = 116 // 面板高

// 標題字級自動縮放：家電名稱長度不一（「燈」1 字 ～「12合一感測器」7 字），
// 固定 25px 會超出面板寬。半形字（數字 / 英文）約佔全形的 0.55 寬。
function fitLabelSize(label, maxW, base = 25, letterSpacing = 2) {
  const units = [...label].reduce((n, ch) => n + (/[\x00-\x7F]/.test(ch) ? 0.55 : 1), 0)
  if (!units) return base
  const fit = (maxW - letterSpacing * label.length) / units
  return Math.min(base, Math.floor(fit * 10) / 10)
}
const GAP = 22 // 面板離家電框的間隙
// foreignObject 的外擴留白：外陰影 (0 10px 30px) 需要約 40 的空間，
// 不留的話陰影會被 foreignObject 的邊界裁掉。
const PAD = 40
const DODGE_MG = 8 // 避讓時與鄰框留的安全間距

// 面板往上／往下開時預設以家電框中心對齊，但可能壓到別人的框
// （例如下排的「燈」往上開會撞到中排的「除濕機」）。
// 這裡把面板水平推開最小的距離，讓它閃過所有相交的框，並保持在畫布內。
function avoidX(node, left, top, bottom) {
  const clash = APPLIANCES.filter((o) => {
    if (o.id === node.id) return false
    const ol = o.x - o.w / 2, or = o.x + o.w / 2
    const ot = o.y - o.h / 2, ob = o.y + o.h / 2
    if (ob <= top || ot >= bottom) return false          // 垂直不相交 → 無關
    return !(or <= left || ol >= left + PW)              // 水平相交才要避
  })
  if (!clash.length) return left

  // 候選：推到每個相交框的右側 / 左側，取「位移最小且不再相交」的一個
  const cands = [left]
  for (const o of clash) {
    cands.push(o.x + o.w / 2 + DODGE_MG)                 // 貼到該框右邊
    cands.push(o.x - o.w / 2 - DODGE_MG - PW)            // 貼到該框左邊
  }
  const ok = cands.filter((cx) => {
    if (cx < 0 || cx + PW > VIEWBOX.w) return false
    return !APPLIANCES.some((o) => {
      if (o.id === node.id) return false
      const ol = o.x - o.w / 2, or = o.x + o.w / 2
      const ot = o.y - o.h / 2, ob = o.y + o.h / 2
      if (ob <= top || ot >= bottom) return false
      return !(or <= cx || ol >= cx + PW)
    })
  })
  if (!ok.length) return left                            // 無解就維持原位
  return ok.sort((a, b) => Math.abs(a - left) - Math.abs(b - left))[0]
}

// active 時在家電旁彈出的狀態面板（第三層，畫在所有走線與黑塊之上）。
// ⚠ 不再自己判斷 active —— 掛載／卸載由 WallScene 的 AnimatePresence 決定，
//    退場動畫才跑得起來（元件自己 return null 會直接消失，沒有淡出）。
export function AppliancePanel({ node }) {
  return <StatusPanel node={node} />
}

function StatusPanel({ node }) {
  const { status, panelDir = 'B' } = node
  const bl = node.x - node.w / 2
  const br = node.x + node.w / 2
  const bt = node.y - node.h / 2
  const bb = node.y + node.h / 2

  // 面板左上角 (px,py) + 引線（從家電框邊到面板邊）+ 進場位移方向
  let px, py, from, to, fromOffset
  if (panelDir === 'L') {
    px = bl - GAP - PW
    py = node.y - PH / 2
    from = [bl, node.y]
    to = [px + PW, py + PH / 2]
    fromOffset = { x: 12, y: 0 }
  } else if (panelDir === 'R') {
    px = br + GAP
    py = node.y - PH / 2
    from = [br, node.y]
    to = [px, py + PH / 2]
    fromOffset = { x: -12, y: 0 }
  } else if (panelDir === 'T') {
    py = bt - GAP - PH
    px = avoidX(node, node.x - PW / 2, py, py + PH)
    from = [node.x, bt]
    to = [Math.max(px + 20, Math.min(node.x, px + PW - 20)), py + PH]
    fromOffset = { x: 0, y: 12 }
  } else {
    py = bb + GAP
    px = avoidX(node, node.x - PW / 2, py, py + PH)
    from = [node.x, bb]
    to = [Math.max(px + 20, Math.min(node.x, px + PW - 20)), py]
    fromOffset = { x: 0, y: -12 }
  }

  // 狀態圓點：ok = 實心、warn/err = 空心。語意靠形狀不靠顏色。
  const hollow = status.tone === 'warn' || status.tone === 'err'

  return (
    <motion.g
      initial={{ opacity: 0, x: fromOffset.x, y: fromOffset.y }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, x: fromOffset.x, y: fromOffset.y }}
      transition={{ duration: MOTION.dur, ease: MOTION.ease }}
    >
      {/* 引線：設備 → 面板。放在 motion.g 裡面才會跟著淡入淡出
          （舊版在外面，所以是瞬間出現／消失，跟面板不同步）。
          畫在玻璃之前 —— 重疊到面板的那一小段本來就該被玻璃蓋住並模糊掉。 */}
      <line x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} stroke={COLORS.line} strokeWidth="1" />
      {/* 毛玻璃底板。
          用 foreignObject 包一個 div 才拿得到 backdrop-filter —— 那是 CSS box 屬性，
          對 SVG 的 <rect> 完全無效（樣式見 styles.css 的 .panel-glass）。
          文字仍然是 SVG <text>，疊在玻璃上面，排版邏輯完全沒動。

          ⚠ foreignObject 會把內容裁切到自己的框，所以這裡刻意比面板大 PAD*2，
             內層再用 padding 推回去，外陰影才不會被切掉。
          ⚠ pointer-events: none —— 別讓這塊 HTML 蓋住底下的 SVG。 */}
      <foreignObject
        x={px - PAD}
        y={py - PAD}
        width={PW + PAD * 2}
        height={PH + PAD * 2}
        style={{ pointerEvents: 'none' }}
      >
        <div style={{ width: '100%', height: '100%', padding: PAD, boxSizing: 'border-box' }}>
          <div className="panel-glass" />
        </div>
      </foreignObject>

      {/* 標題：設備名（中文）獨占一行，用滿面板寬 */}
      <text
        x={px + 16}
        y={py + 31}
        fontSize={fitLabelSize(node.label, PW - 32)}
        fill={COLORS.text}
        style={{ fontFamily: FONT, letterSpacing: '1px' }}
      >
        {node.label}
      </text>

      {/* 設備代碼（左）+ 狀態點與狀態字（右）同一行 */}
      <text
        x={px + 16}
        y={py + 51}
        fontSize="12.5"
        fill={COLORS.textOnGlass}
        style={{ fontFamily: FONT, letterSpacing: '1.5px' }}
      >
        {status.code}
      </text>
      <circle
        cx={px + PW - 18}
        cy={py + 46.5}
        r="3.5"
        fill={hollow ? 'none' : COLORS.text}
        stroke={COLORS.text}
        strokeWidth="1"
      />
      <text
        x={px + PW - 30}
        y={py + 51}
        textAnchor="end"
        fontSize="13"
        fill={COLORS.text2}
        style={{ fontFamily: FONT, letterSpacing: '0.5px' }}
      >
        {status.state}
      </text>

      {/* 分隔線 */}
      <line x1={px + 16} y1={py + 61} x2={px + PW - 16} y2={py + 61} stroke={COLORS.line} strokeWidth="1" />

      {/* 資料列：左標籤 右數值。
          垂直節奏刻意讓最後一列的底緣離板底約 12px，跟左右內距 16px 讀起來平衡；
          數字用 tabular-nums 對齊，換值時不會左右跳。 */}
      {status.rows.map(([k, v], i) => {
        const ry = py + 79 + i * 22
        return (
          <g key={i}>
            <text x={px + 16} y={ry} fontSize="15" fill={COLORS.textOnGlass} style={{ fontFamily: FONT }}>
              {k}
            </text>
            <text
              x={px + PW - 16}
              y={ry}
              textAnchor="end"
              fontSize="16"
              fill={COLORS.text}
              style={{ fontFamily: FONT, fontVariantNumeric: 'tabular-nums' }}
            >
              {v}
            </text>
          </g>
        )
      })}
    </motion.g>
  )
}
