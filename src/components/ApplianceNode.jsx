import { motion } from 'framer-motion'
import { APPLIANCES, VIEWBOX } from '../config/appliances.js'
import { COLORS, FONT, MOTION, PANEL_TEXT, RADIUS, TITLE_ASCENT } from '../config/theme.js'
import { panelBoxOf, panelPad, panelText } from '../config/wallTuning.js'
import { FX, LINE_W, LINE_W_IDLE } from '../config/fx.js'
import GlassPlate, { estWidth } from './GlassPlate.jsx'

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
// 框內的家電照片（public/appliances/<id>.png，去背 PNG）。
//
// ⚠ 這九張是【投影出來的光】，不是貼圖裝飾。黑塊原本的用途是「不出光，
//    讓牆上的實體展品不被打亮」；放了照片之後那一格就會亮起來。
//    展場如果實體展品還在原位，這裡要調暗甚至關掉 —— 見下面的 BLOCK_IMG。
// ⚠ 照片只佔框的 IMG_FIT，不貼齊邊緣：框是實體展品的預留位，照片貼齊邊會
//    讓框線與照片黏在一起，看不出「框」。
const IMG_FIT = 0.88
// 沒感應時暗、有感應時亮 —— 待機時整面牆的出光量才不會被九張白色照片拉高。
const BLOCK_IMG = { idle: 0.5, on: 0.95 }

export function ApplianceBlock({ node, active }) {
  const t = `${MOTION.dur}s ${MOTION.easeCss}`
  const x = node.x - node.w / 2
  const y = node.y - node.h / 2
  const iw = node.w * IMG_FIT
  const ih = node.h * IMG_FIT
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={node.w}
        height={node.h}
        rx={RADIUS.sm}
        fill="#000"
        // FX.svgBlockStroke = false 時只剩黑底，框完全交給 canvas 上的發光外圈。
        // ⚠ 黑底本身不能拿掉：投影機的黑 = 不出光，它負責蓋住往框內溢的 bloom。
        stroke={FX.svgBlockStroke ? (active ? COLORS.lineActive : COLORS.lineStrong) : 'none'}
        strokeWidth={active ? LINE_W : LINE_W_IDLE}
        // active 時跟著 WebGL 那層同一個呼吸值（GlowCanvas 每幀寫進 --fx-breathe）。
        // 沒有 canvas（?nofx）時變數不存在，退回 1 = 恆亮。
        strokeOpacity={active ? 'var(--fx-breathe, 1)' : 1}
        style={{ transition: `stroke ${t}, stroke-width ${t}` }}
      />
      <image
        // ⚠ 路徑一定要串 BASE_URL：GitHub Pages 的專案站掛在 /F-wall/ 底下，
        //    寫死 "/appliances/x.png" 會 404（iPad 的 TOP.png 踩過同一個坑）。
        href={`${import.meta.env.BASE_URL}appliances/${node.id}.png`}
        x={node.x - iw / 2}
        y={node.y - ih / 2}
        width={iw}
        height={ih}
        // meet = 完整放進框內、不裁切。框的比例是照實體展品給的，
        // 與去背後的照片比例接近，留白很小。
        preserveAspectRatio="xMidYMid meet"
        opacity={active ? BLOCK_IMG.on : BLOCK_IMG.idle}
        style={{ transition: `opacity ${t}` }}
        pointerEvents="none"
      />
    </g>
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
  // 編輯器調出來的絕對座標優先（config/panels.js，可被編輯模式覆寫）。
  // 沒有登記的才回退到下面「依 panelDir 開在家電旁 + avoidX」的自動算法。
  const fixed = panelBoxOf(node.id)
  if (fixed) return { ...fixed }
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
  // 標題字級、資料列行距、四邊內距都是編輯模式（鍵盤 e）可調的，其餘字級固定。
  const TXT = panelText()
  const P = panelPad()
  const S = { title: TXT.title, code: 6.25, state: 6.5, key: 7.5, val: 8 }
  const innerW = PW - P.l - P.r
  // ⚠ 標題基線從【上內距 + 字級】推出來，不是寫死的 py + 17。
  //   寫死的話字級一調大，字就往上頂出面板上緣（實際踩過）。
  // ⚠ 用 S.title（上限）而不是 fitLabelSize 的結果：名字長的面板字會縮小，
  //   但九塊面板的標題基線要對齊在同一條線上，整面牆才不會參差。
  // 下面三個間距（12 / 6 / 11）維持原本的節奏，只是改成相對於標題基線。
  const yTitle = py + P.t + S.title * TITLE_ASCENT
  const yMeta = yTitle + 12
  const yRule = yMeta + 6
  const rowTop = yRule + 11

  // 資料列並排放不下就改成上下兩行（左標籤在上、數值在下）。
  // 只要有一列放不下就整個面板都換行，避免同一塊面板混兩種排法。
  const stacked = status.rows.some(
    ([k, v]) => estWidth(k, S.key) + estWidth(v, S.val) + 10 > innerW
  )
  const lineH = stacked ? 9 : 0

  // 行距是【固定值】，不依高度平均分佈 —— 平均分佈會讓每塊面板行距都不一樣
  // （實測 sensor 12、bathfan 13、其他 27~28），整面牆看起來就不齊。
  // 上下兩行排法的行距跟著等比例放大，編輯器才只需要一支滑桿。
  const ROW_GAP = stacked ? TXT.rowGap * PANEL_TEXT.stackedRatio : TXT.rowGap
  const avail = py + PH - P.b - rowTop

  // 塞得下幾列就顯示幾列，最多 5 列；矮面板自然收到 2~3 列。
  const maxRows = Math.max(1, Math.min(5, Math.floor(avail / ROW_GAP)))
  const rows = status.rows.slice(0, maxRows)

  // ⚠ 舊版在這裡算「資料列排完還剩多少高度」，剩得夠多就補一張近七日趨勢小圖，
  //   不要空一大片。那一段【刻意移除】—— 面板本身的資訊量已經夠，不需要再用
  //   圖表填空間（status.trend 的資料先留著沒刪，之後想加回來還在）。
  //   要獨立的圖表面板請用 config/panels.js 的 CUSTOM_PANELS，那是另一回事。

  // ── 進出場 ────────────────────────────────────────────────────────────────
  // ⚠ 只做不透明度，不做位移。會動的 backdrop-filter 元素是最貴的情況 ——
  //   元素每移動一格，合成器就得把底下那塊背景重讀一次再模糊一次。
  //
  // ⚠⚠ 玻璃底板【不能】放在會動 opacity 的群組裡面。
  //   規格上 opacity < 1 的祖先會建立一個新的 backdrop root，backdrop-filter
  //   於是取樣不到任何背景 —— 玻璃在整段動畫期間等於沒有模糊也沒有壓暗，背後的
  //   框架格線就一條一條銳利地穿透過來，動畫結束那一幀才「啪」地變成玻璃。
  //   實測 opacity 只要從 1 掉到 0.99 就足以觸發，不是掉幀也不是快取沒暖。
  //
  //   所以拆成兩層：玻璃在外層（永遠 opacity 1，出現即最終樣貌），引線與文字在
  //   內層淡入淡出。代價是底板本身「啪」一下出現 —— 那正是要的：面板一出現就
  //   已經是最上層的視覺狀態。
  return (
    <motion.g>
      <GlassPlate x={px} y={py} w={PW} h={PH} />

      <motion.g
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: MOTION.dur, ease: MOTION.ease }}
      >
      {from && (
        <line x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} stroke={COLORS.line} strokeWidth="1" />
      )}

      {/* 標題：設備名，字級自動縮到塞得下面板寬 */}
      <text
        x={px + P.l}
        y={yTitle}
        fontSize={fitLabelSize(node.label, innerW, S.title, 0.5)}
        fill={COLORS.text}
        style={{ fontFamily: FONT, letterSpacing: '0.5px' }}
      >
        {node.label}
      </text>

      {/* 設備代碼（左）+ 狀態點與狀態字（右） */}
      <text x={px + P.l} y={yMeta} fontSize={S.code} fill={COLORS.textOnGlass}
        style={{ fontFamily: FONT, letterSpacing: '0.8px' }}>
        {status.code}
      </text>
      <circle cx={px + PW - P.r - 2} cy={yMeta - 2.2} r="2" fill={hollow ? 'none' : COLORS.text}
        stroke={COLORS.text} strokeWidth="0.7" />
      <text x={px + PW - P.r - 8} y={yMeta} textAnchor="end" fontSize={S.state} fill={COLORS.text2}
        style={{ fontFamily: FONT }}>
        {status.state}
      </text>

      <line x1={px + P.l} y1={yRule} x2={px + PW - P.r} y2={yRule} stroke={COLORS.line} strokeWidth="0.8" />

      {/* 資料列。stacked = 面板太窄，標籤與數值改上下排。 */}
      {rows.map(([k, v], i) => {
        const ry = rowTop + i * ROW_GAP + (stacked ? 6 : 8)
        return (
          <g key={i}>
            <text x={px + P.l} y={ry} fontSize={S.key} fill={COLORS.textOnGlass} style={{ fontFamily: FONT }}>
              {k}
            </text>
            <text
              x={stacked ? px + P.l : px + PW - P.r}
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
      </motion.g>
    </motion.g>
  )

}
