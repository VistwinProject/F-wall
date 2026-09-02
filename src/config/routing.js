// ============================================================================
// 自動佈線：從【家電黑塊邊緣】走到【核心黑塊邊緣】。
//
// 規則就是這一句。實作上分兩條路徑：
//   visible —— 真正畫出來的：兩端都切在黑塊邊界上，中間沒有任何藏起來的線段。
//   full    —— 只給彗星用的運動軌跡：兩端各自伸進黑塊裡面。
//              彗星在每一輪的等待期停在家電框中心（黑塊底下＝隱形，這就是封包之間的
//              間隔，不用另外做淡入淡出），抵達核心後也要繼續往裡面跑到整條拖尾都被
//              黑塊吃掉為止，否則會在核心邊緣「啪」地重置。
//
// 接點(pad)＝「核心中心 → 家電中心」這條射線與核心黑塊邊界的交點，
// 所以九個接點自然沿著方位放射分布在三條邊上。最後一段一律是垂直插入該邊。
// 立柱若會穿過鄰框，自動外推一折繞過去。
// 家電位置改了也不用手動改線——這裡會重算。
//
// ⚠ 舊版是「pad 釘在中樞外環（半徑 116）上、用八方位斜線插進去」。中樞已經改成
//    340×340 的黑塊，那個環整個藏在黑塊底下、看不見了 —— 圓的概念（RING_R /
//    nearestOcti）全部拿掉，改成上面那條「射線打在矩形邊界上」。
//
// 手動覆寫：appliances.js 的家電可加 `route: [[x,y], ...]`，指定從框到核心的中間
// 路徑點（不含起點與 pad，兩端不用寫）。有 route 的就完全照給的點走、不再自動避讓。
// dev 模式下會檢查每段是否為八方位（0/45/90），不合的在 console 提示。
// ============================================================================
import { APPLIANCES, HUB, RESERVED_SCREEN } from './appliances.js'
import { FX } from './fx.js'

const CX = HUB.x
const CY = HUB.y
// 核心黑塊（＝走線的終點面）。與 Hub.jsx 畫的是同一組 HUB.x/y/w/h。
const HUB_BOX = { x: CX - HUB.w / 2, y: CY - HUB.h / 2, w: HUB.w, h: HUB.h }
// 彗星抵達核心之後還要往裡面跑多遠才算完全被吃掉（要 > 彗星頭半徑 + 拖尾長度）。
const SWALLOW = 170
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

// 接點(pad)：從核心中心朝家電中心射一條線，打在核心黑塊邊界上的那一點。
// 九台的方位不同，接點就自然沿著邊放射分布 —— 不需要另外排序、也不會互相撞。
//
// 例外：接點與家電自己的座標只差一點點時就吸過去。智慧插座在 x=960、射線打出來是
// 957.4，不吸的話末段會多一個 2.6 單位的 S 形小折，投影出來就是一個看得見的疙瘩。
const SNAP = 12
function padOf(n) {
  const dx = n.x - CX
  const dy = n.y - CY
  const hw = HUB_BOX.w / 2
  const hh = HUB_BOX.h / 2
  // 射線先碰到哪一組平面：比較 |dx|/hw 與 |dy|/hh
  const tx = dx ? hw / Math.abs(dx) : Infinity
  const ty = dy ? hh / Math.abs(dy) : Infinity
  const t = Math.min(tx, ty)
  if (tx <= ty) {
    // 打在左/右邊
    const side = dx < 0 ? 'L' : 'R'
    let y = CY + dy * t
    if (Math.abs(y - n.y) < SNAP) y = n.y
    return { x: dx < 0 ? HUB_BOX.x : HUB_BOX.x + HUB_BOX.w, y, side }
  }
  // 打在上/下邊
  const side = dy < 0 ? 'T' : 'B'
  let x = CX + dx * t
  if (Math.abs(x - n.x) < SNAP) x = n.x
  return { x, y: dy < 0 ? HUB_BOX.y : HUB_BOX.y + HUB_BOX.h, side }
}

// 轉角(knee)：把 pad 沿著它所在那條邊的法線往【外】推 KNEE。
// 末段 knee→pad 因此一定是垂直插入邊，不會斜切進去。
const KNEE = 46
function kneeOf(pad) {
  if (pad.side === 'L') return { x: pad.x - KNEE, y: pad.y }
  if (pad.side === 'R') return { x: pad.x + KNEE, y: pad.y }
  if (pad.side === 'T') return { x: pad.x, y: pad.y - KNEE }
  return { x: pad.x, y: pad.y + KNEE }
}

// 主幹不可以貼著核心黑塊擦過去 —— 與家電框同一個道理（見 unGraze）。
function keepOffHub(v, lo, hi, awayIsLess) {
  if (v > hi + CLEAR || v < lo - CLEAR) return v
  return awayIsLess ? Math.min(v, lo - CLEAR) : Math.max(v, hi + CLEAR)
}


function buildRoutes() {
  const routes = {}
  for (const n of APPLIANCES) {
    const pad = padOf(n)
    const knee = kneeOf(pad)
    // 彗星要跑進核心黑塊裡面才會被吃掉，所以 full 路徑在 pad 之後再往內延伸一段。
    const inward =
      pad.side === 'L' ? pt(pad.x + SWALLOW, pad.y)
      : pad.side === 'R' ? pt(pad.x - SWALLOW, pad.y)
      : pad.side === 'B' ? pt(pad.x, pad.y - SWALLOW)
      : pt(pad.x, pad.y + SWALLOW)

    // 手動指定路徑：照給的點走，不套用自動避讓
    if (Array.isArray(n.route) && n.route.length) {
      const full = simplify([pt(n.x, n.y), ...n.route.map(([x, y]) => pt(x, y)), pt(pad.x, pad.y), inward])
      warnNonOcti(n, full)
      routes[n.id] = finish(n, full)
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
      // 上/下排：先垂直離開框(到 ry)，再水平到 pad 的 x，再垂直插進核心的上/下邊。
      // 兩條主幹都要「避開障礙」也「不擦到自己的框」，而兩者會互相推翻，所以來回收斂幾輪。
      let ry = n.y
      let kx = knee.x
      const upward = side === 'B' // 下排的水平主幹往上挪，上排往下挪（都是朝核心那側）
      for (let round = 0; round < 6; round++) {
        const before = `${ry},${kx}`
        ry = push(ry, () => [Math.min(n.x, kx), Math.max(n.x, kx)], hHits, upward)
        ry = unGraze(ry, own.y, own.y + own.h)
        // ⚠ 水平主幹會從核心黑塊底下（或上面）橫過去，不能貼著邊走。
        ry = keepOffHub(ry, HUB_BOX.y, HUB_BOX.y + HUB_BOX.h, side === 'T')
        kx = push(kx, () => [Math.min(ry, knee.y), Math.max(ry, knee.y)], vHits, kx < CX)
        kx = unGraze(kx, own.x, own.x + own.w)
        if (`${ry},${kx}` === before) break
      }
      pts = [pt(n.x, n.y), pt(n.x, ry), pt(kx, ry), pt(kx, knee.y), pt(knee.x, knee.y), pt(pad.x, pad.y), inward]
    } else {
      // 左/右排：先水平離開框(到 rx)，再垂直到 pad 的 y，再水平插進核心的左/右邊。
      let rx = n.x
      let ry = knee.y
      const leftward = side === 'R' // 右排的垂直主幹往左挪，左排往右挪（都是朝核心那側）
      for (let round = 0; round < 6; round++) {
        const before = `${rx},${ry}`
        rx = push(rx, () => [Math.min(n.y, ry), Math.max(n.y, ry)], vHits, leftward)
        rx = unGraze(rx, own.x, own.x + own.w)
        // ⚠ 垂直主幹會從核心黑塊旁邊經過，不能貼著邊走。
        rx = keepOffHub(rx, HUB_BOX.x, HUB_BOX.x + HUB_BOX.w, side === 'L')
        ry = push(ry, () => [Math.min(rx, knee.x), Math.max(rx, knee.x)], hHits, ry < CY)
        ry = unGraze(ry, own.y, own.y + own.h)
        if (`${rx},${ry}` === before) break
      }
      pts = [pt(n.x, n.y), pt(rx, n.y), pt(rx, ry), pt(knee.x, ry), pt(knee.x, knee.y), pt(pad.x, pad.y), inward]
    }
    const full = simplify(pts)
    warnNonOcti(n, full)
    routes[n.id] = finish(n, full)
  }
  return routes
}

// 把「框心 → 核心內部」的完整軌跡切成看得見的那一段：
// 頭切在家電黑塊邊界、尾切在核心黑塊邊界。彗星走 full，其他everything走 visible。
function finish(n, full) {
  return { pts: clipEnds(full, boxOf(n), HUB_BOX) }
}

// a 在 r 內、b 在 r 外時，回傳線段離開 r 的參數 t。
// 四個邊界平面各算一次交點，取最小的正 t —— 從框內出發，第一個碰到的就是出口。
function exitT(a, b, r) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  let t = 1
  if (dx > 0) t = Math.min(t, (r.x + r.w - a.x) / dx)
  if (dx < 0) t = Math.min(t, (r.x - a.x) / dx)
  if (dy > 0) t = Math.min(t, (r.y + r.h - a.y) / dy)
  if (dy < 0) t = Math.min(t, (r.y - a.y) / dy)
  return t
}

const inRect = (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h

// 從頭砍掉落在 headBox 裡的部分、從尾砍掉落在 tailBox 裡的部分。
function clipEnds(pts, headBox, tailBox) {
  let out = pts.slice()
  // 頭
  let i = 0
  while (i < out.length - 1 && inRect(out[i + 1], headBox)) i++
  if (inRect(out[i], headBox)) {
    const t = exitT(out[i], out[i + 1], headBox)
    out = [pt(out[i].x + (out[i + 1].x - out[i].x) * t, out[i].y + (out[i + 1].y - out[i].y) * t), ...out.slice(i + 1)]
  }
  // 尾
  let j = out.length - 1
  while (j > 0 && inRect(out[j - 1], tailBox)) j--
  if (inRect(out[j], tailBox)) {
    const t = exitT(out[j], out[j - 1], tailBox)
    out = [...out.slice(0, j), pt(out[j].x + (out[j - 1].x - out[j].x) * t, out[j].y + (out[j - 1].y - out[j].y) * t)]
  }
  return simplify(out)
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
// ============================================================================
const TAU_EPS = 1e-6

// 每個轉角先算自己的切線長，再夾到「不吃掉相鄰段一半」——
// 取一半是保守但夠用：即使兩端的轉角都要吃，也不會互相重疊。
// ⚠ roundPath（給 SVG 的 d）與 samplePath（給 WebGL 的點）必須吃同一份轉角資料，
//   否則畫出來的線跟光束會差幾個單位。
function cornersOf(pts, r) {
  const seg = []
  for (let i = 1; i < pts.length; i++) seg.push(Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y))
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
  return corner
}

// 倒角後的路徑取樣成點陣列 —— WebGL 那邊拿這個去長 CatmullRomCurve3 與 ribbon。
// 圓弧按弧長細分，直線段只要兩端點（Catmull-Rom 在直線上不會亂跑）。
export function samplePath(pts, r = FX.corner, arcStep = 3, lineStep = 24) {
  // 直線段也要細分：CatmullRom 只吃到兩個相距很遠的控制點時，接在圓弧後面容易微微鼓出去。
  const dense = (a, b, into) => {
    const L = Math.hypot(b.x - a.x, b.y - a.y)
    const n = Math.max(1, Math.ceil(L / lineStep))
    for (let k = 1; k < n; k++) into.push({ x: a.x + (b.x - a.x) * (k / n), y: a.y + (b.y - a.y) * (k / n) })
  }
  if (pts.length < 2) return pts.map((p) => ({ ...p }))
  const out = [{ ...pts[0] }]
  if (pts.length === 2) {
    dense(pts[0], pts[1], out)
    return [...out, { ...pts[1] }]
  }

  const corner = cornersOf(pts, r)
  let cur = pts[0]
  for (let i = 1; i < pts.length - 1; i++) {
    const cn = corner[i - 1]
    if (!cn) continue
    const b = pts[i]
    const inLen = Math.hypot(b.x - cur.x, b.y - cur.y)
    const ux = (b.x - cur.x) / inLen, uy = (b.y - cur.y) / inLen
    const entry = { x: b.x - ux * cn.t, y: b.y - uy * cn.t }

    const c = pts[i + 1]
    const outLen = Math.hypot(c.x - b.x, c.y - b.y)
    const vx = (c.x - b.x) / outLen, vy = (c.y - b.y) / outLen
    const exit = { x: b.x + vx * cn.t, y: b.y + vy * cn.t }

    dense(cur, entry, out)
    out.push(entry)
    // 圓心：從進入點沿著「入向的法線」偏 rEff，偏哪一邊看轉向的正負。
    const sgn = Math.sign(cn.delta)
    const cx = entry.x + -uy * cn.rEff * sgn
    const cy = entry.y + ux * cn.rEff * sgn
    const a0 = Math.atan2(entry.y - cy, entry.x - cx)
    const steps = Math.max(2, Math.ceil((cn.rEff * cn.abs) / arcStep))
    for (let k = 1; k < steps; k++) {
      const a = a0 + sgn * cn.abs * (k / steps)
      out.push({ x: cx + cn.rEff * Math.cos(a), y: cy + cn.rEff * Math.sin(a) })
    }
    out.push(exit)
    cur = exit
  }
  const last = pts[pts.length - 1]
  dense(cur, last, out)
  out.push({ ...last })
  return out
}

// 倒角後的走線取樣點。WebGL 的 ribbon 與彗星軌跡都吃這一條（見 webgl/curves.js）。
// ⚠ 只有這一條 —— 走線的幾何只能有一個來源，任何地方自己再算一次都會對不齊。
const SAMPLED = {}
export function sampledRoute(id) {
  if (!SAMPLED[id]) SAMPLED[id] = samplePath(getRoute(id).pts)
  return SAMPLED[id]
}
const ROUTES = buildRoutes()

function getRoute(id) {
  return ROUTES[id] ?? { pts: [pt(CX, CY)] }
}
