import WallScene from './components/WallScene.jsx'
import { useDeskState } from './hooks/useDeskState.js'

export default function App() {
  const { activeIds } = useDeskState()

  return (
    <div className="wall-stage">
      <WallScene activeIds={activeIds} />
    </div>
  )
}
