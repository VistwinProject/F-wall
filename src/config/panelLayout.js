// ============================================================================
// 面板版面覆寫 —— 只給編輯器 (?edit) 用的暫時性資料層
// ----------------------------------------------------------------------------
// 正式投影【不會】走到這裡：WallScene 只有在 ?edit 時才讀覆寫值，
// 其他時候一律用 ApplianceNode 的 panelBox() 自動算。
//
// 調完之後把 ?edit 畫面上「匯出」的內容給我，我再把數值寫回程式碼裡 ——
// localStorage 只是調整過程的暫存，不是最終的設定檔。
// ============================================================================
import { APPLIANCES } from './appliances.js'

const KEY = 'f-wall-panel-layout'

export const isEditMode = () =>
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('edit')

export function loadLayout() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function saveLayout(layout) {
  try {
    localStorage.setItem(KEY, JSON.stringify(layout))
  } catch {
    /* 無痕模式之類會失敗，編輯器仍可用，只是重整後會回到預設 */
  }
}

export function clearLayout() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* 同上 */
  }
}

// 自訂面板（不對應任何家電）的 id 前綴
export const CUSTOM_PREFIX = 'custom-'
export const isCustom = (id) => id.startsWith(CUSTOM_PREFIX)

// 自訂面板要能餵進 StatusPanel，得長得像一個 node。
// w/h 給 0 代表「沒有實體家電框」→ StatusPanel 就不會畫引線。
export function customNode(id, label) {
  return {
    id,
    label: label || '自訂面板',
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    status: {
      code: id.toUpperCase(),
      state: '—',
      tone: 'ok',
      rows: [
        ['項目一', '000'],
        ['項目二', '000'],
      ],
    },
  }
}

// 匯出成可以直接貼回程式碼的形式
export function exportLayout(layout) {
  const lines = []
  lines.push('// ── 面板版面（由 ?edit 編輯器匯出）──')
  lines.push('// x / y = 面板左上角；w / h = 面板尺寸；座標系 viewBox 1920x1080')
  lines.push('export const PANEL_LAYOUT = {')
  for (const [id, b] of Object.entries(layout)) {
    const r = (n) => Math.round(n * 10) / 10
    const label = b.label ? `, label: '${b.label}'` : ''
    lines.push(`  '${id}': { x: ${r(b.x)}, y: ${r(b.y)}, w: ${r(b.w)}, h: ${r(b.h)}${label} },`)
  }
  lines.push('}')
  const ids = Object.keys(layout)
  const extra = ids.filter(isCustom)
  const missing = APPLIANCES.map((a) => a.id).filter((id) => !ids.includes(id))
  lines.push('')
  lines.push(`// 共 ${ids.length} 個面板（家電 ${ids.length - extra.length} + 自訂 ${extra.length}）`)
  if (missing.length) lines.push(`// ⚠ 這些家電沒有面板：${missing.join(', ')}`)
  return lines.join('\n')
}
