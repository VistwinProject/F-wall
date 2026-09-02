import * as THREE from 'three'
import { sampledRoute, sampledCometRoute } from '../config/routing.js'
import { APPLIANCES, HUB } from '../config/appliances.js'
import { FX } from '../config/fx.js'

// ============================================================================
// 把既有的佈線變成 Three.js 曲線。
//
// ⚠ 不重新設計路徑。routing.js 已經算好倒角後的幾何，這裡只是取樣 → CatmullRomCurve3。
//   用 CatmullRom 的理由是它的 getSpacedPoints() 會給【等弧長】的取樣，
//   ribbon 的寬度與彗星的速度才會沿線一致（直接用原始取樣點的話疏密不均）。
//   輸入點已經很密（圓弧每 3 單位、直線每 24 單位），內插誤差實測 < 0.02%。
//
// ⚠ ribbon 蓋在【完整路徑】上（兩端伸進黑塊），不是可見路徑：
//   SVG 的黑塊畫在 canvas 之上，會把兩端蓋掉，所以彗星在等待期自動是隱形的
//   （＝封包之間的間隔，不用另外做淡入淡出），抵達核心後也會被吃掉。
// ============================================================================

export function curveOf(id) {
  const pts = sampledCometRoute(id).map((p) => new THREE.Vector3(p.x, p.y, 0))
  return new THREE.CatmullRomCurve3(pts, false, 'centripetal')
}

// 完整路徑上「可見段從哪裡開始」的比例。
// ⚠ 不能拿可見路徑的第一個點去比對：兩邊的取樣點不見得剛好落在同一個位置。
//   直接沿完整路徑走，第一次離開家電黑塊的地方就是可見起點。
export function visibleRange(id, node) {
  const full = sampledCometRoute(id)
  const len = (a) => {
    let L = 0
    for (let i = 1; i < a.length; i++) L += Math.hypot(a[i].x - a[i - 1].x, a[i].y - a[i - 1].y)
    return L
  }
  const fullLen = len(full)
  const inBlock = (p) =>
    Math.abs(p.x - node.x) <= node.w / 2 + 0.01 && Math.abs(p.y - node.y) <= node.h / 2 + 0.01
  let lead = 0
  for (let i = 1; i < full.length; i++) {
    if (!inBlock(full[i])) break
    lead += Math.hypot(full[i].x - full[i - 1].x, full[i].y - full[i - 1].y)
  }
  return { fullLen, visibleLen: len(sampledRoute(id)), start: lead / fullLen }
}

// 圓角矩形的外框點（家電黑塊、核心黑塊、大框都用它）
export function roundedRectPoints(cx, cy, w, h, r, step = 6) {
  const x0 = cx - w / 2
  const y0 = cy - h / 2
  const x1 = cx + w / 2
  const y1 = cy + h / 2
  const rr = Math.min(r, w / 2, h / 2)
  const out = []
  const arc = (ax, ay, a0, a1) => {
    const n = Math.max(2, Math.ceil((rr * Math.abs(a1 - a0)) / step))
    for (let i = 0; i <= n; i++) {
      const a = a0 + (a1 - a0) * (i / n)
      out.push(new THREE.Vector3(ax + rr * Math.cos(a), ay + rr * Math.sin(a), 0))
    }
  }
  out.push(new THREE.Vector3(x0 + rr, y0, 0))
  out.push(new THREE.Vector3(x1 - rr, y0, 0))
  arc(x1 - rr, y0 + rr, -Math.PI / 2, 0)
  out.push(new THREE.Vector3(x1, y1 - rr, 0))
  arc(x1 - rr, y1 - rr, 0, Math.PI / 2)
  out.push(new THREE.Vector3(x0 + rr, y1, 0))
  arc(x0 + rr, y1 - rr, Math.PI / 2, Math.PI)
  out.push(new THREE.Vector3(x0, y0 + rr, 0))
  arc(x0 + rr, y0 + rr, Math.PI, Math.PI * 1.5)
  return out
}

export const APPLIANCE_LIST = APPLIANCES
export const HUB_BOX = HUB
export const CORNER = FX.corner
