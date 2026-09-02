import { AnimatePresence } from 'framer-motion'
import { APPLIANCES, VIEWBOX, RESERVED_SCREEN } from '../config/appliances.js'
import { customNode, isCustom } from '../config/panelLayout.js'
import { CUSTOM_PANELS } from '../config/panels.js'
import ChartPanel from './ChartPanel.jsx'
import { COLORS } from '../config/theme.js'
import { ApplianceBlock, AppliancePanel } from './ApplianceNode.jsx'
import Hub from './Hub.jsx'
import { LINE_W_IDLE } from '../config/fx.js'

const hasFlag = (name) =>
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has(name)

// ============================================================================
// 牆面場景根節點。
//
// ⚠ 這裡有三個「不是樣式、是物理」的東西，改了牆上的實體展品就對不上位置：
//   1. viewBox 0 0 1920 1080 —— 座標系本身。
//   2. preserveAspectRatio="xMidYMid meet" + width/height 100% —— 換成 slice
//      或加上任何 padding / header，九個黑框會整體位移。
//   3. 黑框與電視預留區的 fill="#000" —— 投影機的黑 = 不出光，實體展品才不會被打亮。
//      這不是配色選擇，不要因為「純黑太重」而改成深灰。
// ============================================================================
export default function WallScene({ activeIds, editLayout }) {
  // ?all 除錯用：強制所有家電 active（驗證面板/連線排版不打架），正式不會帶這參數。
  // portable/測試-全部亮.bat 靠這個參數，不要拿掉。
  const showAll = hasFlag('all')
  const isActive = (id) => showAll || activeIds.has(id)
  return (
    <svg
      viewBox={`0 0 ${VIEWBOX.w} ${VIEWBOX.h}`}
      preserveAspectRatio="xMidYMid meet"
      width="100%"
      height="100%"
    >

      <ReservedScreen />

      {/* ⚠ 分層是功能性的，不是排版偏好：所有「光」都在底下那張 WebGL canvas 上
          （框架格線、家電框外圈、走線光束、彗星、微粒 + bloom），這裡只畫「擋光的」
          與「要銳利的」。bloom 一定會往黑塊裡面溢，靠這些 fill="#000" 蓋掉 ——
          投影機的黑 = 不出光，牆上的實體展品才不會被打亮。 */}
      {APPLIANCES.map((node) => (
        <ApplianceBlock key={`b-${node.id}`} node={node} active={isActive(node.id)} />
      ))}

      <Hub activeCount={showAll ? APPLIANCES.length : activeIds.size} />

      {/* 面板層。用 AnimatePresence 掛載／卸載，拿走卡片時才有淡出 ——
          舊版是元件自己 return null，會瞬間消失。

          editLayout 只有 ?edit 會傳進來：那時全部面板一律顯示、位置吃編輯器的值。
          正式投影 editLayout 是 undefined，走的還是 panelBox() 的自動版面。 */}
      <AnimatePresence>
        {editLayout
          ? Object.entries(editLayout).map(([id, box]) => {
              const node = isCustom(id)
                ? customNode(id, box.label)
                : APPLIANCES.find((a) => a.id === id)
              if (!node) return null
              return <AppliancePanel key={`p-${id}`} node={node} box={box} />
            })
          : [
              ...APPLIANCES.filter((node) => isActive(node.id) && node.status).map((node) => (
                <AppliancePanel key={`p-${node.id}`} node={node} />
              )),
              // 附屬圖表面板：跟著 spec.of 那台家電一起出現／消失
              ...CUSTOM_PANELS.filter((c) => isActive(c.of)).map((c) => (
                <ChartPanel key={`c-${c.id}`} spec={c} />
              )),
            ]}
      </AnimatePresence>
    </svg>
  )
}

// 實體電視預留位：純黑矩形挖空（之後實機螢幕就裝在這），一條細線點出邊界。
// 與家電框同一階(lineStrong)，因為它也是實體展品的預留位。
function ReservedScreen() {
  const { x, y, w, h } = RESERVED_SCREEN
  return (
    <rect
      x={x - w / 2}
      y={y - h / 2}
      width={w}
      height={h}
      fill="#000"
      stroke={COLORS.lineStrong}
      strokeWidth={LINE_W_IDLE}
    />
  )
}
