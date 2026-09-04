import * as THREE from 'three'
import { APPLIANCES } from '../config/appliances.js'
import { col } from './stage.js'
import { FX } from '../config/fx.js'
// ⚠ 幾何一律從 wallTuning 讀（見該檔案的說明）。沒有覆寫時就是 frame.js /
//   appliances.js 的原值，畫出來與改之前逐字相同。
import {
  blockOf, frameGeom, frameLineWidth, hLines, vLines, HUB_ID,
} from '../config/wallTuning.js'
import { roundedRectPoints } from './curves.js'
import { RADIUS } from '../config/theme.js'
// ⚠ shader 與 ribbon 已經抽到 glow/ —— 那是三端共用的單一份，iPad 與桌面 import 同一個檔案。
import { LINE_VERT as VERT, LINE_FRAG as FRAG } from '../glow/shaders.js'
import { ribbon } from '../glow/ribbon.js'

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
      // 0 = alpha 恆為 1。牆面的 canvas 是不透明的，維持原本行為（見 glow/shaders.js）。
      uAlphaLuma: { value: 0 },
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
//
// ⚠ 而且要對齊到【偶數】，不是整數就好。
//   UnrealBloomPass 的第一層降採樣是 1/2 解析度，落在奇數座標的線會剛好對上
//   半解析度的紋素中心、能量被集中起來，泛光比偶數座標的線強 6 成。
//   實測（關 bloom 時每條線都是「峰 631 / 暈總量 2294」完全相同）：
//     開 bloom 後 y=335（奇）暈總量 3839、x=1435（奇）3801，
//     而 y=550 / x=1600 / 大框頂（偶）只有 2353 / 2377 / 2351。
//   全框架只有 x=1435、y=335、大框下緣 y=1033 是奇數 —— 正好就是看起來比較亮的那三條。
//   對齊到偶數之後它們各位移 1 單位（1920 畫布上看不出來），泛光就一致了。
const snap = (v) => 2 * Math.round(v / 2)

// 大框 + 正交格線。完全靜態。
export function createFrame() {
  const group = new THREE.Group()
  // [暈層, 芯層] —— 順序就是繪製順序
  const mats = [material(1, 'halo'), material(1, 'core')]
  const { x, y, w, h, r } = frameGeom()
  const lw = frameLineWidth()
  const add = (pts, closed = false) => twoLayer(group, ribbon(pts, lw, closed), mats, 0)
  const x0 = snap(x), y0 = snap(y), x1 = snap(x + w), y1 = snap(y + h)
  for (const vx of vLines()) add([V(snap(vx), y0), V(snap(vx), y1)])
  for (const hy of hLines()) add([V(x0, snap(hy)), V(x1, snap(hy))])
  add(roundedRectPoints((x0 + x1) / 2, (y0 + y1) / 2, x1 - x0, y1 - y0, r), true)
  return { group, mats }
}

// 十一個黑塊的外圈（九台家電 + 核心 + 電視預留區）。
// 家電與核心的 gain 會隨 active 變化，電視預留區固定 idle。
export function createBlockOutlines() {
  const group = new THREE.Group()
  const items = {}
  const lw = frameLineWidth()
  const make = (cx, cy, w, h, r, key, gain) => {
    const mats = [material(gain, 'halo'), material(gain, 'core')]
    twoLayer(group, ribbon(roundedRectPoints(cx, cy, w, h, r), lw, true), mats, 1)
    items[key] = mats
  }
  for (const n of APPLIANCES) {
    const b = blockOf(n.id)
    make(b.x, b.y, b.w, b.h, RADIUS.sm, n.id, FX.frame.blockIdle)
  }
  const hub = blockOf(HUB_ID)
  make(hub.x, hub.y, hub.w, hub.h, RADIUS.sm, HUB_ID, FX.frame.hubIdle)
  return { group, items }
}
