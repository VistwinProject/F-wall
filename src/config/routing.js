// ============================================================================
// 自動 PCB 佈線（octilinear / 八方位）：所有線段只走 0° / 45° / 90°（45° 的倍數）。
// 每個家電的腳位(pad)落在「中樞外環」上（依家電方位角放射分布），走「正交主幹 +
// 一段八方位斜線」插進外環，視覺上真的接上中樞。立柱若會穿過鄰框，自動外推一折繞過去。
// 家電位置改了也不用手動改線——這裡會重算。
//
// 手動覆寫：appliances.js 的家電可加 `route: [[x,y], ...]`，指定從框到中樞的中間
// 路徑點（不含起點與 pad —— 起點固定用框中心，pad 固定釘在外環上，兩端不用寫）。
// 有 route 的家電就完全照給的點走、不再自動避讓；沒有的照舊自動算。
// dev 模式下會檢查每段是否為八方位（0/45/90），不合的在 console 提示。
// ============================================================================
import { APPLIANCES, HUB } from './appliances.js'

const CX = HUB.x
const CY = HUB.y
const RING_R = 116 // 中樞外環半徑（需與 Hub.jsx 的 R 一致）：pad 就釘在這個環上
const KNEE = 46 // 轉角(knee)落在環外 KNEE 處；knee→pad 是「八方位」斜線/直線，插進環（接點感）
const DODGE_MG = 8 // 立柱遇到鄰框時，外推避讓留的安全間距

// 依方位把家電分到 下(B)/左(L)/右(R)/上(T)——只用來決定主幹是「先垂直」還是「先水平」
function sideOf(n) {
  const dx = n.x - CX
  const dy = n.y - CY
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'R' : 'L'
  return dy >= 0 ? 'B' : 'T'
}

function boxOf(n) {
  return { x: n.x - n.w / 2, y: n.y - n.h / 2, w: n.w, h: n.h }
}

// 垂直線 x 在 [lo,hi] 這段是否穿過框 b
function vHits(x, lo, hi, b) {
  return x > b.x && x < b.x + b.w && hi > b.y && lo < b.y + b.h
}

// 把任意方向四捨五入到最近的「八方位」單位向量（0/45/90...）
function nearestOcti(ax, ay) {
  let best = 0
  let bestDot = -Infinity
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4
    const dot = Math.cos(a) * ax + Math.sin(a) * ay
    if (dot > bestDot) {
      bestDot = dot
      best = k
    }
  }
  const a = (best * Math.PI) / 4
  return { x: Math.cos(a), y: Math.sin(a) }
}

function buildRoutes() {
  const routes = {}
  for (const n of APPLIANCES) {
    const a = Math.atan2(n.y - CY, n.x - CX) // 家電相對中樞的方位角
    const pin = { x: CX + RING_R * Math.cos(a), y: CY + RING_R * Math.sin(a) } // pad 釘在外環上
    // 插進環的最後一段：方向取「最接近徑向朝內」的八方位（讓接點看起來像放射插入）
    const d = nearestOcti(-Math.cos(a), -Math.sin(a))
    const knee = { x: pin.x - KNEE * d.x, y: pin.y - KNEE * d.y } // knee 落在環外、pad 的外側
    // 手動指定路徑：照給的點走，不套用自動避讓
    if (Array.isArray(n.route) && n.route.length) {
      const pts = simplify([pt(n.x, n.y), ...n.route.map(([x, y]) => pt(x, y)), pt(pin.x, pin.y)])
      warnNonOcti(n, pts)
      routes[n.id] = { pts, pin }
      continue
    }

    const side = sideOf(n)
    const others = APPLIANCES.filter((m) => m.id !== n.id).map(boxOf)
    let pts
    if (side === 'B' || side === 'T') {
      // 上/下：先水平到 knee 的 x（家電自己那一列空白），再垂直到 knee，最後八方位插進環
      pts = [pt(n.x, n.y), pt(knee.x, n.y), pt(knee.x, knee.y), pt(pin.x, pin.y)]
    } else {
      // 左/右：先垂直（待在家電自己那一欄）再水平到 knee；立柱若撞鄰框就外推一折繞過去
      let rx = n.x
      const lo = Math.min(n.y, knee.y)
      const hi = Math.max(n.y, knee.y)
      for (let it = 0; it < 5; it++) {
        let moved = false
        for (const b of others) {
          if (vHits(rx, lo, hi, b)) {
            moved = true
            rx = side === 'R' ? Math.min(rx, b.x - DODGE_MG) : Math.max(rx, b.x + b.w + DODGE_MG)
          }
        }
        if (!moved) break
      }
      pts = [pt(n.x, n.y), pt(rx, n.y), pt(rx, knee.y), pt(knee.x, knee.y), pt(pin.x, pin.y)]
    }
    routes[n.id] = { pts: simplify(pts), pin }
  }
  return routes
}

function pt(x, y) {
  return { x, y }
}

// 手動路徑的自我檢查：每段都必須是 0° / 45° / 90°（八方位），否則線看起來不像 PCB trace。
function warnNonOcti(n, pts) {
  if (!import.meta.env?.DEV) return
  for (let i = 1; i < pts.length; i++) {
    const dx = Math.abs(pts[i].x - pts[i - 1].x)
    const dy = Math.abs(pts[i].y - pts[i - 1].y)
    const axis = dx < 0.5 || dy < 0.5
    const diag = Math.abs(dx - dy) < 0.5
    if (!axis && !diag) {
      console.warn(
        `[routing] ${n.label}(${n.id}) 第 ${i} 段不是八方位：` +
        `(${pts[i - 1].x},${pts[i - 1].y}) → (${pts[i].x},${pts[i].y})  dx=${dx.toFixed(1)} dy=${dy.toFixed(1)}`)
    }
  }
}

// 去掉重複點與共線的中間點（例如家電正對中樞時，會塌成一條直線）
function simplify(pts) {
  const out = [pts[0]]
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i]
    const last = out[out.length - 1]
    if (Math.abs(p.x - last.x) < 0.5 && Math.abs(p.y - last.y) < 0.5) continue
    out.push(p)
  }
  let changed = true
  while (changed && out.length > 2) {
    changed = false
    for (let i = 1; i < out.length - 1; i++) {
      const a = out[i - 1]
      const b = out[i]
      const c = out[i + 1]
      const colV = Math.abs(a.x - b.x) < 0.5 && Math.abs(b.x - c.x) < 0.5
      const colH = Math.abs(a.y - b.y) < 0.5 && Math.abs(b.y - c.y) < 0.5
      if (colV || colH) {
        out.splice(i, 1)
        changed = true
        break
      }
    }
  }
  return out
}

const ROUTES = buildRoutes()

export function getRoute(id) {
  return ROUTES[id] ?? { pts: [pt(CX, CY)], pin: { x: CX, y: CY } }
}

// 直接把折點串成 polyline —— 極簡版走線用這個。
// 路徑幾何（buildRoutes 的八方位佈線、避讓、pad 落點）完全沿用，
// 只是不再把轉角切成 45° 斜邊，因為倒角正是「電路板」的招牌特徵。
export function linePath(pts) {
  if (!pts.length) return ''
  return pts.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ')
}

// ⚠ 以下 chamferPath 目前沒有任何元件在用（極簡版改用 linePath）。
//    保留匯出是因為佈線幾何本身沒變，之後若要把倒角外觀加回來可以直接切換。
// 把「直角(90°)轉折」切成 45° 斜角（電路板 trace 招牌外觀）。
// 只切「兩段互相垂直、且都是水平/垂直」的轉角——切出來剛好是 45° 斜邊，仍是八方位；
// 其餘轉角（已經是 45° 斜線的接點）保持尖角不動，避免切出非八方位的線段。
export function chamferPath(pts, c = 14) {
  if (pts.length < 2) return ''
  if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`
  const isAxis = (vx, vy) => Math.abs(vx) < 1e-6 || Math.abs(vy) < 1e-6
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1]
    const cur = pts[i]
    const next = pts[i + 1]
    const inLen = Math.hypot(cur.x - prev.x, cur.y - prev.y) || 1
    const outLen = Math.hypot(next.x - cur.x, next.y - cur.y) || 1
    const ix = (cur.x - prev.x) / inLen
    const iy = (cur.y - prev.y) / inLen
    const ox = (next.x - cur.x) / outLen
    const oy = (next.y - cur.y) / outLen
    const perpendicular = Math.abs(ix * ox + iy * oy) < 1e-6
    if (isAxis(ix, iy) && isAxis(ox, oy) && perpendicular) {
      const ci = Math.min(c, inLen / 2, outLen / 2)
      const ax = cur.x - ix * ci
      const ay = cur.y - iy * ci
      const bx = cur.x + ox * ci
      const by = cur.y + oy * ci
      d += ` L ${ax.toFixed(1)} ${ay.toFixed(1)} L ${bx.toFixed(1)} ${by.toFixed(1)}`
    } else {
      d += ` L ${cur.x.toFixed(1)} ${cur.y.toFixed(1)}`
    }
  }
  const last = pts[pts.length - 1]
  d += ` L ${last.x} ${last.y}`
  return d
}
