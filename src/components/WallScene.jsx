import { APPLIANCES, VIEWBOX, COLORS, RESERVED_SCREEN } from '../config/appliances.js'
import ApplianceNode from './ApplianceNode.jsx'
import Hub from './Hub.jsx'

export default function WallScene({ activeIds }) {
  // ?all 除錯用：強制所有家電 active（驗證面板/連線排版不打架），正式不會帶這參數
  const showAll =
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('all')
  return (
    <svg
      viewBox={`0 0 ${VIEWBOX.w} ${VIEWBOX.h}`}
      preserveAspectRatio="xMidYMid meet"
      width="100%"
      height="100%"
    >
      <defs>
        <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="hubAura" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={COLORS.accent} stopOpacity="0.28" />
          <stop offset="55%" stopColor={COLORS.accent} stopOpacity="0.06" />
          <stop offset="100%" stopColor={COLORS.accent} stopOpacity="0" />
        </radialGradient>
      </defs>

      <BackgroundGrid />

      {/* 中樞背後的大範圍柔光，給畫面深度 */}
      <circle cx={VIEWBOX.w / 2} cy={VIEWBOX.h / 2} r="560" fill="url(#hubAura)" />

      <ReservedScreen />

      {APPLIANCES.map((node) => (
        <ApplianceNode key={node.id} node={node} active={showAll || activeIds.has(node.id)} />
      ))}

      <Hub activeCount={activeIds.size} />
    </svg>
  )
}

// 實體電視預留位：純黑矩形挖空（之後實機螢幕就裝在這），細邊框 + 四角刻痕點出邊界。
function ReservedScreen() {
  const { x, y, w, h } = RESERVED_SCREEN
  const x0 = x - w / 2
  const y0 = y - h / 2
  const c = 26 // 角刻長度
  const corners = [
    [x0, y0, 1, 1],
    [x0 + w, y0, -1, 1],
    [x0, y0 + h, 1, -1],
    [x0 + w, y0 + h, -1, -1],
  ]
  return (
    <g>
      <rect x={x0} y={y0} width={w} height={h} fill="#000" stroke={COLORS.idle} strokeWidth="2" opacity="0.9" />
      <g stroke={COLORS.accent2} strokeWidth="3" opacity="0.7">
        {corners.map(([cx, cy, sx, sy], i) => (
          <g key={i}>
            <line x1={cx} y1={cy} x2={cx + sx * c} y2={cy} />
            <line x1={cx} y1={cy} x2={cx} y2={cy + sy * c} />
          </g>
        ))}
      </g>
    </g>
  )
}

// 背景格線 — 呼應參考圖的藍綠科技格，純裝飾
function BackgroundGrid() {
  const lines = []
  for (let x = 0; x <= VIEWBOX.w; x += 120) {
    lines.push(<line key={`v${x}`} x1={x} y1={0} x2={x} y2={VIEWBOX.h} />)
  }
  for (let y = 0; y <= VIEWBOX.h; y += 120) {
    lines.push(<line key={`h${y}`} x1={0} y1={y} x2={VIEWBOX.w} y2={y} />)
  }
  return (
    <g stroke={COLORS.grid} strokeWidth="1" opacity="0.35">
      {lines}
    </g>
  )
}
