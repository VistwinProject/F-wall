import * as THREE from 'three'
import { LINE_VERT, LINE_FRAG, BEAM_VERT, BEAM_FRAG } from './shaders.js'
import { ribbon } from './ribbon.js'
import { col } from './stage.js'
import { PARAMS } from './params.js'

// ============================================================================
// 場景組件（通用版）—— 把「一堆折線」變成牆面那種發光的線與走線彗星。
//
// 牆面的 webgl/FrameLines.js 與 webgl/TraceBeam.js 是綁死牆面幾何的版本；
// 這一支只收折線陣列，所以 iPad 的節點外圈、桌面的 slot 圓環、兩端的連線
// 都能用同一組 shader 畫出來。
//
// ⚠ 這個檔案由 sync-tokens.mjs 從 F-wall 複製到 F-Ipad / F-table，不要單獨改。
// ============================================================================

// ── 發光線（節點外圈、中樞環、靜態格線）────────────────────────────────────
//
// 每條線畫兩層，因為「不要在交叉點爆亮」與「光暈要完整」需要不同的混色方式：
//   芯層 MAX  —— 交叉點用加法會亮兩倍，整組線的亮度就不統一。
//                MAX 取較亮者，重疊處與單獨一條線一樣亮。
//   暈層 加法 —— ⚠ 光暈【不能】用 MAX：那會算成 max(光暈, 背景)，
//                比背景暗的外圈全部被丟掉，光暈被砍成一條硬邊帶。
function lineMaterial(worldW, gain, kind) {
  const halo = kind === 'halo'
  return new THREE.ShaderMaterial({
    vertexShader: LINE_VERT,
    fragmentShader: LINE_FRAG,
    transparent: true,
    // ⚠ 必須 DoubleSide，見 stage.js 的相機註解。
    side: THREE.DoubleSide,
    // ⚠ 不能用 THREE.AdditiveBlending —— 它是 (SrcAlpha, One)，而這裡的 alpha
    //   已經改成「跟著亮度」，再乘一次等於把光暈平方掉。
    //   改成 (One, One) 的預乘式加法：顏色的疊加方式與原本完全相同，
    //   同時讓 alpha 也正確累加，透明 canvas 才不會被 idle 的線蓋成黑帶。
    ...(halo
      ? {
          blending: THREE.CustomBlending,
          blendEquation: THREE.AddEquation,
          blendSrc: THREE.OneFactor,
          blendDst: THREE.OneFactor,
        }
      : {
          blending: THREE.CustomBlending,
          blendEquation: THREE.MaxEquation,
          blendSrc: THREE.OneFactor,
          blendDst: THREE.OneFactor,
        }),
    depthWrite: false,
    depthTest: false,
    uniforms: {
      uColor: { value: col(PARAMS.color.line) },
      // 1 = alpha 跟著亮度（透明 canvas 必須這樣，見 shaders.js 的說明）
      uAlphaLuma: { value: 1 },
      uAmp: { value: halo ? PARAMS.line.soft : PARAMS.line.core },
      uSharp: { value: halo ? PARAMS.line.softSharp : PARAMS.line.coreSharp },
      uGain: { value: gain },
    },
  })
}

/**
 * @param worldW  世界寬度（線寬是它的比例，見 PARAMS.line.width）
 * @param items   [{ id, pts, closed, width? }]，pts 是世界座標的 {x,y} 陣列。
 *                width 是「世界寬的比例」，不給就用 PARAMS.line.width
 *                （iPad 的調參面板會逐項覆寫）。
 * @returns { group, gains: { [id]: (v) => void } }
 */
export function createGlowLines(worldW, items) {
  const group = new THREE.Group()
  const gains = {}

  for (const it of items) {
    const geo = ribbon(it.pts, (it.width ?? PARAMS.line.width) * worldW, !!it.closed)
    const mats = [lineMaterial(worldW, PARAMS.line.idle, 'halo'), lineMaterial(worldW, PARAMS.line.idle, 'core')]
    // 暈層先畫、芯層後畫
    for (let i = 0; i < 2; i++) {
      const m = new THREE.Mesh(geo, mats[i])
      m.frustumCulled = false
      m.renderOrder = i
      group.add(m)
    }
    gains[it.id] = (v) => {
      mats[0].uniforms.uGain.value = v
      mats[1].uniforms.uGain.value = v
    }
  }
  return { group, gains }
}

// ── 走線彗星 ────────────────────────────────────────────────────────────────
/**
 * @param worldW  世界寬度
 * @param items   [{ id, pts, width? }]，pts 是世界座標的 {x,y} 陣列。
 *                ⚠ 順序＝流動方向：pts[0] → pts[n-1]。牆面是「家電 → 中樞」。
 *                width 是「世界寬的比例」，不給就用 PARAMS.beam.width。
 */
export function createGlowBeams(worldW, items) {
  const speed = PARAMS.beam.speed * worldW
  const tailUnits = PARAMS.beam.tailWidths * worldW

  return items.map((it, index) => {
    const geo = ribbon(it.pts, (it.width ?? PARAMS.beam.width) * worldW, false)
    const len = geo.userData.length || 1

    // ── 以下三行與牆面 webgl/TraceBeam.js 完全相同 ──
    // 拖尾用世界單位換算成路徑比例，長短線的彗星看起來才會一樣長。
    const tailLen = Math.min(tailUnits / len, PARAMS.beam.tailMaxFrac)
    const tailSpan = tailLen * 3.22 // exp 衰減到 0.04 需要 ln(25) ≈ 3.22 個 tailLen
    // 等速：所有線同速，長線自然飛久一點。短線靠 minCycle 拉長等待而不是拉長飛行。
    const travelSec = ((1 + tailSpan) * len) / speed
    const cycle = Math.max(travelSec / 0.7, PARAMS.beam.minCycle)

    const mat = new THREE.ShaderMaterial({
      // COMETS 必須是編譯期常數（GLSL ES 100 的 for 迴圈上限不能是 uniform）
      defines: { COMETS: PARAMS.beam.comets },
      vertexShader: BEAM_VERT,
      fragmentShader: BEAM_FRAG,
      transparent: true,
      side: THREE.DoubleSide,
      // 同上：預乘式加法，不要用 AdditiveBlending。
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      depthWrite: false,
      depthTest: false,
      uniforms: {
        uTime: { value: 0 },
        uAlphaLuma: { value: 1 },
        uCycle: { value: cycle },
        uTravel: { value: travelSec / cycle },
        // 定值相位，不用 Math.random —— 每次載入都要一樣。
        uPhase: { value: (index * 0.37) % 1 },
        uProgress: { value: 0 },
        uOn: { value: 0 },
        uTailLen: { value: tailLen },
        uTailSpan: { value: tailSpan },
        uEndFade: { value: (PARAMS.beam.endFadeWidths * worldW) / len },
        uBase: { value: PARAMS.beam.base },
        uBaseSoft: { value: PARAMS.beam.baseSoft },
        uBreathe: { value: 1 },
        uPeak: { value: PARAMS.beam.peak },
        uHeadBoost: { value: PARAMS.beam.headBoost },
        uHeadSharp: { value: PARAMS.beam.headSharp },
        uCoreSharp: { value: PARAMS.beam.coreSharp },
        uSoftSharp: { value: PARAMS.beam.softSharp },
        uHead: { value: col(PARAMS.color.head) },
        uBody: { value: col(PARAMS.color.body) },
        uTail: { value: col(PARAMS.color.tail) },
      },
    })

    const mesh = new THREE.Mesh(geo, mat)
    mesh.frustumCulled = false
    // 點亮時「射向中樞」要走幾秒
    const drawSec = len / (PARAMS.beam.drawSpeed * worldW)
    return { id: it.id, mesh, mat, drawSec }
  })
}
