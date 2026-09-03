import * as THREE from 'three'
import { col } from './stage.js'
import { FX } from '../config/fx.js'
import { curveOf, visibleLength } from './curves.js'
// ⚠ shader 已經抽到 glow/shaders.js —— 三端共用同一份。
import { BEAM_VERT as VERT, BEAM_FRAG as FRAG } from '../glow/shaders.js'

// ============================================================================
// 一條走線 = 一片沿曲線鋪出來的三角帶（ribbon），整條的外觀由 fragment shader 決定。
//
// 為什麼是 ribbon 而不是 Line：要在「橫剖面」上做柔邊（中心緊、邊緣散），
// bloom 才有東西可以吃。單純的線只有一個像素寬的核心，泛出來會很扁。
//
// ⚠ ribbon 蓋在【完整路徑】上（兩端伸進黑塊）。SVG 的黑塊畫在 canvas 之上會把兩端蓋掉，
//   所以彗星在等待期是隱形的（＝封包之間的間隔），抵達核心後也會被吃掉。
// ============================================================================

export function createBeam(node, index) {
  const curve = curveOf(node.id)
  const len = visibleLength(node.id)
  const N = FX.beam.segments
  const pts = curve.getSpacedPoints(N)

  const half = FX.beam.width / 2
  const pos = new Float32Array((N + 1) * 2 * 3)
  const aT = new Float32Array((N + 1) * 2)
  const aSide = new Float32Array((N + 1) * 2)

  for (let i = 0; i <= N; i++) {
    const p = pts[i]
    const a = pts[Math.max(0, i - 1)]
    const b = pts[Math.min(N, i + 1)]
    let tx = b.x - a.x
    let ty = b.y - a.y
    const L = Math.hypot(tx, ty) || 1
    tx /= L
    ty /= L
    const nx = -ty // 法線
    const ny = tx
    const t = i / N
    for (const s of [0, 1]) {
      const sign = s === 0 ? 1 : -1
      const k = (i * 2 + s) * 3
      pos[k] = p.x + nx * half * sign
      pos[k + 1] = p.y + ny * half * sign
      pos[k + 2] = 0
      aT[i * 2 + s] = t
      aSide[i * 2 + s] = sign
    }
  }

  const idx = []
  for (let i = 0; i < N; i++) {
    const a = i * 2
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('aT', new THREE.BufferAttribute(aT, 1))
  geo.setAttribute('aSide', new THREE.BufferAttribute(aSide, 1))
  geo.setIndex(idx)

  // 拖尾長度用世界單位換算成路徑比例，九條線的彗星才會一樣長（可見長度差 5 倍以上）。
  const tailLen = Math.min(FX.beam.tailUnits / len, FX.beam.tailMaxFrac)
  const tailSpan = tailLen * 3.22 // exp 衰減到 0.04 需要 ln(25) ≈ 3.22 個 tailLen

  // 等速：九條線一律 FX.beam.speed，長線就飛久一點。短線靠 minCycle 拉長等待，
  // 不是把飛行時間拉長 —— 那樣短線會比長線慢。
  // 飛行距離是 1 + tailSpan（頭要多走 tailSpan 才能把尾巴帶出核心邊緣）。
  const travelSec = ((1 + tailSpan) * len) / FX.beam.speed
  const cycle = Math.max(travelSec / 0.7, FX.beam.minCycle)

  const mat = new THREE.ShaderMaterial({
    // COMETS 必須是編譯期常數（GLSL ES 100 的 for 迴圈上限不能是 uniform）
    defines: { COMETS: FX.beam.comets },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    // ⚠ 必須 DoubleSide：正交相機是 y 向下（top<bottom），投影矩陣的 y 為負，
    //    三角形環繞方向整個翻過來，用 FrontSide 會一個像素都畫不出來。
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    uniforms: {
      uTime: { value: 0 },
      // 0 = alpha 恆為 1。牆面的 canvas 是不透明的，維持原本行為（見 glow/shaders.js）。
      uAlphaLuma: { value: 0 },
      uCycle: { value: cycle },
      uTravel: { value: travelSec / cycle },
      uPhase: { value: (index * 0.37) % 1 },
      uProgress: { value: 0 },
      uOn: { value: 0 },
      uTailLen: { value: tailLen },
      uTailSpan: { value: tailSpan },
      uEndFade: { value: FX.beam.endFade / len },
      uBase: { value: FX.beam.base },
      uBaseSoft: { value: FX.beam.baseSoft },
      uBreathe: { value: 1 },
      uPeak: { value: FX.beam.peak },
      uHeadBoost: { value: FX.beam.headBoost },
      uHeadSharp: { value: FX.beam.headSharp },
      uCoreSharp: { value: FX.beam.coreSharp },
      uSoftSharp: { value: FX.beam.softSharp },
      uHead: { value: col(FX.color.head) },
      uBody: { value: col(FX.color.body) },
      uTail: { value: col(FX.color.tail) },
    },
  })

  const mesh = new THREE.Mesh(geo, mat)
  mesh.frustumCulled = false
  mesh.renderOrder = 2
  return {
    id: node.id, mesh, mat, curve, len, cycle,
    travel: travelSec / cycle,
    phase: (index * 0.37) % 1,
    drawSec: len / FX.drawSpeed,
  }
}
