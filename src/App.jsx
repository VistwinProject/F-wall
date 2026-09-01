import { useEffect, useState } from 'react'
import WallScene from './components/WallScene.jsx'
import FpsMeter from './components/FpsMeter.jsx'
import PanelEditor, { buildInitialLayout } from './components/PanelEditor.jsx'
import { useDeskState } from './hooks/useDeskState.js'
import { isEditMode } from './config/panelLayout.js'

// 現場／開發用的 debug flag（正式投影都不帶）：
//   ?all      強制所有家電 active
//   ?fps      左下角顯示幀率 / 最長幀 / 掉幀數
//   ?noglass  面板換成不透明底板（毛玻璃掉幀時的逃生開關）
//   ?edit     面板版面編輯器（暫時性工具，見 components/PanelEditor.jsx）
const flag = (name) =>
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has(name)

export default function App() {
  const { activeIds } = useDeskState()
  const noGlass = flag('noglass')
  const edit = isEditMode()
  const [layout, setLayout] = useState(() => (edit ? buildInitialLayout() : null))

  useEffect(() => {
    document.documentElement.classList.toggle('noglass', noGlass)
    document.documentElement.classList.toggle('edit-mode', edit)
  }, [noGlass, edit])

  return (
    <div className="wall-stage">
      <WallScene activeIds={activeIds} editLayout={edit ? layout : undefined} />
      {edit && <PanelEditor layout={layout} setLayout={setLayout} />}
      {flag('fps') && <FpsMeter />}
    </div>
  )
}
