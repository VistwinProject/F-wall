import { AnimatePresence } from 'framer-motion'
import { APPLIANCES, VIEWBOX } from '../config/appliances.js'
import {
  blockOf, isCustom, panelBoxOf, withBlock,
  CHART_PREFIX, SCREEN_ID, getTuning,
} from '../config/wallTuning.js'
import { CUSTOM_PANELS } from '../config/panels.js'
import ChartPanel from './ChartPanel.jsx'
import { COLORS } from '../config/theme.js'
import { ApplianceBlock, AppliancePanel } from './ApplianceNode.jsx'
import Hub from './Hub.jsx'
import { FX, LINE_W_IDLE } from '../config/fx.js'

const hasFlag = (name) =>
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has(name)

// 自訂面板要能餵進 StatusPanel，得長得像一個 node。
// w/h 給 0 代表「沒有實體家電框」→ StatusPanel 就不會畫引線。
function customNode(id, label) {
  return {
    id,
    label: label || '自訂面板',
    x: 0, y: 0, w: 0, h: 0,
    status: {
      code: id.toUpperCase(),
      state: '—',
      tone: 'ok',
      rows: [['項目一', '000'], ['項目二', '000']],
    },
  }
}

// ============================================================================
// 牆面場景根節點。
//
// ⚠ 這裡有三個「不是樣式、是物理」的東西，改了牆上的實體展品就對不上位置：
//   1. viewBox 0 0 1920 1080 —— 座標系本身。
//   2. preserveAspectRatio="xMidYMid meet" + width/height 100% —— 換成 slice
//      或加上任何 padding / header，九個黑框會整體位移。
//   3. 黑框與電視預留區的 fill="#000" —— 投影機的黑 = 不出光，實體展品才不會被打亮。
//      這不是配色選擇，不要因為「純黑太重」而改成深灰。
//
// ⚠ 所有幾何都從 config/wallTuning.js 讀，不直接用 appliances.js / panels.js 的常數
//   —— 編輯模式（鍵盤 e）要能即時改。沒有覆寫時讀到的就是那兩個檔的原值。
// ============================================================================
export default function WallScene({ activeIds, edit = false }) {
  // ?all 除錯用：強制所有家電 active（驗證面板/連線排版不打架），正式不會帶這參數。
  // portable/測試-全部亮.bat 靠這個參數，不要拿掉。
  const showAll = hasFlag('all')
  // 編輯模式一律全部顯示 —— 要排版就得看得到全部，不能等刷卡。
  const isActive = (id) => edit || showAll || activeIds.has(id)

  const panels = getTuning().panels
  const customIds = Object.keys(panels).filter(isCustom)

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
        <ApplianceBlock key={`b-${node.id}`} node={withBlock(node)} active={isActive(node.id)} />
      ))}

      <Hub activeCount={showAll || edit ? APPLIANCES.length : activeIds.size} />

      {/* 面板層。用 AnimatePresence 掛載／卸載，拿走卡片時才有淡出 ——
          舊版是元件自己 return null，會瞬間消失。 */}
      {/* ⚠ 一塊面板「存在不存在」以 wallTuning.panels 有沒有那一筆為準，不是以
          APPLIANCES / CUSTOM_PANELS 有沒有那一台為準 —— 編輯模式的「刪除」就是
          把那一筆拿掉。少了這個判斷，刪掉之後面板照樣畫得出來（panelBox 會退回
          自動版面），看起來是「刪不掉，還自己跳位置」（實際踩過）。
          codeTuning() 會把九台與三塊圖表全部登記進去，所以「查無此筆」只會是
          被刪掉，不會是漏登記。 */}
      <AnimatePresence>
        {APPLIANCES.filter((node) => isActive(node.id) && node.status && panelBoxOf(node.id)).map((node) => (
          <AppliancePanel key={`p-${node.id}`} node={withBlock(node)} />
        ))}

        {/* 附屬圖表面板：跟著 spec.of 那台家電一起出現／消失 */}
        {CUSTOM_PANELS.filter((c) => isActive(c.of) && panelBoxOf(CHART_PREFIX + c.id)).map((c) => (
          <ChartPanel key={`c-${c.id}`} spec={{ ...c, ...panelBoxOf(CHART_PREFIX + c.id) }} />
        ))}

        {/* 編輯模式加出來的自訂面板。⚠ 它們沒有對應的家電，所以【一直顯示】——
            這是刻意的：不顯示的話「新增面板」等於什麼都沒發生。
            匯出的文字會提醒它們需要一個真正的歸屬。 */}
        {customIds.map((id) => (
          <AppliancePanel key={`p-${id}`} node={customNode(id, panels[id].label)} box={panels[id]} />
        ))}
      </AnimatePresence>
    </svg>
  )
}

// 實體電視預留位：純黑矩形挖空（之後實機螢幕就裝在這），一條細線點出邊界。
// 與家電框同一階(lineStrong)，因為它也是實體展品的預留位。
function ReservedScreen() {
  const { x, y, w, h } = blockOf(SCREEN_ID)
  return (
    <rect
      x={x - w / 2}
      y={y - h / 2}
      width={w}
      height={h}
      fill="#000"
      // 與十一個黑塊同一個開關：關掉之後只剩純黑，沒有任何輪廓。
      stroke={FX.svgBlockStroke ? COLORS.lineStrong : 'none'}
      strokeWidth={LINE_W_IDLE}
    />
  )
}
