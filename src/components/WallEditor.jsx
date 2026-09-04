import { useCallback, useEffect, useRef, useState } from 'react'
import { APPLIANCES, VIEWBOX } from '../config/appliances.js'
import {
  CHART_PREFIX, CUSTOM_PREFIX, HUB_ID, SCREEN_ID,
  deletedPanels, exportTuning, getTuning, isChart, isCustom,
  resetTuning, restorePanels, setTuning,
} from '../config/wallTuning.js'

// ============================================================================
// 版面編輯器（鍵盤 e）—— 暫時性工具，不是展場的一部分。
//
// 三種物件，一個分頁一種：
//   黑塊  十一塊實體展品的預留位（九台家電 + AI 核心 + 電視）。搬位置、改大小。
//   框架  大框四邊、8 條垂直格線、4 條水平格線的位置，加上框線粗細與四角圓角。
//   面板  九塊資訊面板 + 三塊圖表面板 + 自訂面板。搬位置、改大小、增刪、統一尺寸。
//
// ⚠ 值即時寫進 config/wallTuning.js（localStorage），畫面立刻跟著變 ——
//   包括底下那張 WebGL canvas 的框架、外圈與走線（走線會重新避讓）。
// ⚠ localStorage 只是過程的暫存。調完按「匯出」，把內容貼回程式碼。
// ⚠ 展場的投影機沒有鍵盤，所以用按鍵開啟是安全的。
// ============================================================================

const GRID = 5 // 吸附格；按住 Alt 可以無視
const MIN_BLOCK = 40
const MIN_PANEL_W = 80
const MIN_PANEL_H = 50

const TABS = [
  ['blocks', '黑塊'],
  ['frame', '框架'],
  ['panels', '面板'],
]

const r1 = (n) => Math.round(n * 10) / 10

export default function WallEditor({ onClose }) {
  const T = getTuning()
  const [tab, setTab] = useState('blocks')
  const [sel, setSel] = useState(null) // { kind, id } —— kind 與 tab 對應
  const [collapsed, setCollapsed] = useState(false)
  const [exported, setExported] = useState(null) // { text, note }
  const layerRef = useRef(null)
  const drag = useRef(null)

  // 螢幕座標 → viewBox 座標。
  // ⚠ 用【疊在上面那張 svg 自己】的 CTM，不是牆面那張 —— 兩張的 viewBox 一樣，
  //   但只有這一張保證與畫在上面的把手同一個座標系。
  const toVB = useCallback((e) => {
    const svg = layerRef.current
    if (!svg) return { x: 0, y: 0 }
    const m = svg.getScreenCTM()
    return { x: (e.clientX - m.e) / m.a, y: (e.clientY - m.f) / m.d }
  }, [])

  // ── 拖曳：一套機制吃三種物件 ──────────────────────────────────────────────
  // apply(dx, dy, snap) 由各個把手自己提供，起始值在 down 的時候就抓好（base），
  // 不從當下的 state 讀 —— 邊拖邊讀會把每一幀的捨入誤差累積起來，越拖越歪。
  const startDrag = (apply) => (e) => {
    e.preventDefault()
    e.stopPropagation()
    const p = toVB(e)
    drag.current = { start: p, apply }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* 某些環境不支援；下面的 buttons 檢查會兜底 */
    }
  }

  useEffect(() => {
    const move = (e) => {
      const d = drag.current
      if (!d) return
      // 兜底：沒按著鍵卻收到 move ＝ pointerup 漏掉了（滑出視窗、焦點被搶走…）。
      // 不自我修復的話物件會一直黏著游標跑。
      if (e.buttons === 0) {
        drag.current = null
        return
      }
      const p = toVB(e)
      const snap = (v) => (e.altKey ? Math.round(v * 10) / 10 : Math.round(v / GRID) * GRID)
      d.apply(p.x - d.start.x, p.y - d.start.y, snap)
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
  }, [toVB])

  // ── 方向鍵微調選取中的物件（Shift = 10 格）──────────────────────────────
  useEffect(() => {
    const key = (e) => {
      if (!sel) return
      const t = e.target
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      const step = e.shiftKey ? 10 : 1
      const d = {
        ArrowLeft: [-step, 0], ArrowRight: [step, 0],
        ArrowUp: [0, -step], ArrowDown: [0, step],
      }[e.key]
      if (!d) return
      e.preventDefault()
      nudge(sel, d[0], d[1])
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [sel])

  function nudge(s, dx, dy) {
    if (s.kind === 'block') {
      setTuning((t) => ({ ...t, blocks: { ...t.blocks, [s.id]: { ...t.blocks[s.id], x: t.blocks[s.id].x + dx, y: t.blocks[s.id].y + dy } } }))
    } else if (s.kind === 'panel') {
      setTuning((t) => ({ ...t, panels: { ...t.panels, [s.id]: { ...t.panels[s.id], x: t.panels[s.id].x + dx, y: t.panels[s.id].y + dy } } }))
    } else if (s.kind === 'vline') {
      setTuning((t) => ({ ...t, vlines: t.vlines.map((v, i) => (i === s.id ? v + dx : v)) }))
    } else if (s.kind === 'hline') {
      setTuning((t) => ({ ...t, hlines: t.hlines.map((v, i) => (i === s.id ? v + dy : v)) }))
    } else if (s.kind === 'frame') {
      setTuning((t) => ({ ...t, frame: { ...t.frame, x: t.frame.x + dx, y: t.frame.y + dy } }))
    }
  }

  // ── 黑塊 ──────────────────────────────────────────────────────────────────
  const setBlock = (id, patch) =>
    setTuning((t) => ({ ...t, blocks: { ...t.blocks, [id]: { ...t.blocks[id], ...patch } } }))

  const blockMove = (id) => {
    const base = { ...T.blocks[id] }
    return (dx, dy, snap) => setBlock(id, { x: snap(base.x + dx), y: snap(base.y + dy) })
  }
  // 右下角把手：左上角固定不動（中心錨點自己往內縮一半）。
  const blockResize = (id) => {
    const base = { ...T.blocks[id] }
    const left = base.x - base.w / 2
    const top = base.y - base.h / 2
    return (dx, dy, snap) => {
      const w = Math.max(MIN_BLOCK, snap(base.w + dx))
      const h = Math.max(MIN_BLOCK, snap(base.h + dy))
      setBlock(id, { w, h, x: left + w / 2, y: top + h / 2 })
    }
  }

  // ── 框架 ──────────────────────────────────────────────────────────────────
  const setFrame = (patch) => setTuning((t) => ({ ...t, frame: { ...t.frame, ...patch } }))

  const lineMove = (kind, i) => {
    const base = kind === 'v' ? T.vlines[i] : T.hlines[i]
    return (dx, dy, snap) => {
      const v = snap(base + (kind === 'v' ? dx : dy))
      setTuning((t) => (kind === 'v'
        ? { ...t, vlines: t.vlines.map((n, j) => (j === i ? v : n)) }
        : { ...t, hlines: t.hlines.map((n, j) => (j === i ? v : n)) }))
    }
  }
  // 大框的四個邊：拖一邊只動那一邊（另外三邊不動）。
  const frameEdge = (side) => {
    const b = { ...T.frame }
    return (dx, dy, snap) => {
      if (side === 'L') {
        const x = Math.min(snap(b.x + dx), b.x + b.w - 100)
        setFrame({ x, w: b.w + (b.x - x) })
      } else if (side === 'R') {
        setFrame({ w: Math.max(100, snap(b.w + dx)) })
      } else if (side === 'T') {
        const y = Math.min(snap(b.y + dy), b.y + b.h - 100)
        setFrame({ y, h: b.h + (b.y - y) })
      } else {
        setFrame({ h: Math.max(100, snap(b.h + dy)) })
      }
    }
  }
  const frameMove = () => {
    const b = { ...T.frame }
    return (dx, dy, snap) => setFrame({ x: snap(b.x + dx), y: snap(b.y + dy) })
  }

  // ── 面板 ──────────────────────────────────────────────────────────────────
  const setPanel = (id, patch) =>
    setTuning((t) => ({ ...t, panels: { ...t.panels, [id]: { ...t.panels[id], ...patch } } }))

  const panelMove = (id) => {
    const base = { ...T.panels[id] }
    return (dx, dy, snap) => setPanel(id, { x: snap(base.x + dx), y: snap(base.y + dy) })
  }
  const panelResize = (id) => {
    const base = { ...T.panels[id] }
    return (dx, dy, snap) => setPanel(id, {
      w: Math.max(MIN_PANEL_W, snap(base.w + dx)),
      h: Math.max(MIN_PANEL_H, snap(base.h + dy)),
    })
  }

  const addPanel = () => {
    let i = 1
    while (T.panels[`${CUSTOM_PREFIX}${i}`]) i++
    const id = `${CUSTOM_PREFIX}${i}`
    setTuning((t) => ({ ...t, panels: { ...t.panels, [id]: { x: 860, y: 480, w: 220, h: 116, label: `自訂面板 ${i}` } } }))
    setSel({ kind: 'panel', id })
  }

  const delPanel = (id) => {
    // ⚠ 一定要一起清掉 sel。少了這行，sel 還指著已刪掉的 id，
    //   下面工具列讀 T.panels[sel.id].x 就會炸掉整個編輯器
    //   （症狀是「刪不掉」，實際上是元件崩潰卸載）。
    setSel(null)
    setTuning((t) => {
      const panels = { ...t.panels }
      delete panels[id]
      return { ...t, panels }
    })
  }

  // 面板的字級與行距（全部面板共用一組 —— 整面牆的字要一致）。
  const setText = (patch) =>
    setTuning((t) => ({ ...t, panelText: { ...t.panelText, ...patch } }))

  // 四邊內距（上／右／下／左），同樣全部面板共用一組。
  const setPad = (patch) =>
    setTuning((t) => ({ ...t, panelPad: { ...t.panelPad, ...patch } }))

  // 統一面板大小：把某一塊的 w/h 套到全部。
  // ⚠ 圖表面板一起算在內 —— 它們與資訊面板並排在同一面牆上，尺寸不一才是問題的來源。
  const unifySize = (w, h) => {
    setTuning((t) => {
      const panels = {}
      for (const [id, b] of Object.entries(t.panels)) panels[id] = { ...b, w, h }
      return { ...t, panels }
    })
  }

  // ── 畫面 ──────────────────────────────────────────────────────────────────
  const selBox = (() => {
    if (!sel) return null
    if (sel.kind === 'block') return T.blocks[sel.id] || null
    if (sel.kind === 'panel') return T.panels[sel.id] || null
    return null
  })()

  return (
    <>
      <svg
        ref={layerRef}
        className="we-layer"
        viewBox={`0 0 ${VIEWBOX.w} ${VIEWBOX.h}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {tab === 'blocks' && Object.entries(T.blocks).map(([id, b]) => {
          const on = sel?.kind === 'block' && sel.id === id
          const x = b.x - b.w / 2
          const y = b.y - b.h / 2
          return (
            <g key={id} className={`we-obj${on ? ' we-obj--on' : ''}`}>
              <rect
                className="we-hit" x={x} y={y} width={b.w} height={b.h}
                onPointerDown={(e) => { setSel({ kind: 'block', id }); startDrag(blockMove(id))(e) }}
              />
              <text className="we-tag" x={x + 4} y={y - 5}>
                {b.label ?? id} · {r1(b.x)},{r1(b.y)} · {r1(b.w)}×{r1(b.h)}
              </text>
              <rect
                className="we-grip" x={x + b.w - 11} y={y + b.h - 11} width={22} height={22}
                onPointerDown={(e) => { setSel({ kind: 'block', id }); startDrag(blockResize(id))(e) }}
              />
            </g>
          )
        })}

        {tab === 'frame' && (
          <>
            {/* 大框：中間一塊可以整個搬，四邊各一條可以單獨拖 */}
            <rect
              className="we-hit we-hit--frame"
              x={T.frame.x + 40} y={T.frame.y + 40}
              width={Math.max(10, T.frame.w - 80)} height={Math.max(10, T.frame.h - 80)}
              onPointerDown={(e) => { setSel({ kind: 'frame', id: 'frame' }); startDrag(frameMove())(e) }}
            />
            {['L', 'R', 'T', 'B'].map((side) => {
              const b = T.frame
              const vert = side === 'L' || side === 'R'
              const x = side === 'L' ? b.x - 8 : side === 'R' ? b.x + b.w - 8 : b.x
              const y = side === 'T' ? b.y - 8 : side === 'B' ? b.y + b.h - 8 : b.y
              return (
                <rect
                  key={side} className="we-edge" x={x} y={y}
                  width={vert ? 16 : b.w} height={vert ? b.h : 16}
                  style={{ cursor: vert ? 'ew-resize' : 'ns-resize' }}
                  onPointerDown={(e) => { setSel({ kind: 'frame', id: 'frame' }); startDrag(frameEdge(side))(e) }}
                />
              )
            })}
            {/* 格線。⚠ 每條給兩個抓點：
                  (a) 沿線的全長拖曳帶 —— 好按，但垂直與水平在交叉處必然重疊，
                      在交叉點附近會抓到另一條（實際踩過：想拖 V3 結果抓到 H2，
                      往橫的拖 dy=0，看起來就像「拖不動」）。
                  (b) 框外緣的尺標把手 —— 兩組永遠不重疊，抓不到才用這個。
                頁面順序：先水平帶、再垂直帶、最後全部把手 —— 把手一定在最上層。 */}
            {T.hlines.map((hy, i) => (
              <rect
                key={`hs${i}`} className="we-line-hit"
                x={T.frame.x} y={hy - 9} width={T.frame.w} height={18}
                style={{ cursor: 'ns-resize' }}
                onPointerDown={(e) => { setSel({ kind: 'hline', id: i }); startDrag(lineMove('h', i))(e) }}
              />
            ))}
            {T.vlines.map((vx, i) => (
              <rect
                key={`vs${i}`} className="we-line-hit"
                x={vx - 9} y={T.frame.y} width={18} height={T.frame.h}
                style={{ cursor: 'ew-resize' }}
                onPointerDown={(e) => { setSel({ kind: 'vline', id: i }); startDrag(lineMove('v', i))(e) }}
              />
            ))}
            {T.vlines.map((vx, i) => {
              const on = sel?.kind === 'vline' && sel.id === i
              return (
                <g key={`v${i}`} className={`we-obj${on ? ' we-obj--on' : ''}`}>
                  <line className="we-guide" x1={vx} y1={T.frame.y} x2={vx} y2={T.frame.y + T.frame.h} />
                  <rect
                    className="we-line-grip" x={vx - 8} y={T.frame.y - 26} width={16} height={22}
                    style={{ cursor: 'ew-resize' }}
                    onPointerDown={(e) => { setSel({ kind: 'vline', id: i }); startDrag(lineMove('v', i))(e) }}
                  />
                  <text className="we-tag" x={vx + 11} y={T.frame.y - 9}>V{i + 1} {r1(vx)}</text>
                </g>
              )
            })}
            {T.hlines.map((hy, i) => {
              const on = sel?.kind === 'hline' && sel.id === i
              return (
                <g key={`h${i}`} className={`we-obj${on ? ' we-obj--on' : ''}`}>
                  <line className="we-guide" x1={T.frame.x} y1={hy} x2={T.frame.x + T.frame.w} y2={hy} />
                  <rect
                    className="we-line-grip" x={T.frame.x - 26} y={hy - 8} width={22} height={16}
                    style={{ cursor: 'ns-resize' }}
                    onPointerDown={(e) => { setSel({ kind: 'hline', id: i }); startDrag(lineMove('h', i))(e) }}
                  />
                  <text className="we-tag" x={T.frame.x - 24} y={hy - 12}>H{i + 1} {r1(hy)}</text>
                </g>
              )
            })}
          </>
        )}

        {tab === 'panels' && Object.entries(T.panels).map(([id, b]) => {
          const on = sel?.kind === 'panel' && sel.id === id
          return (
            <g key={id} className={`we-obj${on ? ' we-obj--on' : ''}${isChart(id) ? ' we-obj--chart' : ''}`}>
              <rect
                className="we-hit" x={b.x} y={b.y} width={b.w} height={b.h}
                onPointerDown={(e) => { setSel({ kind: 'panel', id }); startDrag(panelMove(id))(e) }}
              />
              <text className="we-tag" x={b.x + 4} y={b.y - 5}>
                {labelOf(id)} · {r1(b.x)},{r1(b.y)} · {r1(b.w)}×{r1(b.h)}
              </text>
              <rect
                className="we-grip" x={b.x + b.w - 11} y={b.y + b.h - 11} width={22} height={22}
                onPointerDown={(e) => { setSel({ kind: 'panel', id }); startDrag(panelResize(id))(e) }}
              />
            </g>
          )
        })}
      </svg>

      <div className={`we-panel${collapsed ? ' we-panel--min' : ''}`}>
        <div className="we-head">
          <strong>版面編輯</strong>
          {!collapsed && (
            <div className="we-tabs">
              {TABS.map(([k, label]) => (
                <button
                  key={k}
                  className={tab === k ? 'on' : ''}
                  onClick={() => { setTab(k); setSel(null) }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <span className="we-spacer" />
          {/* ⚠ 收起是必要的，不是裝飾：面板固定在左下角，正好蓋住「燈」與「智慧插座」
              那一區，不收起來就沒辦法對那兩塊的版面。 */}
          <button className="we-icon" onClick={() => setCollapsed((v) => !v)} title={collapsed ? '展開' : '收起'}>
            {collapsed ? '▲' : '▼'}
          </button>
          <button className="we-icon" onClick={onClose} title="關閉編輯模式（e）">✕</button>
        </div>

        {!collapsed && (
          <div className="we-body">
            {tab === 'blocks' && (
              <BlockTab T={T} sel={sel} setSel={setSel} setBlock={setBlock} />
            )}
            {tab === 'frame' && (
              <FrameTab T={T} setFrame={setFrame} setTuning={setTuning} />
            )}
            {tab === 'panels' && (
              <PanelTab
                T={T} sel={sel} setSel={setSel} setPanel={setPanel}
                addPanel={addPanel} delPanel={delPanel} unifySize={unifySize}
                setText={setText} setPad={setPad}
              />
            )}

            <div className="we-foot">
              {/* ⚠ 不要用 alert 顯示匯出結果：alert 裡的文字【選不起來】，
                  而且 alert 會立刻搶走焦點，讓還沒完成的 navigator.clipboard
                  寫入被瀏覽器拒絕 —— 兩件事加起來就是「匯出了但複製不到」
                  （實際踩過）。改成可以選取的文字框，並提供不依賴剪貼簿的存檔。 */}
              <button onClick={() => {
                const t = exportTuning()
                window.__wallExport = t
                setExported({ text: t, note: '' })
              }}>匯出</button>
              <button onClick={() => {
                if (confirm('把黑塊、框架、面板全部還原成程式碼裡的值？')) {
                  resetTuning()
                  setSel(null)
                }
              }}>全部重設</button>
              <span className="we-dim">
                {selBox
                  ? `${r1(selBox.x)}, ${r1(selBox.y)} · ${r1(selBox.w)}×${r1(selBox.h)}`
                  : '拖曳移動｜右下角縮放｜方向鍵微調(Shift×10)｜Alt 關閉吸附'}
              </span>
            </div>
          </div>
        )}
      </div>

      {exported && (
        <ExportBox
          data={exported}
          setData={setExported}
          onClose={() => setExported(null)}
        />
      )}
    </>
  )
}

// ── 匯出視窗 ────────────────────────────────────────────────────────────────
// 三條拿到文字的路，任何一條不通都還有別的：
//   1. textarea 本身可以選取（開啟時已經全選，直接 ⌘C / Ctrl+C）
//   2. 「複製」按鈕走 navigator.clipboard，失敗會退回 execCommand
//   3. 「存到專案」POST 給 dev server 寫成 wall-export.txt（完全不碰剪貼簿）
function ExportBox({ data, setData, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])

  const copy = async () => {
    const el = ref.current
    el.focus()
    el.select()
    try {
      await navigator.clipboard.writeText(data.text)
      setData((d) => ({ ...d, note: '已複製到剪貼簿' }))
    } catch {
      // 沒有焦點 / 非安全環境時 clipboard API 會被拒絕，退回舊 API
      const ok = document.execCommand?.('copy')
      setData((d) => ({ ...d, note: ok ? '已複製到剪貼簿' : '複製失敗 —— 文字已全選，請按 ⌘C / Ctrl+C' }))
    }
  }

  const save = async () => {
    try {
      const r = await fetch('/__wall-export', { method: 'POST', body: data.text })
      const j = await r.json()
      setData((d) => ({ ...d, note: `已存成 F-wall/${j.file}` }))
    } catch (err) {
      setData((d) => ({ ...d, note: `存檔失敗：${err.message}（這個端點只有 npm run dev 有）` }))
    }
  }

  return (
    <div className="we-export">
      <div className="we-head">
        <strong>匯出</strong>
        <span className="we-spacer" />
        <button onClick={copy}>複製</button>
        <button onClick={save}>存到專案</button>
        <button className="we-icon" onClick={onClose} title="關閉">✕</button>
      </div>
      <textarea ref={ref} readOnly value={data.text} spellCheck={false} />
      <div className="we-dim we-export-note">
        {data.note || '文字已全選，可以直接 ⌘C / Ctrl+C；或按「存到專案」寫成 wall-export.txt。'}
      </div>
    </div>
  )
}

// ── 分頁內容 ────────────────────────────────────────────────────────────────

function labelOf(id) {
  if (isChart(id)) return `圖表 ${id.slice(CHART_PREFIX.length)}`
  if (isCustom(id)) return id
  return APPLIANCES.find((a) => a.id === id)?.label ?? id
}

function Num({ label, value, onChange, step = 1, min, max }) {
  return (
    <label className="we-num">
      <span>{label}</span>
      <input
        type="number" value={r1(value)} step={step} min={min} max={max}
        onChange={(e) => {
          const v = parseFloat(e.target.value)
          if (!Number.isNaN(v)) onChange(v)
        }}
      />
    </label>
  )
}

function BlockTab({ T, sel, setSel, setBlock }) {
  const id = sel?.kind === 'block' ? sel.id : null
  const b = id ? T.blocks[id] : null
  const ids = Object.keys(T.blocks)
  return (
    <>
      <div className="we-row">
        <select value={id ?? ''} onChange={(e) => setSel(e.target.value ? { kind: 'block', id: e.target.value } : null)}>
          <option value="">選一塊…（{ids.length} 塊）</option>
          {ids.map((k) => (
            <option key={k} value={k}>
              {T.blocks[k].label ?? k}{k === HUB_ID || k === SCREEN_ID ? '（預留）' : ''}
            </option>
          ))}
        </select>
      </div>
      {b ? (
        <div className="we-row">
          <Num label="中心 X" value={b.x} onChange={(v) => setBlock(id, { x: v })} />
          <Num label="中心 Y" value={b.y} onChange={(v) => setBlock(id, { y: v })} />
          <Num label="寬" value={b.w} onChange={(v) => setBlock(id, { w: Math.max(MIN_BLOCK, v) })} />
          <Num label="高" value={b.h} onChange={(v) => setBlock(id, { h: Math.max(MIN_BLOCK, v) })} />
        </div>
      ) : (
        <p className="we-dim we-hint">
          在畫面上點一塊黑塊，或從上面選。x/y 是【中心】—— 這十一塊是牆上實體展品的
          預留位，改完要對實牆量一次。
        </p>
      )}
    </>
  )
}

function FrameTab({ T, setFrame, setTuning }) {
  return (
    <>
      <div className="we-row">
        <Num label="框 X" value={T.frame.x} onChange={(v) => setFrame({ x: v })} />
        <Num label="框 Y" value={T.frame.y} onChange={(v) => setFrame({ y: v })} />
        <Num label="框寬" value={T.frame.w} onChange={(v) => setFrame({ w: Math.max(100, v) })} />
        <Num label="框高" value={T.frame.h} onChange={(v) => setFrame({ h: Math.max(100, v) })} />
      </div>
      <div className="we-row">
        <label className="we-slider">
          <span>四角圓角 {r1(T.frame.r)}</span>
          <input
            type="range" min="0" max="200" step="1" value={T.frame.r}
            onChange={(e) => setFrame({ r: parseFloat(e.target.value) })}
          />
        </label>
        <label className="we-slider">
          <span>框線粗細 {r1(T.lineWidth)}</span>
          <input
            type="range" min="2" max="80" step="0.5" value={T.lineWidth}
            onChange={(e) => setTuning((t) => ({ ...t, lineWidth: parseFloat(e.target.value) }))}
          />
        </label>
      </div>
      <p className="we-dim we-hint">
        直接拖畫面上的格線可以改位置；大框拖四邊改大小、拖中間整個搬。
        ⚠ 框線粗細是【三端共用】的 token（FX.frame.width），匯出時會提醒。
      </p>
    </>
  )
}

function PanelTab({ T, sel, setSel, setPanel, addPanel, delPanel, unifySize, setText, setPad }) {
  const id = sel?.kind === 'panel' ? sel.id : null
  const b = id ? T.panels[id] : null
  const ids = Object.keys(T.panels)
  const gone = deletedPanels()
  // 統一尺寸的預設值：有選就用選的，沒選就用出現次數最多的那一組。
  const [uw, uh] = (() => {
    if (b) return [b.w, b.h]
    const count = {}
    for (const k of ids) {
      const key = `${T.panels[k].w}x${T.panels[k].h}`
      count[key] = (count[key] || 0) + 1
    }
    const top = Object.entries(count).sort((a, c) => c[1] - a[1])[0]
    return top ? top[0].split('x').map(Number) : [220, 116]
  })()

  return (
    <>
      <div className="we-row">
        <select value={id ?? ''} onChange={(e) => setSel(e.target.value ? { kind: 'panel', id: e.target.value } : null)}>
          <option value="">選一塊…（{ids.length} 塊）</option>
          {ids.map((k) => <option key={k} value={k}>{labelOf(k)}</option>)}
        </select>
        <button onClick={addPanel}>＋ 新增</button>
        <button onClick={() => id && delPanel(id)} disabled={!id}>刪除選取</button>
      </div>
      {b && (
        <div className="we-row">
          <Num label="X" value={b.x} onChange={(v) => setPanel(id, { x: v })} />
          <Num label="Y" value={b.y} onChange={(v) => setPanel(id, { y: v })} />
          <Num label="寬" value={b.w} onChange={(v) => setPanel(id, { w: Math.max(MIN_PANEL_W, v) })} />
          <Num label="高" value={b.h} onChange={(v) => setPanel(id, { h: Math.max(MIN_PANEL_H, v) })} />
        </div>
      )}
      <div className="we-row">
        <button onClick={() => unifySize(uw, uh)}>
          統一全部為 {r1(uw)}×{r1(uh)}
        </button>
        <span className="we-dim">
          {b ? '（＝目前選取的尺寸）' : '（＝目前最多面板用的尺寸）'}
        </span>
      </div>
      {/* ⚠ 刪掉家電／圖表面板之後，上面的下拉就找不到它了 —— 沒有這顆按鈕的話
          唯一的救援是「全部重設」，連黑塊與框架的調整一起賠掉。 */}
      {gone.length > 0 && (
        <div className="we-row">
          <button onClick={restorePanels}>還原 {gone.length} 塊刪除的面板</button>
          <span className="we-dim">{gone.map(labelOf).join('、')}</span>
        </div>
      )}
      <div className="we-row">
        <label className="we-slider">
          <span>家電名稱字級 {r1(T.panelText.title)}</span>
          <input
            type="range" min="6" max="30" step="0.5" value={T.panelText.title}
            onChange={(e) => setText({ title: parseFloat(e.target.value) })}
          />
        </label>
        <label className="we-slider">
          <span>資料列行距 {r1(T.panelText.rowGap)}</span>
          <input
            type="range" min="10" max="60" step="1" value={T.panelText.rowGap}
            onChange={(e) => setText({ rowGap: parseFloat(e.target.value) })}
          />
        </label>
      </div>
      <div className="we-row">
        <span className="we-dim">四邊內距</span>
        <Num label="上" value={T.panelPad.t} onChange={(v) => setPad({ t: Math.max(0, v) })} />
        <Num label="右" value={T.panelPad.r} onChange={(v) => setPad({ r: Math.max(0, v) })} />
        <Num label="下" value={T.panelPad.b} onChange={(v) => setPad({ b: Math.max(0, v) })} />
        <Num label="左" value={T.panelPad.l} onChange={(v) => setPad({ l: Math.max(0, v) })} />
      </div>
      <p className="we-dim we-hint">
        字級、行距與內距都是【全部面板共用】一組，整面牆的字才會一致。名稱字級是
        上限，名字長的面板會自己再往下縮；標題基線是「上內距 + 字級」算出來的，
        所以字調大不會再頂出面板上緣。
        ⚠ 面板矮到一定程度就只畫得下前兩列資料（見 appliances.js 的 rows 註解）——
        改行距或統一尺寸之後，記得回頭看每塊面板還顯示得下什麼。
      </p>
    </>
  )
}
