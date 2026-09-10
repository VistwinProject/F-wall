import * as THREE from 'three'

// ============================================================================
// 沿一串點鋪出三角帶（ribbon）。三端共用。
//
// 為什麼是 ribbon 而不是 THREE.Line：要在「橫剖面」上做柔邊（中心緊、邊緣散），
// bloom 才有東西可以吃。單純的線只有一個像素寬的核心，泛出來會很扁。
//
// aSide  橫剖面座標，-1（一側邊緣）→ 0（中心）→ +1（另一側邊緣）
// aT     沿線的弧長比例 0..1，彗星的位置就是拿它比對的
//
// ⚠ 這個檔案由 sync-tokens.mjs 從 F-wall 複製到 F-Ipad / F-table，不要單獨改。
// ============================================================================

export function ribbon(points, width, closed = false) {
  const pts = closed ? [...points, points[0]] : points
  const n = pts.length
  const half = width / 2

  // 先算累積弧長，aT 才是【等弧長】而不是「第幾個點」——
  // 取樣疏密不均時後者會讓彗星忽快忽慢。
  const acc = new Float32Array(n)
  for (let i = 1; i < n; i++) {
    acc[i] = acc[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
  }
  const total = acc[n - 1] || 1

  const pos = new Float32Array(n * 2 * 3)
  const aSide = new Float32Array(n * 2)
  const aT = new Float32Array(n * 2)

  for (let i = 0; i < n; i++) {
    const p = pts[i]
    const a = pts[Math.max(0, i - 1)]
    const b = pts[Math.min(n - 1, i + 1)]
    let tx = b.x - a.x
    let ty = b.y - a.y
    const L = Math.hypot(tx, ty) || 1
    tx /= L
    ty /= L
    for (const s of [0, 1]) {
      const sign = s === 0 ? 1 : -1
      const k = (i * 2 + s) * 3
      pos[k] = p.x + -ty * half * sign
      pos[k + 1] = p.y + tx * half * sign
      pos[k + 2] = 0
      aSide[i * 2 + s] = sign
      aT[i * 2 + s] = acc[i] / total
    }
  }

  const idx = []
  for (let i = 0; i < n - 1; i++) {
    const a = i * 2
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('aSide', new THREE.BufferAttribute(aSide, 1))
  geo.setAttribute('aT', new THREE.BufferAttribute(aT, 1))
  geo.setIndex(idx)
  geo.userData.length = total
  return geo
}

/** 圓的取樣點。iPad 的節點外圈、桌面的 slot 圓環、中樞環都用它。 */
export function circlePoints(cx, cy, r, step = 6) {
  const n = Math.max(24, Math.ceil((2 * Math.PI * r) / step))
  const out = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    out.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) })
  }
  return out
}
