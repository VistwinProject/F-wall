import { motion } from 'framer-motion'
import { COLORS } from '../config/appliances.js'
import { getRoute, chamferPath } from '../config/routing.js'

// 動畫節奏對齊桌面 SYNC-SPEC §8
const SWEEP_DUR = 1.0 // 慧星週期（資料回流大腦）
const COMET_OFFSETS = [0, 1 / 3, 2 / 3] // 3 顆錯開 1/3 週期
const HALO_DUR = 1.4 // halo 呼吸週期

export default function ApplianceNode({ node, active }) {
  const { pts, pin } = getRoute(node.id)
  const path = chamferPath(pts)
  const pathId = `beam-${node.id}`
  const hw = node.w / 2
  const hh = node.h / 2

  return (
    <g>
      {/* 連接線本體：idle 安靜細線（無流動）、active 高亮粗線 */}
      <path
        id={pathId}
        d={path}
        fill="none"
        stroke={active ? COLORS.active : COLORS.idle}
        strokeWidth={active ? 3 : 2}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={active ? 0.9 : 0.45}
        filter={active ? 'url(#glow)' : undefined}
        style={{ transition: 'stroke 0.3s, stroke-width 0.3s, opacity 0.3s' }}
      />

      {/* 中樞接腳焊點(pad)：電路板插腳感 */}
      <circle
        cx={pin.x}
        cy={pin.y}
        r={active ? 5 : 3}
        fill={active ? COLORS.active : COLORS.idle}
        opacity={active ? 1 : 0.35}
        filter={active ? 'url(#glow)' : undefined}
        style={{ transition: 'r 0.3s, opacity 0.3s' }}
      />

      {/* active：3 顆慧星沿線 節點 → 中樞（§8 資料回流，週期 1s 錯開 1/3） */}
      {active &&
        COMET_OFFSETS.map((offset, i) => (
          <circle key={i} r="7" fill={COLORS.highlight} filter="url(#glow)">
            <animateMotion
              dur={`${SWEEP_DUR}s`}
              begin={`${-offset * SWEEP_DUR}s`}
              repeatCount="indefinite"
            >
              <mpath href={`#${pathId}`} />
            </animateMotion>
            <animate
              attributeName="opacity"
              dur={`${SWEEP_DUR}s`}
              begin={`${-offset * SWEEP_DUR}s`}
              values="0;1;1;0"
              keyTimes="0;0.12;0.78;1"
              repeatCount="indefinite"
            />
          </circle>
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
const GAP = 22 // 面板離家電框的間隙
const TONE = { ok: COLORS.accent2, warn: COLORS.warn, err: COLORS.err }

function StatusPanel({ node }) {
  const { status, panelDir = 'B' } = node
  const tone = TONE[status.tone] ?? COLORS.accent2
  const bl = node.x - node.w / 2
  const br = node.x + node.w / 2
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
  } else {
    px = node.x - PW / 2
    py = bb + GAP
    from = [node.x, bb]
    to = [px + PW / 2, py]
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
        {/* 底板 */}
        <rect x={px} y={py} width={PW} height={PH} fill="#000" opacity="0.74" />
        {/* 左側縱向強調條 */}
        <rect x={px} y={py} width="3" height={PH} fill={tone} filter="url(#glow)" />
        {/* 角刻（右上 + 左下）*/}
        <g stroke={tone} strokeWidth="2" opacity="0.85">
          <line x1={px + PW} y1={py} x2={px + PW - tick} y2={py} />
          <line x1={px + PW} y1={py} x2={px + PW} y2={py + tick} />
          <line x1={px} y1={py + PH} x2={px + tick} y2={py + PH} />
          <line x1={px} y1={py + PH} x2={px} y2={py + PH - tick} />
        </g>

        {/* 標題：設備名（中文）+ 右上狀態點與狀態字 */}
        <text x={px + 16} y={py + 31} fontSize="25" fill={COLORS.highlight}
          style={{ fontFamily: labelFont, letterSpacing: '2px' }}>
          {node.label}
        </text>
        <circle cx={px + PW - 18} cy={py + 17} r="4.5" fill={tone} filter="url(#glow)">
          <animate attributeName="opacity" values="1;0.4;1" dur="1.4s" repeatCount="indefinite" />
        </circle>
        <text x={px + PW - 30} y={py + 22} textAnchor="end" fontSize="13" fill={tone}
          style={{ fontFamily: monoFont, letterSpacing: '1px' }}>
          {status.state}
        </text>

        {/* 設備代碼 */}
        <text x={px + 16} y={py + 50} fontSize="12.5" fill={COLORS.accent2} opacity="0.75"
          style={{ fontFamily: monoFont, letterSpacing: '2px' }}>
          {status.code}
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
