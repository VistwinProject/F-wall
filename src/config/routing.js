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
import { APPLIANCES, HUB, RESERVED_SCREEN } from './appliances.js'
import { FX } from './fx.js'

const CX = HUB.x
const CY = HUB.y
// 中樞接點(pad)所在的環半徑。中樞現在是 340×340 的黑塊（半寬 170），
// 所以這個環整個藏在黑塊底下 —— 走線是「進到黑塊裡才結束」，
// 跟家電端「從黑塊中心長出來、在框邊冒出來」是同一個對稱作法。
// ⚠ 不再與任何元件耦合（Hub.jsx 已經沒有圓環了），改這個值只會動走線末端的收束方向。
const RING_R = 116
const KNEE = 46 // 轉角(knee)落在環外 KNEE 處；knee→pad 是「八方位」斜線/直線，插進環（接點感）
// 走線與「別人的黑塊」之間要留的淨空。黑塊是牆上實體展品的預留位，線貼著框邊走
// 會讀成「線黏在展品上」；投影距離下 8 這種等級根本看不出是刻意留的空隙。
// 30 大約是狀態面板離框距離(GAP=22)的同一個量級，看起來才像有意為之。
// 資訊面板不算障礙物 —— 線可以直接穿過面板。
const CLEAR = 30

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

// 把框往外膨脹 CLEAR：命中測試改用膨脹框，避讓後自然就有 CLEAR 的淨空，
// 不必再另外加 margin（舊版是「貼著框判定 + 只推 8」，所以永遠只有 8 的空隙）。
function inflate(b, m = CLEAR) {
  return { x: b.x - m, y: b.y - m, w: b.w + 2 * m, h: b.h + 2 * m }
}

// 電視預留區也是實體展品的預留位，而且規格明訂「不准有連線穿過」。
// 舊版的自動佈線完全沒檢查它，只靠上排兩台剛好沒經過而已。
const SCREEN_BOX = {
  x: RESERVED_SCREEN.x - RESERVED_SCREEN.w / 2,
  y: RESERVED_SCREEN.y - RESERVED_SCREEN.h / 2,
  w: RESERVED_SCREEN.w,
  h: RESERVED_SCREEN.h,
}

// 垂直線 x 在 [lo,hi] 這段是否穿過框 b
function vHits(x, lo, hi, b) {
  return x > b.x && x < b.x + b.w && hi > b.y && lo < b.y + b.h
}

// 水平線 y 在 [lo,hi] 這段是否穿過框 b
function hHits(y, lo, hi, b) {
  return y > b.y && y < b.y + b.h && hi > b.x && lo < b.x + b.w
}

// 主幹擦過「自己的框」的兩種難看情況：
//   (a) 落在框外但貼著邊 → 線沿著自己的框邊擦過去。
//   (b) 落在框內但太靠近「等一下要穿出去的那條邊」→ 線從框角切出去，像削到角。
// 乾淨的走法只有兩種：夠深入框內（從邊的中段垂直穿出），或離框至少 CLEAR。
// 這裡把落在中間那條擦邊帶的座標，推到最近的乾淨位置。
// 框本身不夠寬/高（跨距 < 2×CLEAR）時沒有「夠深入」可言，一律推到框外。
function unGraze(v, lo, hi) {
  const hasInner = hi - lo >= 2 * CLEAR
  if (hasInner && v >= lo + CLEAR && v <= hi - CLEAR) return v
  return v <= (lo + hi) / 2 ? Math.min(v, lo - CLEAR) : Math.max(v, hi + CLEAR)
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
    const own = boxOf(n)
    // 障礙物 = 其他八個黑塊 + 電視預留區，全部先膨脹 CLEAR。
    // 自己的框不算障礙（線本來就從框中心長出來），改用 unGraze 處理擦邊。
    // 資訊面板刻意不算障礙 —— 線可以直接穿過面板。
    const obstacles = [
      ...APPLIANCES.filter((m) => m.id !== n.id).map((m) => inflate(boxOf(m))),
      inflate(SCREEN_BOX),
    ]

    // 把主幹座標 v 推出所有命中的膨脹框。toward 決定往哪個方向推（朝中樞那側）。
    // hits 是 vHits(垂直主幹) 或 hHits(水平主幹)；lo/hi 是主幹另一軸的跨距。
    const push = (v, span, hits, lower) => {
      for (let it = 0; it < 8; it++) {
        let moved = false
        for (const b of obstacles) {
          if (!hits(v, span()[0], span()[1], b)) continue
          moved = true
          const nb = hits === vHits ? [b.x, b.x + b.w] : [b.y, b.y + b.h]
          v = lower ? Math.min(v, nb[0] - 0.01) : Math.max(v, nb[1] + 0.01)
        }
        if (!moved) break
      }
      return v
    }

    let pts
    if (side === 'B' || side === 'T') {
      // 上/下排：先垂直離開框(到 ry)，再水平到主幹 x(kx)，再垂直到 knee，最後八方位插進環。
      // 兩條主幹都要「避開障礙」也「不擦到自己的框」，而兩者會互相推翻，所以來回收斂幾輪。
      let ry = n.y
      let kx = knee.x
      const upward = side === 'B' // 下排的水平主幹往上挪，上排往下挪（都是朝中樞那側）
      for (let round = 0; round < 6; round++) {
        const before = `${ry},${kx}`
        ry = push(ry, () => [Math.min(n.x, kx), Math.max(n.x, kx)], hHits, upward)
        ry = unGraze(ry, own.y, own.y + own.h)
        kx = push(kx, () => [Math.min(ry, knee.y), Math.max(ry, knee.y)], vHits, kx < CX)
        kx = unGraze(kx, own.x, own.x + own.w)
        if (`${ry},${kx}` === before) break
      }
      pts = [pt(n.x, n.y), pt(n.x, ry), pt(kx, ry), pt(kx, knee.y), pt(knee.x, knee.y), pt(pin.x, pin.y)]
    } else {
      // 左/右排：先水平離開框(到 rx)，再垂直到主幹 y(ry)，再水平到 knee，最後八方位插進環。
      let rx = n.x
      let ry = knee.y
      const leftward = side === 'R' // 右排的垂直主幹往左挪，左排往右挪（都是朝中樞那側）
      for (let round = 0; round < 6; round++) {
        const before = `${rx},${ry}`
        rx = push(rx, () => [Math.min(n.y, ry), Math.max(n.y, ry)], vHits, leftward)
        rx = unGraze(rx, own.x, own.x + own.w)
        ry = push(ry, () => [Math.min(rx, knee.x), Math.max(rx, knee.x)], hHits, ry < CY)
        ry = unGraze(ry, own.y, own.y + own.h)
        if (`${rx},${ry}` === before) break
      }
      pts = [pt(n.x, n.y), pt(rx, n.y), pt(rx, ry), pt(knee.x, ry), pt(knee.x, knee.y), pt(pin.x, pin.y)]
    }
    const out = simplify(pts)
    warnNonOcti(n, out)
    routes[n.id] = { pts: out, pin }
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

// ============================================================================
// 倒圓角
// ----------------------------------------------------------------------------
// 走線的轉折處磨成圓弧。轉角 i 的切線長 t = r · tan(δ/2)，δ 是轉向角
// （90° → t = r，45° → t = 0.414r），弧長 = rEff · δ。
//
// ⚠ 半徑必須【逐個轉角】夾限，不能全域取一個安全值：除濕機與空氣清淨機的第一段
//   只有 4.6 單位，全域統一就會被卡在 4.5，九條線全部看不出圓角。逐角夾限之後，
//   那個角收成 2.3（而且它落在黑塊正中央，本來就看不見），其餘可見轉角照拿 18。
//
// ⚠ 用 A（真圓弧）而不是 Q（二次貝茲）：弧長算得出精確值，彗星的等速換算才準。
// ============================================================================
const TAU_EPS = 1e-6

export function roundPath(pts, r) {
  if (pts.length < 2) return { d: '', length: 0 }
  if (pts.length === 2) {
    return { d: `M ${f(pts[0].x)} ${f(pts[0].y)} L ${f(pts[1].x)} ${f(pts[1].y)}`, length: polylineLength(pts) }
  }

  const seg = []
  for (let i = 1; i < pts.length; i++) seg.push(Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y))

  // 每個轉角先算自己的切線長，再夾到「不吃掉相鄰段一半」——
  // 取一半是保守但夠用：即使兩端的轉角都要吃，也不會互相重疊。
  const corner = []
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1], b = pts[i], c = pts[i + 1]
    const a1 = Math.atan2(b.y - a.y, b.x - a.x)
    const a2 = Math.atan2(c.y - b.y, c.x - b.x)
    let delta = a2 - a1
    while (delta > Math.PI) delta -= 2 * Math.PI
    while (delta < -Math.PI) delta += 2 * Math.PI
    const abs = Math.abs(delta)
    if (abs < TAU_EPS || Math.abs(abs - Math.PI) < TAU_EPS) { corner.push(null); continue } // 直線或原路折返
    const k = Math.tan(abs / 2)
    const t = Math.min(r * k, seg[i - 1] / 2, seg[i] / 2)
    corner.push({ t, rEff: t / k, delta, abs, sweep: delta > 0 ? 1 : 0 })
  }

  let d = ''
  let length = 0
  let cur = pts[0]
  for (let i = 1; i < pts.length - 1; i++) {
    const cn = corner[i - 1]
    const b = pts[i]
    if (!cn) continue
    const inLen = Math.hypot(b.x - cur.x, b.y - cur.y)
    const ux = (b.x - cur.x) / inLen, uy = (b.y - cur.y) / inLen
    const entry = { x: b.x - ux * cn.t, y: b.y - uy * cn.t }

    const c = pts[i + 1]
    const outLen = Math.hypot(c.x - b.x, c.y - b.y)
    const vx = (c.x - b.x) / outLen, vy = (c.y - b.y) / outLen
    const exit = { x: b.x + vx * cn.t, y: b.y + vy * cn.t }

    d += (d ? '' : `M ${f(cur.x)} ${f(cur.y)}`) + ` L ${f(entry.x)} ${f(entry.y)}`
    d += ` A ${f(cn.rEff)} ${f(cn.rEff)} 0 0 ${cn.sweep} ${f(exit.x)} ${f(exit.y)}`
    length += Math.hypot(entry.x - cur.x, entry.y - cur.y) + cn.rEff * cn.abs
    cur = exit
  }
  const last = pts[pts.length - 1]
  if (!d) d = `M ${f(pts[0].x)} ${f(pts[0].y)}`
  d += ` L ${f(last.x)} ${f(last.y)}`
  length += Math.hypot(last.x - cur.x, last.y - cur.y)
  return { d, length }
}

function f(v) {
  return Math.round(v * 100) / 100
}

// 倒角後的走線。核心線、光暈裡的走線複本、彗星的 animateMotion、能量光帶
// 【四個地方都必須吃這同一條 d】—— 任何一個自己再算一次，彗星就會脫離線飛。
const ROUNDED = {}
export function roundedRoute(id) {
  if (!ROUNDED[id]) ROUNDED[id] = roundPath(getRoute(id).pts, FX.corner)
  return ROUNDED[id]
}

const ROUTES = buildRoutes()

export function getRoute(id) {
  return ROUTES[id] ?? { pts: [pt(CX, CY)], pin: { x: CX, y: CY } }
}

// 折線總長度。倒角後的長度由 roundedRoute 另外算（弧比直角短），這裡只給折線用。
function polylineLength(pts) {
  let L = 0
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
  return L
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
