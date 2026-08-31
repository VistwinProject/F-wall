import { motion } from 'framer-motion'
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
        {/* ── 發光 filter：依元素尺寸分三種 ───────────────────────────────────
            filter 區域是按元素 bbox 的百分比算的，所以單一百分比沒辦法同時服務
            「549×304 的長走線」與「9×9 的小光點」——前者會超額浪費十幾倍的模糊面積，
            後者則會被裁掉光暈。σ=5 的模糊約需 3σ=15 使用者單位的餘裕，據此分三檔： */}

        {/* 中大型元素（框外 halo、中樞環、黑框）：160% 對 180+ 尺寸已有 50+ 餘裕 */}
        <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* 長走線（細長、bbox 大）：收到 120%。近水平的走線 bbox 只有 5 單位高，
            垂直方向的光暈會被裁——但走線本身還有未套 filter 的寬描邊當柔邊，看不出來。 */}
        <filter id="glowTrace" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* 小光點（pad、狀態點、面板強調條，3～10 單位）：百分比要放很大才夠 15 單位，
            但絕對面積仍極小（10×10 → 70×70 ≈ 5k px²），不影響效能。 */}
        <filter id="glowDot" x="-300%" y="-300%" width="700%" height="700%">
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

      {/* 背景光帶：無卡片(attract)時開到影片強度，有卡片時把亮度讓給節點與面板。
          ?all 也算 live —— 那個模式就是要驗證內容排版。 */}
      <LightRibbons live={showAll || activeIds.size > 0} />

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

// ANLB 招牌光帶 —— 對齊 /style 的 Banner / Poster / 影片：
// 深藍底上幾道大跨度的柔光弧線交會，亮處近白、邊緣化開。
//
// 每層 [描邊全寬, 色票, attract 不透明度, live 不透明度]。
//
// 為什麼每層要「各自的顏色」而不是共用一個漸層：把 /style 的影片抽幀量過光束的橫剖面，
// 顏色是沿半徑在位移的，不是同一色調的不同透明度——
//   半徑 0(芯) #c0ffe1 亮度 224 → ±8 #0083fc 128 → ±15 #0168f5 117
//   → ±31 #003598 68 → ±62 #011d63 43 → ±124 #001858 37（已換算成 1920 尺度）
// 亮芯青白、芯外 8 單位就跳成高飽和純藍、尾端沉成暗藍：這是 additive bloom 的指紋。
// 共用單一漸層做不出來，所以每層帶自己的 beam 色票（見 appliances.js 的光束階）。
// alpha 是「由外而內 src-over 疊完剛好落在實測亮度」反解出來的，殘差 ≤12/255。
// 亮芯用 highlight 而非影片實測的 #c0ffe1：影片那個綠偏是高光把 G 通道打爆的 codec
// 假色（三個取樣點都 G>B，而 G 早已 clip，色序不可信），照抄會把綠帶進品牌色票。
//
// 刻意「不使用 feGaussianBlur」：柔邊靠疊層描邊。這類光帶 bbox 幾乎是整個畫布，
// 若套模糊會是最貴的一類元素，會把先前壓到 3.2× 畫布的優化整個吃掉。疊層是純填色。
//
// attract / live 兩組值：參考圖裡光帶是主角（背景全空），而這個畫面有 9 個節點 + 走線
// + 狀態面板。但牆面在感應到卡片前本來就沒有內容——那正是空舞台。所以不是取折衷值，
// 而是分級：attract 開到影片強度（芯 227，對上實測 224），live 把亮芯幾乎全收
// （峰值 77，比改版前的 152 還暗 75 級），亮度讓給節點。
const RIBBON_LAYERS = [
  [248, 'beamTail', 0.30, 0.15],
  [124, 'beamFar', 0.38, 0.19],
  [62, 'beamMid', 0.45, 0.20],
  [30, 'beamHot', 0.55, 0.14],
  [16, 'beamHot', 0.65, 0.07],
  [10, 'highlight', 0.85, 0.03],
]

// 三道弧線的控制點（viewBox 1920×1080）。走勢對齊 Poster：
// 兩道從左下往右上的長弧交會於右上，另一道平緩橫弧從左往右。
// 走勢對齊 Poster 的交會弧，但刻意壓在「外圍」——避開中央 9 節點與走線密集區，
// 交會點放在左下與右上的畫布外，只讓弧身掠過角落。
//
// from/to 是「沿光帶長度」的漸層向量端點（userSpaceOnUse）。沒有這個漸層的話
// 光帶是單色平塗、到畫布邊緣被硬切，看起來像抹髒的斜線——兩端要淡出才對得上參考圖。
// 兩道長弧在「左上開闊區」交會（對齊 Poster 的 Λ 交會母題，但避開正中的電視預留區），
// 第三道低伏長弧橫掠下緣。弧身穿過內容時會被面板 / 黑框乾淨遮住，反而做出前後層次。
const RIBBONS = [
  // 左下 → 右上長弧（斜穿整個畫面，交會點落在左上開闊處）
  { id: 'rib1', d: 'M -240 1220 C 260 820, 520 300, 1080 -200', from: [-240, 1220], to: [1080, -200] },
  // 左上 → 右下淺弧（與上一道在左上交會後往右下散開）
  { id: 'rib2', d: 'M -240 240 C 420 460, 1180 620, 2160 640', from: [-240, 240], to: [2160, 640] },
  // 下緣低伏長弧（貼著畫面下方往右上收）
  { id: 'rib3', d: 'M -260 1060 C 520 1120, 1420 1000, 2180 700', from: [-260, 1060], to: [2180, 700] },
]

// 沿長度的淡出包絡（只管不透明度，顏色由分層決定）：
// 兩端全透明避免被畫布邊緣硬切，中段偏前方最亮。
const RIBBON_ENVELOPE = [
  [0, 0],
  [0.14, 0.45],
  [0.4, 1],
  [0.58, 0.8],
  [0.82, 0.3],
  [1, 0],
]

function LightRibbons({ live }) {
  return (
    <>
      <defs>
        {/* 每（光帶 × 分層）一個漸層：漸層只負責沿長度的淡出包絡，顏色來自該層自己的
            色票——這才做得出橫剖面的色相位移。18 個都是靜態 def，沒有離屏緩衝，
            每幀成本仍然只是純填色。 */}
        {RIBBONS.flatMap((r) =>
          RIBBON_LAYERS.map(([, token], j) => (
            <linearGradient
              key={`${r.id}-${j}`}
              id={`${r.id}-${j}`}
              gradientUnits="userSpaceOnUse"
              x1={r.from[0]} y1={r.from[1]} x2={r.to[0]} y2={r.to[1]}
            >
              {RIBBON_ENVELOPE.map(([off, op], k) => (
                <stop key={k} offset={off} stopColor={COLORS[token]} stopOpacity={op} />
              ))}
            </linearGradient>
          )),
        )}
      </defs>
      <g fill="none" strokeLinecap="round">
        {RIBBONS.map((r, i) => (
          <g key={r.id}>
            {RIBBON_LAYERS.map(([w, , attract, onCard], j) => (
              <motion.path
                key={j}
                d={r.d}
                stroke={`url(#${r.id}-${j})`}
                strokeWidth={w}
                initial={false}
                animate={{ opacity: (live ? onCard : attract) * (i === 2 ? 0.7 : 1) }}
                /* 收光比放光快：最後一張卡拿走時慢慢亮回來，才不會突然爆亮 */
                transition={{ duration: live ? 0.9 : 1.6, ease: 'easeOut' }}
              />
            ))}
          </g>
        ))}
      </g>
    </>
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
