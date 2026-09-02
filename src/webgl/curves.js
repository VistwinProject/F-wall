import * as THREE from 'three'
import { sampledRoute } from '../config/routing.js'

// ============================================================================
// 把既有的佈線變成 Three.js 曲線。
//
// ⚠ 不重新設計路徑。routing.js 已經算好倒角後的幾何，這裡只是取樣 → CatmullRomCurve3。
//   用 CatmullRom 的理由是它的 getSpacedPoints() 會給【等弧長】的取樣，
//   ribbon 的寬度與彗星的速度才會沿線一致（直接用原始取樣點的話疏密不均）。
//   輸入點已經很密（圓弧每 3 單位、直線每 24 單位），內插誤差實測 < 0.02%。
//
// ⚠ ribbon 只蓋【可見路徑】：家電黑塊邊緣 → 核心黑塊邊緣，兩端都不伸進黑塊。
//
//   舊版是蓋在完整路徑上、讓黑塊把兩端蓋掉（彗星就有地方躲）。問題是
//   **黑塊只蓋得住畫面，蓋不住 bloom** —— 躲在核心黑塊裡的彗星仍然會泛光，
//   那圈光會從黑塊四周漏出來，看起來就像有東西在黑塊後面繼續跑。
//   現在路徑本身就到邊緣為止，彗星的生滅改由 shader 的相位控制（見 TraceBeam）。
// ============================================================================

export function curveOf(id) {
  const pts = sampledRoute(id).map((p) => new THREE.Vector3(p.x, p.y, 0))
  return new THREE.CatmullRomCurve3(pts, false, 'centripetal')
}

// 可見路徑的長度（＝畫出來那條線的長度）。彗星速度與 draw-on 都用它換算。
export function visibleLength(id) {
  const pts = sampledRoute(id)
  let L = 0
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
  return L
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
