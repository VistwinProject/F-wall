import { motion } from 'framer-motion'
import { APPLIANCES, COLORS, VIEWBOX } from '../config/appliances.js'
import { getRoute, chamferPath } from '../config/routing.js'

// 動畫節奏對齊桌面 SYNC-SPEC §8（2026-05-31 調校）
const SWEEP_DUR = 2.2 // 慧星週期（資料回流大腦）
const COMET_OFFSETS = [0, 1 / 3, 2 / 3] // 3 段錯開 1/3 週期
const SWEEP_SEG = 0.16 // 光段長度（佔整條路徑比例，pathLength=1）≈ 桌面 30% 線長的短段感
const HALO_DUR = 1.4 // halo 呼吸週期
const POWERUP = 0.45 // idle→active 充能轉場（§8）

export default function ApplianceNode({ node, active }) {
  const { pts, pin } = getRoute(node.id)
  const path = chamferPath(pts)
  const pathId = `beam-${node.id}`
  const hw = node.w / 2
  const hh = node.h / 2

  return (
    <g>
      {/* 連接線本體：idle 安靜細線（無流動）、active 粗霓虹光束（外暈 + 亮芯） */}
      {/* active 外暈：兩層遞減描邊做柔邊 falloff，取代 feGaussianBlur。
          原本是「11px 描邊 + 高斯模糊」，但寬描邊本身就是光暈形狀，再疊真模糊是重複的，
          而這類長走線的 bbox 很大，是整個場景最貴的模糊來源（佔 43%）。
          改成 18px@0.18 + 11px@0.5 兩層純描邊：投影距離下觀感幾乎相同，成本趨近於零。 */}
      {active && (
        <>
          <path
            d={path}
            fill="none"
            stroke={COLORS.active}
            strokeWidth="18"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.18"
          />
          <path
            d={path}
            fill="none"
            stroke={COLORS.active}
            strokeWidth="11"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.5"
          />
        </>
      )}
      {/* 線芯 */}
      <path
        id={pathId}
        d={path}
        fill="none"
        stroke={active ? COLORS.active : COLORS.idle}
        strokeWidth={active ? 3.5 : 2}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={active ? 1 : 0.45}
        filter={active ? 'url(#glowTrace)' : undefined}
        style={{ transition: `stroke ${POWERUP}s ease-out, stroke-width ${POWERUP}s ease-out, opacity ${POWERUP}s ease-out` }}
      />

      {/* 中樞接腳焊點(pad)：電路板插腳感 */}
      <circle
        cx={pin.x}
        cy={pin.y}
        r={active ? 5 : 3}
        fill={active ? COLORS.active : COLORS.idle}
        opacity={active ? 1 : 0.35}
        filter={active ? 'url(#glowDot)' : undefined}
        style={{ transition: `r ${POWERUP}s ease-out, opacity ${POWERUP}s ease-out` }}
      />

      {/* active：短霓虹光段沿線 節點 → 中樞（§8 資料回流，dash-sweep；
          與桌面一致——不是圓點，是一段段亮光在 path 上流動）。
          pathLength=1 把路徑正規化，dash 長度/位移就能用 0..1 比例表示，
          不必知道折線實際像素長度。 */}
      {active &&
        COMET_OFFSETS.map((offset, i) => (
          <g key={i}>
            {/* 外暈：寬描邊即光暈，不再套 feGaussianBlur。
                這層一條就是一整條走線的 bbox，而且 3 段彗星 × 9 條 = 27 個，
                每幀都在動（dashoffset）所以模糊結果無法快取，是最貴的一類。 */}
            <path d={path} pathLength="1"
              fill="none"
              stroke={COLORS.active}
              strokeWidth="9"
              strokeLinecap="round"
              opacity="0.8"
              strokeDasharray={`${SWEEP_SEG} ${1 - SWEEP_SEG}`}>
              <animate attributeName="stroke-dashoffset"
                from={1 - offset} to={-offset}
                dur={`${SWEEP_DUR}s`} repeatCount="indefinite" />
            </path>
            {/* 內核：細亮白光段 */}
            <path d={path} pathLength="1"
              fill="none"
              stroke={COLORS.highlight}
              strokeWidth="3"
              strokeLinecap="round"
              filter="url(#glowTrace)"
              strokeDasharray={`${SWEEP_SEG} ${1 - SWEEP_SEG}`}>
              <animate attributeName="stroke-dashoffset"
                from={1 - offset} to={-offset}
                dur={`${SWEEP_DUR}s`} repeatCount="indefinite" />
            </path>
          </g>
        ))}

      {/* active：節點外圈 halo 呼吸 1.4s */}
      {active && (
        <motion.rect
          x={node.x - hw - 9}
          y={node.y - hh - 9}
          width={node.w + 18}
          height={node.h + 18}
          rx="11"
          fill="none"
          stroke={COLORS.accent2}
          strokeWidth="2"
          filter="url(#glow)"
          animate={{ opacity: [0.15, 0.5, 0.15], scale: [1, 1.04, 1] }}
          transition={{ duration: HALO_DUR, repeat: Infinity, ease: 'easeInOut' }}
          style={{ transformOrigin: `${node.x}px ${node.y}px` }}
        />
      )}

      {/* 黑色矩形 = 實體立方體模型的投影挖空區。active 時邊框在每個週期起點爆閃 */}
      <motion.rect
        x={node.x - hw}
        y={node.y - hh}
        width={node.w}
        height={node.h}
        rx="6"
        fill="#000"
        stroke={active ? COLORS.active : COLORS.idle}
        filter={active ? 'url(#glow)' : undefined}
        animate={
          active
            ? { strokeWidth: [4, 6.5, 4], strokeOpacity: [1, 1, 0.85] }
            : { strokeWidth: 1.5, strokeOpacity: 0.4 }
        }
        transition={
          active
            ? { duration: SWEEP_DUR, repeat: Infinity, ease: 'easeOut', times: [0, 0.2, 1] }
            : { duration: 0.3 }
        }
      />

      {/* active：彈出設備運作狀態面板（底特律：變人 風格 HUD readout） */}
      {active && node.status && <StatusPanel node={node} />}
    </g>
  )
}

// ============================================================================
// StatusPanel — active 時在家電旁彈出的狀態讀數面板。
// 風格參考《底特律：變人》：極簡、左側縱向強調條、英數用等寬字、大寫追蹤字距、
// 細角刻、由設備拉一條細引線到面板、開場像掃描般展開。
// 版面：左(L)往左開 / 右(R)往右開 / 下(B)往下開（永遠朝「外側」，不跟連線打架）。
// ============================================================================
const PW = 220 // 面板寬
const PH = 116 // 面板高

// 標題字級自動縮放：家電名稱長度不一（「燈」1 字 ～「12合一感測器」7 字），
// 固定 25px 會超出面板寬。半形字（數字 / 英文）約佔全形的 0.55 寬。
// 名稱短時維持設計值 25px，只有真的塞不下才縮。
function fitLabelSize(label, maxW, base = 25, letterSpacing = 2) {
  const units = [...label].reduce((n, ch) => n + (/[\x00-\x7F]/.test(ch) ? 0.55 : 1), 0)
  if (!units) return base
  const fit = (maxW - letterSpacing * label.length) / units
  return Math.min(base, Math.floor(fit * 10) / 10)
}
const GAP = 22 // 面板離家電框的間隙
const DODGE_MG = 8 // 避讓時與鄰框留的安全間距

// 面板往上／往下開時預設以家電框中心對齊，但可能壓到別人的框
// （例如下排的「燈」往上開會撞到中排的「除濕機」）。
// 這裡把面板水平推開最小的距離，讓它閃過所有相交的框，並保持在畫布內。
// 家電位置改了會自動重算，不用手動填偏移量。
function avoidX(node, left, top, bottom) {
  const clash = APPLIANCES.filter((o) => {
    if (o.id === node.id) return false
    const ol = o.x - o.w / 2, or = o.x + o.w / 2
    const ot = o.y - o.h / 2, ob = o.y + o.h / 2
    if (ob <= top || ot >= bottom) return false          // 垂直不相交 → 無關
    return !(or <= left || ol >= left + PW)              // 水平相交才要避
  })
  if (!clash.length) return left

  // 候選：推到每個相交框的右側 / 左側，取「位移最小且不再相交」的一個
  const cands = [left]
  for (const o of clash) {
    cands.push(o.x + o.w / 2 + DODGE_MG)                 // 貼到該框右邊
    cands.push(o.x - o.w / 2 - DODGE_MG - PW)            // 貼到該框左邊
  }
  const ok = cands.filter((cx) => {
    if (cx < 0 || cx + PW > VIEWBOX.w) return false
    return !APPLIANCES.some((o) => {
      if (o.id === node.id) return false
      const ol = o.x - o.w / 2, or = o.x + o.w / 2
      const ot = o.y - o.h / 2, ob = o.y + o.h / 2
      if (ob <= top || ot >= bottom) return false
      return !(or <= cx || ol >= cx + PW)
    })
  })
  if (!ok.length) return left                            // 無解就維持原位（由驗證腳本抓出來）
  return ok.sort((a, b) => Math.abs(a - left) - Math.abs(b - left))[0]
}
const TONE = { ok: COLORS.accent2, warn: COLORS.warn, err: COLORS.err }

function StatusPanel({ node }) {
  const { status, panelDir = 'B' } = node
  const tone = TONE[status.tone] ?? COLORS.accent2
  const bl = node.x - node.w / 2
  const br = node.x + node.w / 2
  const bt = node.y - node.h / 2
  const bb = node.y + node.h / 2

  // 面板左上角 (px,py) + 引線（從家電框邊到面板邊）+ 進場位移方向
  let px, py, from, to, fromOffset
  if (panelDir === 'L') {
    px = bl - GAP - PW
    py = node.y - PH / 2
    from = [bl, node.y]
    to = [px + PW, py + PH / 2]
    fromOffset = { x: 24, y: 0 }
  } else if (panelDir === 'R') {
    px = br + GAP
    py = node.y - PH / 2
    from = [br, node.y]
    to = [px, py + PH / 2]
    fromOffset = { x: -24, y: 0 }
  } else if (panelDir === 'T') {
    py = bt - GAP - PH
    px = avoidX(node, node.x - PW / 2, py, py + PH)
    from = [node.x, bt]
    to = [Math.max(px + 20, Math.min(node.x, px + PW - 20)), py + PH]
    fromOffset = { x: 0, y: 24 }
  } else {
    py = bb + GAP
    px = avoidX(node, node.x - PW / 2, py, py + PH)
    from = [node.x, bb]
    to = [Math.max(px + 20, Math.min(node.x, px + PW - 20)), py]
    fromOffset = { x: 0, y: -24 }
  }

  const labelFont = "'Chiron Hei HK', sans-serif"
  const monoFont = "'JetBrains Mono', 'Chiron Hei HK', monospace"
  const tick = 14 // 角刻長度

  return (
    <g>
      {/* 引線：設備 → 面板，端點各一個小焊點 */}
      <line x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} stroke={tone} strokeWidth="1.5" opacity="0.7" />
      <circle cx={from[0]} cy={from[1]} r="3" fill={tone} />

      <motion.g
        initial={{ opacity: 0, x: fromOffset.x, y: fromOffset.y }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
      >
        {/* 底板 —— 0.95 而非半透明：下排的面板往上開，會疊在往中樞的走線上
            （框上方那條帶正是下排五條線匯聚的走廊，避不開，見 avoidX 註解）。
            接近不透明才會讀成「面板疊在電路前面」，而不是亮青色透出來糊成一團。
            背景本身接近純黑，所以沒有走線的地方看不出差別。 */}
        {/* 底板：換 navy 底後，面板與背景的明度對比只有 1.15:1（把底色壓到近黑也只到 1.32:1，
            因為背景本身就是深藍）——所以邊界靠「描邊」定義，不是靠加深。
            文字對比本來就夠：資料列鍵 5.1:1、值 15:1、標題 16:1。 */}
        <rect x={px} y={py} width={PW} height={PH} fill="#020c2e" opacity="0.95"
          stroke={COLORS.accent} strokeWidth="1" strokeOpacity="0.5" />
        {/* 左側縱向強調條 */}
        <rect x={px} y={py} width="3" height={PH} fill={tone} filter="url(#glowDot)" />
        {/* 角刻（右上 + 左下）*/}
        <g stroke={tone} strokeWidth="2" opacity="0.85">
          <line x1={px + PW} y1={py} x2={px + PW - tick} y2={py} />
          <line x1={px + PW} y1={py} x2={px + PW} y2={py + tick} />
          <line x1={px} y1={py + PH} x2={px + tick} y2={py + PH} />
          <line x1={px} y1={py + PH} x2={px} y2={py + PH - tick} />
        </g>

        {/* 標題：設備名（中文）獨占一行，用滿面板寬 —— 名稱最長 7 字（12合一感測器） */}
        <text x={px + 16} y={py + 31} fontSize={fitLabelSize(node.label, PW - 32)} fill={COLORS.highlight}
          style={{ fontFamily: labelFont, letterSpacing: '2px' }}>
          {node.label}
        </text>

        {/* 設備代碼（左）+ 狀態點與狀態字（右）同一行 */}
        <text x={px + 16} y={py + 50} fontSize="12.5" fill={COLORS.accent2} opacity="0.75"
          style={{ fontFamily: monoFont, letterSpacing: '2px' }}>
          {status.code}
        </text>
        <circle cx={px + PW - 18} cy={py + 46} r="4.5" fill={tone} filter="url(#glowDot)">
          <animate attributeName="opacity" values="1;0.4;1" dur="1.4s" repeatCount="indefinite" />
        </circle>
        <text x={px + PW - 30} y={py + 51} textAnchor="end" fontSize="13" fill={tone}
          style={{ fontFamily: monoFont, letterSpacing: '1px' }}>
          {status.state}
        </text>

        {/* 分隔線 */}
        <line x1={px + 16} y1={py + 60} x2={px + PW - 12} y2={py + 60} stroke={COLORS.accent} opacity="0.3" />

        {/* 資料列：左標籤(中文) 右數值(等寬) */}
        {status.rows.map(([k, v], i) => {
          const ry = py + 84 + i * 24
          return (
            <g key={i}>
              <text x={px + 16} y={ry} fontSize="15" fill={COLORS.labelIdle}
                style={{ fontFamily: labelFont, letterSpacing: '1px' }}>
                {k}
              </text>
              <text x={px + PW - 14} y={ry} textAnchor="end" fontSize="16" fill={COLORS.labelActive}
                style={{ fontFamily: monoFont }}>
                {v}
              </text>
            </g>
          )
        })}
      </motion.g>
    </g>
  )
}
