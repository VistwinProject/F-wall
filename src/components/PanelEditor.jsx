import { useCallback, useEffect, useRef, useState } from 'react'
import { APPLIANCES, VIEWBOX } from '../config/appliances.js'
import { panelBox } from './ApplianceNode.jsx'
import {
  CUSTOM_PREFIX,
  clearLayout,
  exportLayout,
  isCustom,
  loadLayout,
  saveLayout,
} from '../config/panelLayout.js'

// ============================================================================
// ?edit —— 面板版面編輯器（暫時性工具，不是展場的一部分）
//
// 能做：拖曳移動、右下角把手縮放、新增／刪除面板、鍵盤微調。
// 存在 localStorage，重整不會掉。調完按「匯出」，把內容給我寫回程式碼。
//
// ⚠ 只動面板。九個黑塊是牆上實體展品的預留位，編輯器不提供搬移，
//    在這裡它們只是對位用的參考。
// ============================================================================

const GRID = 5 // 吸附格；按住 Alt 可以無視

export function buildInitialLayout() {
  const saved = loadLayout()
  if (Object.keys(saved).length) return saved
  const out = {}
  for (const a of APPLIANCES) out[a.id] = { ...panelBox(a) }
  return out
}

export default function PanelEditor({ layout, setLayout }) {
  const [sel, setSel] = useState(null)
  const drag = useRef(null)

  useEffect(() => saveLayout(layout), [layout])

  // 螢幕座標 → viewBox 座標
  const toVB = useCallback((e) => {
    const svg = document.querySelector('.wall-stage svg')
    const m = svg.getScreenCTM()
    return { x: (e.clientX - m.e) / m.a, y: (e.clientY - m.f) / m.d }
  }, [])

  const onDown = (id, mode) => (e) => {
    e.preventDefault()
    e.stopPropagation()
    setSel(id)
    const p = toVB(e)
    drag.current = { id, mode, start: p, box: { ...layout[id] } }
    // 抓住指標，之後的 move/up 一定回到這個元素，不會因為滑出去而漏掉
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* 某些環境不支援，下面的 buttons 檢查會兜底 */
    }
  }

  useEffect(() => {
    const move = (e) => {
      const d = drag.current
      if (!d) return
      // 兜底：沒有按著鍵卻收到 move，代表 pointerup 漏掉了（滑出視窗、
      // 焦點被搶走、合成事件…）。不自我修復的話面板會一直黏著游標跑。
      if (e.buttons === 0) {
        drag.current = null
        return
      }
      const p = toVB(e)
      const snap = (v) => (e.altKey ? Math.round(v * 10) / 10 : Math.round(v / GRID) * GRID)
      const dx = p.x - d.start.x
      const dy = p.y - d.start.y
      setLayout((L) => {
        const b = { ...d.box }
        if (d.mode === 'move') {
          b.x = snap(d.box.x + dx)
          b.y = snap(d.box.y + dy)
        } else {
          b.w = Math.max(80, snap(d.box.w + dx))
          b.h = Math.max(50, snap(d.box.h + dy))
        }
        return { ...L, [d.id]: b }
      })
    }
    const up = () => (drag.current = null)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    window.addEventListener('blur', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      window.removeEventListener('blur', up)
    }
  }, [setLayout, toVB])

  // 方向鍵微調選取中的面板（Shift = 10 格）
  useEffect(() => {
    const key = (e) => {
      if (!sel) return
      const step = e.shiftKey ? 10 : 1
      const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key]
      if (!d) return
      e.preventDefault()
      setLayout((L) => ({ ...L, [sel]: { ...L[sel], x: L[sel].x + d[0], y: L[sel].y + d[1] } }))
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [sel, setLayout])

  const addPanel = () => {
    let i = 1
    while (layout[`${CUSTOM_PREFIX}${i}`]) i++
    const id = `${CUSTOM_PREFIX}${i}`
    setLayout((L) => ({ ...L, [id]: { x: 860, y: 480, w: 220, h: 116, label: `自訂面板 ${i}` } }))
    setSel(id)
  }

  const del = (id) =>
    setLayout((L) => {
      const n = { ...L }
      delete n[id]
      return n
    })

  const reset = () => {
    clearLayout()
    const out = {}
    for (const a of APPLIANCES) out[a.id] = { ...panelBox(a) }
    setLayout(out)
    setSel(null)
  }

  const ids = Object.keys(layout)
  const b = sel ? layout[sel] : null

  return (
    <>
      {/* 疊在 SVG 上的操作層。用一個滿版 svg 讓座標系與牆面一致。 */}
      <svg className="pe-layer" viewBox={`0 0 ${VIEWBOX.w} ${VIEWBOX.h}`} preserveAspectRatio="xMidYMid meet">
        {ids.map((id) => {
          const p = layout[id]
          const on = sel === id
          return (
            <g key={id}>
              <rect
                className={`pe-hit${on ? ' pe-hit--on' : ''}`}
                x={p.x}
                y={p.y}
                width={p.w}
                height={p.h}
                onPointerDown={onDown(id, 'move')}
              />
              <text className="pe-tag" x={p.x + 6} y={p.y - 6}>
                {id} · {Math.round(p.x)},{Math.round(p.y)} · {Math.round(p.w)}×{Math.round(p.h)}
              </text>
              <rect
                className="pe-grip"
                x={p.x + p.w - 11}
                y={p.y + p.h - 11}
                width={22}
                height={22}
                onPointerDown={onDown(id, 'resize')}
              />
            </g>
          )
        })}
      </svg>

      <div className="pe-bar">
        <strong>面板編輯器</strong>
        <span className="pe-dim">{ids.length} 個面板</span>
        <button onClick={addPanel}>＋ 新增面板</button>
        <button onClick={() => sel && del(sel)} disabled={!sel}>
          刪除選取
        </button>
        <button onClick={reset}>重設為預設</button>
        <button
          onClick={() => {
            const t = exportLayout(layout)
            navigator.clipboard?.writeText(t)
            window.__panelLayoutExport = t
            alert(t + '\n\n（已複製到剪貼簿）')
          }}
        >
          匯出
        </button>
        <span className="pe-dim">
          {sel ? `選取：${sel}　${Math.round(b.x)},${Math.round(b.y)}　${Math.round(b.w)}×${Math.round(b.h)}` : '點面板選取'}
        </span>
        <span className="pe-dim">拖曳移動｜右下角縮放｜方向鍵微調(Shift×10)｜Alt 關閉吸附</span>
      </div>
    </>
  )
}
