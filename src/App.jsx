import { useEffect } from 'react'
import WallScene from './components/WallScene.jsx'
import FpsMeter from './components/FpsMeter.jsx'
import { useDeskState } from './hooks/useDeskState.js'

// 現場用的 debug flag（與 WallScene 的 ?all 同一套慣例，正式投影都不帶）：
//   ?fps      左下角顯示幀率 / 最長幀 / 掉幀數
//   ?noglass  面板換成不透明底板（毛玻璃掉幀時的逃生開關）
//   併用：?all&fps 就是「九個面板全開」的最壞情況量測
const flag = (name) =>
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has(name)

export default function App() {
  const { activeIds } = useDeskState()
  const noGlass = flag('noglass')

  // ?noglass 掛在 <html> 上，讓 CSS 一條規則就能整批降級（見 styles.css）
  useEffect(() => {
    document.documentElement.classList.toggle('noglass', noGlass)
  }, [noGlass])

  return (
    <div className="wall-stage">
      <WallScene activeIds={activeIds} />
      {flag('fps') && <FpsMeter />}
    </div>
  )
}
