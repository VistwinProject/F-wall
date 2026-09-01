import { motion } from 'framer-motion'
import { COLORS, FONT, MOTION } from '../config/theme.js'
import GlassPlate from './GlassPlate.jsx'
import MiniBars from './MiniBars.jsx'

// ============================================================================
// 圖表面板 —— 掛在某台家電旁邊的附屬面板（插座用電、除濕機集水、冷氣耗電）
//
// 跟狀態面板共用同一塊毛玻璃底板；差別是內容是長條圖而不是資料列。
// 出現時機跟著 spec.of 指定的那台家電走：卡片放上去兩塊一起出現、拿走一起消失。
//
// ⚠ 資料是假的（config/panels.js 的 data），之後接 Welltek API 再換掉。
// ============================================================================

const PADX = 10

export default function ChartPanel({ spec }) {
  const { x, y, w, h, title, unit, data, labels, hi } = spec
  const innerW = w - PADX * 2

  // 矮面板（如 255x60 那條）放不下「標題在上、圖在下」，改成標題靠左、圖靠右並排
  const inline = h < 80
  const titleW = inline ? Math.min(64, innerW * 0.34) : innerW
  const chartX = x + PADX + (inline ? titleW + 6 : 0)
  const chartW = innerW - (inline ? titleW + 6 : 0)
  const chartY = inline ? y + 12 : y + 30
  const chartH = (inline ? h - 20 : h - 44) - (labels ? 9 : 0)

  const n = data.length
  const slot = chartW / n

  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: MOTION.dur, ease: MOTION.ease }}
    >
      <GlassPlate x={x} y={y} w={w} h={h} />

      <text
        x={x + PADX}
        y={y + (inline ? h / 2 - 1 : 16)}
        fontSize="9"
        fill={COLORS.text}
        style={{ fontFamily: FONT, letterSpacing: '0.5px' }}
      >
        {title}
      </text>
      {unit && (
        <text
          x={x + PADX}
          y={y + (inline ? h / 2 + 9 : 26)}
          fontSize="6.25"
          fill={COLORS.textOnGlass}
          style={{ fontFamily: FONT }}
        >
          {unit}
        </text>
      )}

      <MiniBars x={chartX} y={chartY} w={chartW} h={chartH} data={data} hi={hi} />

      {/* 橫軸標籤（矮面板不畫，放不下） */}
      {labels &&
        !inline &&
        labels.map((l, i) => (
          <text
            key={i}
            x={chartX + i * slot + slot / 2}
            y={chartY + chartH + 8}
            textAnchor="middle"
            fontSize="5.5"
            fill={COLORS.text3}
            style={{ fontFamily: FONT }}
          >
            {l}
          </text>
        ))}
    </motion.g>
  )
}
