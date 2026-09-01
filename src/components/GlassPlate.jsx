// 毛玻璃底板。狀態面板與圖表面板共用。
//
// 為什麼是 foreignObject：backdrop-filter 是 CSS box 屬性，對 SVG <rect> 完全無效。
// 樣式在 styles.css 的 .panel-glass。實測 foreignObject 內 1 CSS px = 1 viewBox 單位，
// 所以 blur / 圓角 / 陰影都會跟著投影自動縮放。
//
// ⚠ foreignObject 會裁切內容，所以框比面板大 PAD*2、內層再 padding 推回去，
//    不然外陰影會被切掉。pointer-events: none 避免蓋住底下的 SVG。
export const PLATE_PAD = 40

export default function GlassPlate({ x, y, w, h }) {
  return (
    <foreignObject
      x={x - PLATE_PAD}
      y={y - PLATE_PAD}
      width={w + PLATE_PAD * 2}
      height={h + PLATE_PAD * 2}
      style={{ pointerEvents: 'none' }}
    >
      <div style={{ width: '100%', height: '100%', padding: PLATE_PAD, boxSizing: 'border-box' }}>
        <div className="panel-glass" />
      </div>
    </foreignObject>
  )
}

// 中文全形約佔 1 個字級寬，半形數字/英文約 0.55 —— 跟 fitLabelSize 用同一組係數。
// SVG 沒有便宜的量測 API，用這個估寬度來決定資料列要並排還是換行。
export const estWidth = (str, size) =>
  [...String(str)].reduce((n, ch) => n + (/[\x00-\x7F]/.test(ch) ? 0.55 : 1), 0) * size
