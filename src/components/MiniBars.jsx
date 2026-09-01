import { COLORS } from '../config/theme.js'

// 小長條圖。狀態面板下方的留白與獨立的圖表面板共用同一支。
// 最後一根（今天）用高光，其餘退到次一階 —— 不用顏色區分。
export default function MiniBars({ x, y, w, h, data, hi }) {
  const max = Math.max(...data) || 1
  const min = Math.min(...data)
  // 全部數值都很接近時（例如濕度 57~63），從 0 起算會變成一排等高柱，
  // 看不出趨勢。基準線改抓比最小值再低一點，落差才讀得出來。
  const base = min > 0 && min / max > 0.6 ? min * 0.9 : 0
  const n = data.length
  const slot = w / n
  const bw = Math.max(1.5, slot * 0.6)
  return (
    <g>
      <line x1={x} y1={y + h} x2={x + w} y2={y + h} stroke={COLORS.line} strokeWidth="0.8" />
      {data.map((v, i) => {
        const bh = Math.max(1, ((v - base) / (max - base || 1)) * h)
        const on = hi === undefined ? i === n - 1 : i === hi
        return (
          <rect
            key={i}
            x={x + i * slot + (slot - bw) / 2}
            y={y + h - bh}
            width={bw}
            height={bh}
            fill={on ? COLORS.text : COLORS.textOnGlass}
            rx={Math.min(1.5, bw / 3)}
          />
        )
      })}
    </g>
  )
}
