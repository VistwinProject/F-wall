import { motion } from 'framer-motion'
import { APPLIANCES, VIEWBOX } from '../config/appliances.js'
import { COLORS, FONT, MOTION, RADIUS } from '../config/theme.js'
import { PANEL_LAYOUT } from '../config/panels.js'
import { LINE_W, LINE_W_IDLE } from '../config/fx.js'
import GlassPlate, { estWidth } from './GlassPlate.jsx'
import MiniBars from './MiniBars.jsx'

// ============================================================================
// 單一家電 = 黑色挖空框 + active 時彈出的狀態面板。
// ============================================================================
// ----------------------------------------------------------------------------
// 走線已經不在這裡了 —— 光的部分（走線、光束、彗星、框外圈）全部由底下那張
// WebGL canvas 畫（見 components/GlowCanvas.jsx）。這個檔案只剩「擋光的黑塊」
// 與「要銳利的狀態面板」。
// ----------------------------------------------------------------------------

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
      strokeWidth={active ? LINE_W : LINE_W_IDLE}
      // active 時跟著 WebGL 那層同一個呼吸值（GlowCanvas 每幀寫進 --fx-breathe）。
      // 沒有 canvas（?nofx）時變數不存在，退回 1 = 恆亮。
      strokeOpacity={active ? 'var(--fx-breathe, 1)' : 1}
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
export function AppliancePanel({ node, box }) {
  return <StatusPanel node={node} box={box ?? panelBox(node)} />
}

// 從 rect 中心朝 (tx,ty) 射出，回傳與 rect 邊界的交點。
// 引線兩端都用它算 —— 面板被拖到任意位置時，引線仍然會接在兩個框最靠近的邊上。
function edgePoint(rect, tx, ty) {
  const cx = rect.x + rect.w / 2
  const cy = rect.y + rect.h / 2
  const dx = tx - cx
  const dy = ty - cy
  if (!dx && !dy) return { x: cx, y: cy }
  const sx = dx ? rect.w / 2 / Math.abs(dx) : Infinity
  const sy = dy ? rect.h / 2 / Math.abs(dy) : Infinity
  const s = Math.min(sx, sy)
  return { x: cx + dx * s, y: cy + dy * s }
}

// 面板的預設位置：依 panelDir 開在家電框外側，並用 avoidX 水平避開鄰框。
// ⚠ 這是「自動版面」的唯一來源。編輯器(?edit)會用自己存的 box 覆蓋它，
//    但正式投影一律走這裡算出來的值。
export function panelBox(node) {
  // 編輯器調出來的絕對座標優先（config/panels.js）。
  // 沒有登記的才回退到下面「依 panelDir 開在家電旁 + avoidX」的自動算法。
  if (PANEL_LAYOUT[node.id]) return { ...PANEL_LAYOUT[node.id] }
  const { panelDir = 'B' } = node
  const bl = node.x - node.w / 2
  const br = node.x + node.w / 2
  const bt = node.y - node.h / 2
  const bb = node.y + node.h / 2
  let px, py
  if (panelDir === 'L') {
    px = bl - GAP - PW
    py = node.y - PH / 2
  } else if (panelDir === 'R') {
    px = br + GAP
    py = node.y - PH / 2
  } else if (panelDir === 'T') {
    py = bt - GAP - PH
    px = avoidX(node, node.x - PW / 2, py, py + PH)
  } else {
    py = bb + GAP
    px = avoidX(node, node.x - PW / 2, py, py + PH)
  }
  return { x: px, y: py, w: PW, h: PH }
}

function StatusPanel({ node, box }) {
  const { status } = node
  // 用 box 的尺寸遮蔽模組常數 —— 底下整段排版程式碼因此完全不用改，
  // 面板被編輯器改大改小時文字也會跟著對齊。
  const { x: px, y: py, w: PW, h: PH } = box

  // 引線：家電框邊 → 面板邊。node 為 null 時（編輯器新增的自訂面板）不畫。
  let from = null
  let to = null
  if (node.w && node.h) {
    const blockRect = { x: node.x - node.w / 2, y: node.y - node.h / 2, w: node.w, h: node.h }
    const cx = px + PW / 2
    const cy = py + PH / 2
    const a = edgePoint(blockRect, cx, cy)
    const b = edgePoint({ x: px, y: py, w: PW, h: PH }, node.x, node.y)
    from = [a.x, a.y]
    to = [b.x, b.y]
  }

  // 狀態圓點：ok = 實心、warn/err = 空心。語意靠形狀不靠顏色。
  const hollow = status.tone === 'warn' || status.tone === 'err'

  // ⚠ 進出場只做不透明度，不做位移。
  // 會動的 backdrop-filter 元素是最貴的情況 —— 元素每移動一格，合成器就得把底下
  // 那塊背景重讀一次再模糊一次。九個面板同時進場（全部刷卡的那一刻，也就是這個
  // 互動的高潮）正好是最壞情境。位置固定、只變 alpha 的話背景取樣可以重用。
  // 視覺上玻璃「就地浮現」也比滑進來更像玻璃。
  // ── 版面尺度（字級一律是原本的一半）────────────────────────────────────────
  // 面板從固定 220x116 變成各種尺寸後，這些值都改成從 box 推算，不再寫死。
  const PADX = 10
  const S = { title: 12.5, code: 6.25, state: 6.5, key: 7.5, val: 8 }
  const innerW = PW - PADX * 2
  const yTitle = py + 17
  const yMeta = py + 29
  const yRule = py + 35
  const rowTop = py + 46
  const bottomPad = 9

  // 資料列並排放不下就改成上下兩行（左標籤在上、數值在下）。
  // 只要有一列放不下就整個面板都換行，避免同一塊面板混兩種排法。
  const stacked = status.rows.some(
    ([k, v]) => estWidth(k, S.key) + estWidth(v, S.val) + 10 > innerW
  )
  const lineH = stacked ? 9 : 0

  // 行距固定 25（對齊窗簾面板），不再依高度平均分佈 ——
  // 平均分佈會讓每塊面板行距都不一樣（實測 sensor 12、bathfan 13、其他 27~28），
  // 整面牆看起來就不齊。
  const ROW_GAP = stacked ? 34 : 25
  const avail = py + PH - bottomPad - rowTop

  // 塞得下幾列就顯示幾列，最多 5 列；矮面板自然收到 2~3 列。
  const maxRows = Math.max(1, Math.min(5, Math.floor(avail / ROW_GAP)))
  const rows = status.rows.slice(0, maxRows)

  // 列排完之後真正剩下的高度。
  // ⚠ 不能用 rows.length * ROW_GAP —— 最後一列之後沒有行距，那樣會多算一整格，
  //    害本來塞得下小圖的面板（例如冷氣還有 40+）被判定成沒空間。
  //    最後一列的基線在 rowTop + (n-1)*ROW_GAP + 8，再加約 4 的下伸部。
  const lastRowBottom = rowTop + (rows.length - 1) * ROW_GAP + 12
  const restY = lastRowBottom + 4
  const restH = py + PH - bottomPad - restY

  // 兩段式：空間夠就「標題 + 長條圖」，只有一點就畫沒有標題的精簡版。
  const trendMode = !status.trend ? null : restH >= 36 ? 'full' : restH >= 18 ? 'compact' : null

  // ⚠ 進出場只做不透明度，不做位移。
  // 會動的 backdrop-filter 元素是最貴的情況 —— 元素每移動一格，合成器就得把底下
  // 那塊背景重讀一次再模糊一次。九個面板同時進場正好是最壞情境。
  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: MOTION.dur, ease: MOTION.ease }}
    >
      {from && (
        <line x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} stroke={COLORS.line} strokeWidth="1" />
      )}

      <GlassPlate x={px} y={py} w={PW} h={PH} />

      {/* 標題：設備名，字級自動縮到塞得下面板寬 */}
      <text
        x={px + PADX}
        y={yTitle}
        fontSize={fitLabelSize(node.label, innerW, S.title, 0.5)}
        fill={COLORS.text}
        style={{ fontFamily: FONT, letterSpacing: '0.5px' }}
      >
        {node.label}
      </text>

      {/* 設備代碼（左）+ 狀態點與狀態字（右） */}
      <text x={px + PADX} y={yMeta} fontSize={S.code} fill={COLORS.textOnGlass}
        style={{ fontFamily: FONT, letterSpacing: '0.8px' }}>
        {status.code}
      </text>
      <circle cx={px + PW - PADX - 2} cy={yMeta - 2.2} r="2" fill={hollow ? 'none' : COLORS.text}
        stroke={COLORS.text} strokeWidth="0.7" />
      <text x={px + PW - PADX - 8} y={yMeta} textAnchor="end" fontSize={S.state} fill={COLORS.text2}
        style={{ fontFamily: FONT }}>
        {status.state}
      </text>

      <line x1={px + PADX} y1={yRule} x2={px + PW - PADX} y2={yRule} stroke={COLORS.line} strokeWidth="0.8" />

      {/* 資料列。stacked = 面板太窄，標籤與數值改上下排。 */}
      {rows.map(([k, v], i) => {
        const ry = rowTop + i * ROW_GAP + (stacked ? 6 : 8)
        return (
          <g key={i}>
            <text x={px + PADX} y={ry} fontSize={S.key} fill={COLORS.textOnGlass} style={{ fontFamily: FONT }}>
              {k}
            </text>
            <text
              x={stacked ? px + PADX : px + PW - PADX}
              y={ry + lineH}
              textAnchor={stacked ? 'start' : 'end'}
              fontSize={S.val}
              fill={COLORS.text}
              style={{ fontFamily: FONT, fontVariantNumeric: 'tabular-nums' }}
            >
              {v}
            </text>
          </g>
        )
      })}

      {/* 資料列排完還有空間 → 補一張近七日趨勢小圖，不要空一大片。
          full = 分隔線 + 標題 + 長條；compact = 只有長條（空間不夠放標題）。 */}
      {trendMode && (
        <>
          <line x1={px + PADX} y1={restY} x2={px + PW - PADX} y2={restY}
            stroke={COLORS.line} strokeWidth="0.8" />
          {trendMode === 'full' && (
            <text x={px + PADX} y={restY + 12} fontSize={S.code} fill={COLORS.textOnGlass}
              style={{ fontFamily: FONT }}>
              {status.trend.label}
            </text>
          )}
          <MiniBars
            x={px + PADX}
            y={restY + (trendMode === 'full' ? 17 : 6)}
            w={innerW}
            h={Math.max(10, Math.min(32, restH - (trendMode === 'full' ? 20 : 9)))}
            data={status.trend.data}
          />
        </>
      )}
    </motion.g>
  )

}
