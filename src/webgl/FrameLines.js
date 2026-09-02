import * as THREE from 'three'
import { FRAME, VLINES, HLINES } from '../config/frame.js'
import { APPLIANCES, HUB } from '../config/appliances.js'
import { col } from './stage.js'
import { FX } from '../config/fx.js'
import { roundedRectPoints } from './curves.js'
import { RADIUS } from '../config/theme.js'

// ============================================================================
// 框架格線 + 家電框 / 核心框的「外圈發光」。
//
// 與走線共用同一個 bloom，所以整面牆的光是同一種光 —— 這是把框架一起搬進 WebGL 的理由。
// 舊版框架是 SVG 的三層 dilate→blur→衰減，為了 8-bit 的色帶問題調過好幾輪；
// bloom 在 half-float buffer 裡做，那一整類問題直接消失。
//
// ⚠ 家電框與核心框在這裡只畫【發光的外圈】。SVG 上層會再蓋一次純黑底 + 銳利白框，
//   所以往框內溢的光全部被蓋掉 —— 投影機的黑 = 不出光，實體展品不會被打亮。
// ============================================================================

const VERT = /* glsl */ `
  attribute float aSide;
  varying float vSide;
  void main() {
    vSide = aSide;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uColor;
  uniform float uAmp;       // 這一層的亮度（芯層用 core、光暈層用 soft）
  uniform float uSharp;     // 這一層的收斂指數
  uniform float uGain;      // 整體倍率：家電框 active 時拉高、呼吸也乘在這裡
  varying float vSide;
  void main() {
    float cross = max(0.0, 1.0 - abs(vSide));
    gl_FragColor = vec4(uColor * uAmp * pow(cross, uSharp) * uGain, 1.0);
  }
`

// 沿一串點鋪三角帶。與 TraceBeam 同樣的作法，只是不需要沿線的 t。
function ribbon(points, width, closed = false) {
  const pts = closed ? [...points, points[0]] : points
  const n = pts.length
  const half = width / 2
  const pos = new Float32Array(n * 2 * 3)
  const aSide = new Float32Array(n * 2)
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
  geo.setIndex(idx)
  return geo
}

// 每條線畫兩層，因為「不要在交叉點爆亮」與「光暈要完整」需要不同的混色方式：
//
//   芯層  MAX  —— 8 垂直 × 4 水平 = 32 個交叉點，用加法會讓每個交叉點亮兩倍，
//                 整片背景框架的亮度就不統一。MAX 取較亮者，重疊處與單獨一條線一樣亮。
//   暈層  加法 —— ⚠ 光暈【不能】用 MAX：MAX 算的是 max(光暈, 背景)，
//                 於是所有比背景 #16181D 還暗的外圈全部被丟掉，光暈被砍成一條
//                 6 單位寬的硬邊帶（實測剖面 …87,90,113,155,265,626,626,265,155,114,90,87…
//                 之後就直接是背景 82）。改加法之後才是完整的連續衰減
//                 （…157,177,201,227,260,310,426,714,714,426,310,261,227,201,177…）。
//                 暈層在交叉點會相加，但它只有 0.3，比芯的 1.35 溫和得多。
function material(gain, kind) {
  const halo = kind === 'halo'
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    // ⚠ 必須 DoubleSide：正交相機是 y 向下（top<bottom），投影矩陣的 y 為負，
    //    三角形環繞方向整個翻過來，用 FrontSide 會一個像素都畫不出來。
    side: THREE.DoubleSide,
    ...(halo
      ? { blending: THREE.AdditiveBlending }
      : {
          blending: THREE.CustomBlending,
          blendEquation: THREE.MaxEquation,
          blendSrc: THREE.OneFactor,
          blendDst: THREE.OneFactor,
        }),
    depthWrite: false,
    depthTest: false,
    uniforms: {
      uColor: { value: col(FX.color.line) },
      uAmp: { value: halo ? FX.frame.soft : FX.frame.core },
      uSharp: { value: halo ? FX.frame.softSharp : FX.frame.coreSharp },
      uGain: { value: gain },
    },
  })
}

// 一條線 = 共用同一份 geometry 的兩個 mesh（暈層先畫、芯層後畫）。
function twoLayer(group, geo, mats, order) {
  for (let i = 0; i < 2; i++) {
    const m = new THREE.Mesh(geo, mats[i])
    m.frustumCulled = false
    m.renderOrder = order * 2 + i
    group.add(m)
  }
}

const V = (x, y) => new THREE.Vector3(x, y, 0)

// 軸對齊的線要對齊到同一個像素相位，否則同樣的設定會畫出兩種粗細與亮度。
//
// ⚠ 實測踩過：大框的上下緣在 y=47.5 / 1032.5（半整數）＝ 正好落在【像素中心】，
//   峰值全部集中在一個像素上（剖面 81 / 263 / 742 / 263 / 81）；
//   而格線與大框左右緣都是整數 ＝ 落在【像素邊界】，峰值被兩個像素平分
//   （剖面 141 / 493 / 493 / 141）。於是只有上下兩條看起來又亮又銳利。
//   這不是亮度設定的問題，是取樣相位的問題 —— 所以在這裡統一四捨五入到整數，
//   讓所有線都跟格線同一個相位。
// ⚠ 內部緩衝固定 1920×1080（FX.dpr = 1），所以「整數 = 像素邊界」成立。
//   dpr 改成非 1 的話這裡要跟著換算。
// ⚠ 只有大框與格線這樣做。家電框／核心框的外圈不能動 —— 它們必須與 SVG 黑塊
//   的邊界對齊，差 0.5 就會露出來。
const snap = (v) => Math.round(v)

// 大框 + 正交格線。完全靜態。
export function createFrame() {
  const group = new THREE.Group()
  // [暈層, 芯層] —— 順序就是繪製順序
  const mats = [material(1, 'halo'), material(1, 'core')]
  const { x, y, w, h, r } = FRAME
  const add = (pts, closed = false) => twoLayer(group, ribbon(pts, FX.frame.width, closed), mats, 0)
  const x0 = snap(x), y0 = snap(y), x1 = snap(x + w), y1 = snap(y + h)
  for (const vx of VLINES) add([V(snap(vx), y0), V(snap(vx), y1)])
  for (const hy of HLINES) add([V(x0, snap(hy)), V(x1, snap(hy))])
  add(roundedRectPoints((x0 + x1) / 2, (y0 + y1) / 2, x1 - x0, y1 - y0, r), true)
  return { group, mats }
}

// 十一個黑塊的外圈（九台家電 + 核心 + 電視預留區）。
// 家電與核心的 gain 會隨 active 變化，電視預留區固定 idle。
export function createBlockOutlines() {
  const group = new THREE.Group()
  const items = {}
  const make = (cx, cy, w, h, r, key, gain) => {
    const mats = [material(gain, 'halo'), material(gain, 'core')]
    twoLayer(group, ribbon(roundedRectPoints(cx, cy, w, h, r), FX.frame.width, true), mats, 1)
    items[key] = mats
  }
  for (const n of APPLIANCES) make(n.x, n.y, n.w, n.h, RADIUS.sm, n.id, FX.frame.blockIdle)
  make(HUB.x, HUB.y, HUB.w, HUB.h, RADIUS.sm, 'hub', FX.frame.hubIdle)
  return { group, items }
}
