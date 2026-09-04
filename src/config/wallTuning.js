// ============================================================================
// 牆面版面覆寫 —— 只給編輯模式（鍵盤 e）用的暫時性資料層
// ----------------------------------------------------------------------------
// 這裡是整面牆「幾何」的單一讀取點。所有畫東西的地方（SVG 的黑塊、WebGL 的框架
// 與外圈、走線 routing、資訊面板）都改成從這裡拿值，而不是直接 import 那三個
// config —— 因為編輯模式要能【即時】改這些數字，而 routing.js 的路徑是模組載入
// 時就算好的，直接 import 的話黑塊搬走了、走線還留在原地。
//
// 沒有覆寫時這裡回傳的就是三個 config 的原值，畫面與改之前【逐字相同】。
//
// ⚠ localStorage 只是調整過程的暫存，不是設定檔。調完按「匯出」，把內容貼回：
//     黑塊 / 電視 / 核心 → config/appliances.js
//     大框 / 格線 / 圓角 → config/frame.js
//     資訊面板 / 圖表面板 → config/panels.js
//     框線粗細           → config/fx.js（⚠ 三端共用，見匯出文字裡的提醒）
// ⚠ 有覆寫時畫面右上角會一直顯示「已套用編輯值」—— 展場誤觸不會無聲無息地留著。
// ============================================================================
import { APPLIANCES, HUB, RESERVED_SCREEN } from './appliances.js'
import { FRAME, VLINES, HLINES } from './frame.js'
import { FX } from './fx.js'
import { PANEL_LAYOUT, CUSTOM_PANELS } from './panels.js'
import { PANEL_PAD, PANEL_TEXT } from './theme.js'

const KEY = 'f-wall-tuning'

// 十一個黑塊的 id：九台家電用自己的 id，另外兩塊固定叫 hub / screen。
// ⚠ 這兩個名字同時是匯出時對應到 appliances.js 哪個常數的依據，不要改。
export const HUB_ID = 'hub'
export const SCREEN_ID = 'screen'

// 自訂面板（不對應任何家電）的 id 前綴
export const CUSTOM_PREFIX = 'custom-'
export const isCustom = (id) => id.startsWith(CUSTOM_PREFIX)
// 附屬圖表面板在 tuning 裡的 id 前綴（對應 panels.js 的 CUSTOM_PANELS）
export const CHART_PREFIX = 'chart:'
export const isChart = (id) => id.startsWith(CHART_PREFIX)

/** 從程式碼讀出一份完整的可編輯狀態 —— 「重設」就是回到這裡。 */
export function codeTuning() {
  const blocks = {}
  for (const a of APPLIANCES) blocks[a.id] = { x: a.x, y: a.y, w: a.w, h: a.h, label: a.label }
  blocks[HUB_ID] = { x: HUB.x, y: HUB.y, w: HUB.w, h: HUB.h, label: 'AI 核心' }
  blocks[SCREEN_ID] = {
    x: RESERVED_SCREEN.x, y: RESERVED_SCREEN.y,
    w: RESERVED_SCREEN.w, h: RESERVED_SCREEN.h, label: '電視預留區',
  }

  const panels = {}
  for (const a of APPLIANCES) {
    const b = PANEL_LAYOUT[a.id]
    // PANEL_LAYOUT 目前九台都有登記；萬一少了誰，給一個看得見的預設框而不是崩掉。
    panels[a.id] = b ? { ...b } : { x: a.x - 110, y: a.y + a.h / 2 + 22, w: 220, h: 116 }
  }
  for (const c of CUSTOM_PANELS) {
    panels[CHART_PREFIX + c.id] = { x: c.x, y: c.y, w: c.w, h: c.h }
  }

  return {
    blocks,
    frame: { x: FRAME.x, y: FRAME.y, w: FRAME.w, h: FRAME.h, r: FRAME.r },
    vlines: [...VLINES],
    hlines: [...HLINES],
    lineWidth: FX.frame.width,
    panels,
    panelText: { title: PANEL_TEXT.title, rowGap: PANEL_TEXT.rowGap },
    panelPad: { ...PANEL_PAD },
  }
}

// ── 狀態 ────────────────────────────────────────────────────────────────────
// ⚠ 模組層的可變狀態，不是 React state。非 React 的消費者（routing.js、
//   webgl/FrameLines.js）也要讀得到，而且要讀到「現在這一刻」的值。
//   React 那邊靠 App 的 state 觸發重繪，重繪時讀到的就是這裡最新的值。
function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const saved = JSON.parse(raw)
    const base = codeTuning()
    // 淺層合併：舊版存檔缺欄位時用程式碼的值補上，不要整包丟掉使用者的調整。
    return {
      blocks: { ...base.blocks, ...(saved.blocks || {}) },
      frame: { ...base.frame, ...(saved.frame || {}) },
      vlines: Array.isArray(saved.vlines) ? saved.vlines : base.vlines,
      hlines: Array.isArray(saved.hlines) ? saved.hlines : base.hlines,
      lineWidth: typeof saved.lineWidth === 'number' ? saved.lineWidth : base.lineWidth,
      panels: { ...base.panels, ...(saved.panels || {}) },
      panelText: { ...base.panelText, ...(saved.panelText || {}) },
      panelPad: { ...base.panelPad, ...(saved.panelPad || {}) },
    }
  } catch {
    return null
  }
}

let TUNING = load() || codeTuning()
let STORED = !!localStorage.getItem?.(KEY)

const listeners = new Set()
/** 非 React 的消費者用（GlowCanvas 要在幾何變動時重建 WebGL 幾何）。 */
export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export const getTuning = () => TUNING

export function setTuning(next) {
  TUNING = typeof next === 'function' ? next(TUNING) : next
  try {
    localStorage.setItem(KEY, JSON.stringify(TUNING))
    STORED = true
  } catch {
    /* 無痕模式會失敗，編輯仍然可用，只是重整後回到程式碼的值 */
  }
  for (const fn of listeners) fn(TUNING)
}

export function resetTuning() {
  try { localStorage.removeItem(KEY) } catch { /* 同上 */ }
  STORED = false
  TUNING = codeTuning()
  for (const fn of listeners) fn(TUNING)
  return TUNING
}

/** 有沒有任何一項與程式碼不同 —— 決定要不要顯示「已套用編輯值」。 */
export function isTuned() {
  if (!STORED) return false
  return JSON.stringify(TUNING) !== JSON.stringify(codeTuning())
}

// ── 讀取點（畫東西的地方一律走這幾個）──────────────────────────────────────
const FALLBACK_BLOCK = { x: 0, y: 0, w: 0, h: 0 }
/** 黑塊幾何：{x,y,w,h}，x/y 是【中心】（與 appliances.js 同一個約定）。 */
export const blockOf = (id) => TUNING.blocks[id] || FALLBACK_BLOCK
/** 大框：{x,y,w,h,r}，x/y 是【左上角】。 */
export const frameGeom = () => TUNING.frame
export const vLines = () => TUNING.vlines
export const hLines = () => TUNING.hlines
/** 框架 / 外圈的 ribbon 寬（世界單位）。原值在 FX.frame.width。 */
export const frameLineWidth = () => TUNING.lineWidth
/** 面板框：{x,y,w,h}，x/y 是【左上角】。沒登記回傳 null。 */
export const panelBoxOf = (id) => TUNING.panels[id] || null
/** 面板的字級與行距：{ title, rowGap }。原值在 theme.js 的 PANEL_TEXT。 */
export const panelText = () => TUNING.panelText
/** 面板的四邊內距：{ t, r, b, l }。原值在 theme.js 的 PANEL_PAD。 */
export const panelPad = () => TUNING.panelPad

/** 把家電節點與覆寫過的幾何合成一個新物件（label / status / route 等原樣保留）。 */
export const withBlock = (node) => ({ ...node, ...blockOf(node.id) })

/** 程式碼裡有、但被編輯模式刪掉的面板 id。 */
export function deletedPanels() {
  const base = codeTuning().panels
  return Object.keys(base).filter((id) => !TUNING.panels[id])
}

/** 把刪掉的面板照程式碼的位置放回來。⚠ 自訂面板不在此列（程式碼裡本來就沒有）。 */
export function restorePanels() {
  const base = codeTuning().panels
  const panels = { ...TUNING.panels }
  for (const id of Object.keys(base)) if (!panels[id]) panels[id] = { ...base[id] }
  setTuning({ ...TUNING, panels })
}

// ── 匯出（貼回程式碼）───────────────────────────────────────────────────────
const r1 = (n) => Math.round(n * 10) / 10

export function exportTuning() {
  const T = TUNING
  const base = codeTuning()
  const L = []
  const diff = (a, b) => JSON.stringify(a) !== JSON.stringify(b)

  const movedBlocks = Object.keys(T.blocks).filter((id) => diff(T.blocks[id], base.blocks[id]))
  if (movedBlocks.length) {
    L.push('// ── 1) 黑塊 → config/appliances.js ──')
    L.push('//    x/y 是【中心】，w/h 是長寬。⚠ 這是牆上實體展品的預留位，改完要對實牆量一次。')
    for (const id of movedBlocks) {
      const b = T.blocks[id]
      if (id === HUB_ID) {
        L.push(`export const HUB = { x: ${r1(b.x)}, y: ${r1(b.y)}, w: ${r1(b.w)}, h: ${r1(b.h)} }`)
      } else if (id === SCREEN_ID) {
        L.push(`export const RESERVED_SCREEN = { x: ${r1(b.x)}, y: ${r1(b.y)}, w: ${r1(b.w)}, h: ${r1(b.h)} }`)
      } else {
        L.push(`//    ${b.label ?? id}（${id}）`)
        L.push(`    x: ${r1(b.x)}, y: ${r1(b.y)}, w: ${r1(b.w)}, h: ${r1(b.h)},`)
      }
    }
    L.push('')
  }

  if (diff(T.frame, base.frame) || diff(T.vlines, base.vlines) || diff(T.hlines, base.hlines)) {
    L.push('// ── 2) 大框 / 格線 → config/frame.js ──')
    const f = T.frame
    L.push(`const CX = ${r1(f.x + f.w / 2)}`)
    L.push(`const CY = ${r1(f.y + f.h / 2)}`)
    L.push(`const W = ${r1(f.w)}`)
    L.push(`const H = ${r1(f.h)}`)
    L.push(`//    FRAME.r（四角倒角）= ${r1(f.r)}`)
    L.push(`export const VLINES = [${T.vlines.map(r1).join(', ')}]`)
    L.push(`export const HLINES = [${T.hlines.map(r1).join(', ')}]`)
    L.push('')
  }

  if (T.lineWidth !== base.lineWidth) {
    L.push('// ── 3) 框線粗細 → config/fx.js ──')
    L.push(`//    FX.frame.width = ${r1(T.lineWidth)}   // 目前 ${r1(base.lineWidth)}`)
    L.push('//    ⚠ 這一項是【三端共用】的：改完要跑 `node sync-tokens.mjs`，')
    L.push('//      iPad 與桌面的線也會一起變粗變細。只想動牆面的話不要改這裡。')
    L.push('//    ⚠ coreSharp 是「相對於半寬」的指數，width 改很多時亮芯會跟著變粗，')
    L.push('//      要維持芯的粗細就照比例調 FX.frame.coreSharp。')
    L.push('')
  }

  if (diff(T.panelText, base.panelText) || diff(T.panelPad, base.panelPad)) {
    L.push('// ── 3b) 面板字級 / 行距 / 四邊內距 → config/theme.js ──')
    L.push(`export const PANEL_TEXT = { title: ${r1(T.panelText.title)}, rowGap: ${r1(T.panelText.rowGap)}, stackedRatio: 34 / 25 }`)
    const p = T.panelPad
    L.push(`export const PANEL_PAD = { t: ${r1(p.t)}, r: ${r1(p.r)}, b: ${r1(p.b)}, l: ${r1(p.l)} }`)
    L.push('//    ⚠ rowGap 與四邊內距都會影響「每塊面板畫得下幾列」—— 矮的面板可能又少一列。')
    L.push('')
  }

  const panelIds = Object.keys(T.panels)
  if (panelIds.some((id) => diff(T.panels[id], base.panels[id])) || panelIds.length !== Object.keys(base.panels).length) {
    L.push('// ── 4) 資訊面板 → config/panels.js ──')
    L.push('//    x/y = 面板左上角；w/h = 面板尺寸；座標系 viewBox 1920x1080')
    L.push('export const PANEL_LAYOUT = {')
    for (const id of panelIds.filter((i) => !isChart(i))) {
      const b = T.panels[id]
      const label = b.label ? `, label: '${b.label}'` : ''
      L.push(`  ${id}: { x: ${r1(b.x)}, y: ${r1(b.y)}, w: ${r1(b.w)}, h: ${r1(b.h)}${label} },`)
    }
    L.push('}')
    const charts = panelIds.filter(isChart)
    if (charts.length) {
      L.push('')
      L.push('// CUSTOM_PANELS 的 x/y/w/h（其餘欄位維持原本的）：')
      for (const id of charts) {
        const b = T.panels[id]
        L.push(`//   ${id.slice(CHART_PREFIX.length)}: x: ${r1(b.x)}, y: ${r1(b.y)}, w: ${r1(b.w)}, h: ${r1(b.h)}`)
      }
    }
    // ⚠ 刪掉的要明講。只是「沒列出來」的話會被讀成「這塊沒動過」，
    //   貼回程式碼時就會漏掉刪除這件事。
    const goneCharts = deletedPanels().filter(isChart)
    if (goneCharts.length) {
      L.push('')
      L.push(`// ⚠ 這些圖表面板被【刪除】了，要一起從 CUSTOM_PANELS 移掉：`)
      for (const id of goneCharts) L.push(`//   ${id.slice(CHART_PREFIX.length)}`)
    }
    const extra = panelIds.filter(isCustom)
    if (extra.length) {
      L.push('')
      L.push(`// ⚠ 有 ${extra.length} 個自訂面板（${extra.join(', ')}）—— 它們沒有對應的家電，`)
      L.push('//   要留下來的話得在 appliances.js 補一台，或改成 CUSTOM_PANELS 的圖表面板。')
    }
    const missing = APPLIANCES.map((a) => a.id).filter((id) => !panelIds.includes(id))
    if (missing.length) {
      L.push('')
      L.push(`// ⚠ 這些家電的面板被【刪除】了，PANEL_LAYOUT 裡不要再有它們：${missing.join(', ')}`)
      L.push('//   （它們的 status 仍在 appliances.js，只是不畫面板。要連資料一起拿掉是另一件事。）')
    }
    L.push('')
  }

  if (!L.length) L.push('// （沒有任何改動）')
  return L.join('\n')
}

// dev 除錯把手：主控台可以讀／改「正在跑的那一份」。
// ⚠ 不要在主控台用 `await import('.../wallTuning.js')` 取代它 —— HMR 之後那樣會拿到
//   另一個模組實例（各有自己的 TUNING），讀到的值跟畫面上的對不起來。
if (import.meta.env?.DEV && typeof window !== 'undefined') {
  window.__wall = { getTuning, setTuning, resetTuning, isTuned, codeTuning, exportTuning, blockOf, deletedPanels, restorePanels }
}
