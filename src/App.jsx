import { useEffect, useReducer, useState } from 'react'
import WallScene from './components/WallScene.jsx'
import GlowCanvas from './components/GlowCanvas.jsx'
import FpsMeter from './components/FpsMeter.jsx'
import WallEditor from './components/WallEditor.jsx'
import { useDeskState } from './hooks/useDeskState.js'
import { APPLIANCE_IDS } from './config/appliances.js'
import { isTuned, subscribe } from './config/wallTuning.js'

// 現場／開發用的 debug flag（正式投影都不帶）：
//   ?all      強制所有家電 active
//   ?fps      左下角顯示幀率 / 最長幀 / 掉幀數
//   ?noglass  面板換成不透明底板（毛玻璃掉幀時的逃生開關）
//   ?nofx     完全不掛 WebGL 發光層（掉幀或 GPU 有問題時的逃生開關）
//   ?edit     一載入就進編輯模式（平常按鍵盤 e 開關就好，見 components/WallEditor.jsx）
const flag = (name) =>
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has(name)

export default function App() {
  const { activeIds } = useDeskState()
  const noGlass = flag('noglass')
  const noFx = flag('nofx')
  const [edit, setEdit] = useState(() => flag('edit'))

  // 幾何覆寫是模組層的可變狀態（見 config/wallTuning.js）—— 它一變就要重畫整棵樹。
  // ⚠ 不用 context 或把整包 tuning 放進 state：非 React 的消費者（routing、
  //   webgl/FrameLines）也要讀同一份，兩邊各存一份遲早會不同步。
  const [, bump] = useReducer((n) => n + 1, 0)
  useEffect(() => subscribe(bump), [])

  // ── 鍵盤 e 開關編輯模式 ───────────────────────────────────────────────────
  // ⚠ 展場的投影機沒有接鍵盤，所以用按鍵開啟是安全的（與 iPad 同一個作法）。
  //   有輸入焦點時不攔 —— 編輯面板自己有 number input。
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return
      const t = e.target
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      if (e.key === 'e' || e.key === 'E') setEdit((v) => !v)
      if (e.key === 'Escape') setEdit(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('noglass', noGlass)
    document.documentElement.classList.toggle('nofx', noFx)
    document.documentElement.classList.toggle('edit-mode', edit)
  }, [noGlass, noFx, edit])

  // ?all 時把九台都餵給發光層（WallScene 自己也讀這個 flag）
  const glowIds = flag('all') ? new Set(APPLIANCE_IDS) : activeIds

  return (
    <div className="wall-stage">
      {/* ⚠ canvas 要排在 SVG【之前】＝畫在底下。bloom 一定會往黑塊裡面溢，
          靠上層 SVG 的 fill="#000" 蓋掉 —— 投影機的黑 = 不出光。 */}
      {!noFx && <GlowCanvas activeIds={glowIds} />}
      <WallScene activeIds={activeIds} edit={edit} />
      {edit && <WallEditor onClose={() => setEdit(false)} />}
      {flag('fps') && <FpsMeter />}

      {/* ⚠ 有覆寫就一直顯示，編輯模式關掉也還在 —— 展場如果有人誤按 e 拖到東西，
          這是唯一會讓人發現「現在畫面不是程式碼裡那一版」的線索。 */}
      {!edit && isTuned() && <div className="we-badge">已套用編輯值（按 e 開啟編輯）</div>}
    </div>
  )
}
