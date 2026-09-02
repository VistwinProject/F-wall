import * as THREE from 'three'
import { col } from './stage.js'
import { FX } from '../config/fx.js'
import { curveOf, visibleLength } from './curves.js'

// ============================================================================
// 一條走線 = 一片沿曲線鋪出來的三角帶（ribbon），整條的外觀由 fragment shader 決定。
//
// 為什麼是 ribbon 而不是 Line：要在「橫剖面」上做柔邊（中心緊、邊緣散），
// bloom 才有東西可以吃。單純的線只有一個像素寬的核心，泛出來會很扁。
//
// ⚠ ribbon 蓋在【完整路徑】上（兩端伸進黑塊）。SVG 的黑塊畫在 canvas 之上會把兩端蓋掉，
//   所以彗星在等待期是隱形的（＝封包之間的間隔），抵達核心後也會被吃掉。
// ============================================================================

const VERT = /* glsl */ `
  attribute float aT;
  attribute float aSide;
  varying float vT;
  varying float vSide;
  void main() {
    vT = aT;
    vSide = aSide;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const FRAG = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform float uCycle;      // 一輪幾秒
  uniform float uTravel;     // 飛行佔一輪的比例，其餘時間整顆彗星在線外（不畫）
  uniform float uPhase;      // 九條線錯開用
  uniform float uTailSpan;   // 拖尾完全消失需要走多長（以路徑長為 1）
  uniform float uEndFade;    // 兩端各淡出多少（以路徑長為 1）
  uniform float uProgress;   // 「射向中樞」畫到哪了：0~1
  uniform float uOn;         // 整條的淡入淡出
  uniform float uTailLen;
  uniform float uBase;
  uniform float uBaseSoft;
  uniform float uBreathe;   // 呼吸倍率（每幀由 CPU 餵，九台共用同一個值）
  uniform float uPeak;
  uniform float uHeadBoost;
  uniform float uHeadSharp;
  uniform float uCoreSharp;
  uniform float uSoftSharp;
  uniform vec3  uHead;
  uniform vec3  uBody;
  uniform vec3  uTail;
  varying float vT;
  varying float vSide;

  // 一顆彗星在位置 vT 的亮度。
  //
  // prog < 0 = 這一輪還沒發射 → 整顆不畫（不是停在起點！路徑兩端就是黑塊邊緣，
  // 停在起點會變成一顆亮點杵在家電框邊上）。
  // 頭部從 0 掃到 1 + uTailSpan：掃過 1 之後頭已經出了核心邊緣不再畫，
  // 尾巴繼續往前掃出去，整條尾巴才會乾淨地沒入核心，而不是突然消失。
  float cometAt(float ph, float t) {
    float prog = (ph - (1.0 - uTravel)) / uTravel;
    if (prog < 0.0) return 0.0;
    float d = prog * (1.0 + uTailSpan) - t;    // > 0 表示在頭部後方
    if (d < 0.0) return 0.0;
    return max(0.0, (exp(-d / uTailLen) - 0.04) / 0.96);
  }

  void main() {
    // 同一條線上跑 COMETS 顆，相位平均錯開。取 max 而不是相加 ——
    // 兩顆疊在一起時相加會爆掉，看起來像一團白。
    float base = uTime / uCycle + uPhase;
    float trail = 0.0;
    for (int i = 0; i < COMETS; i++) {
      trail = max(trail, cometAt(fract(base + float(i) / float(COMETS)), vT));
    }

    // ── 橫剖面：中心緊、邊緣柔 ──────────────────────────────────────────────
    float cross = max(0.0, 1.0 - abs(vSide));
    float core = pow(cross, uCoreSharp);
    float soft = pow(cross, uSoftSharp);

    // ── 三階顏色：深藍 → 青 → 白 ───────────────────────────────────────────
    vec3 col = mix(uTail, uBody, smoothstep(0.0, 0.35, trail));
    col = mix(col, uHead, smoothstep(0.55, 1.0, trail));

    // 底光：感應期間整條線持續亮著，並隨呼吸緩慢明暗。
    // 亮芯 + 一點柔邊，只有柔邊的話整條線會糊成一條霧、看不出是「線」。
    float baseLit = uBase * uBreathe * (core + uBaseSoft * soft);

    // 頭部把亮度推過 1.0 —— 這一項就是 bloom 的來源，SVG 濾鏡做不到的地方。
    // ⚠ 彗星不乘呼吸：它是資料封包，跟著明暗會讀成訊號不穩。
    float amount =
      baseLit +
      uPeak * core * trail +
      uHeadBoost * core * pow(trail, uHeadSharp);

    // 兩端各淡出一小段：ribbon 是切在黑塊邊緣的，不淡的話會看到一條硬切邊。
    float ends = smoothstep(0.0, uEndFade, vT) * smoothstep(1.0, 1.0 - uEndFade, vT);

    amount *= ends * step(vT, uProgress) * uOn;
    gl_FragColor = vec4(col * amount, 1.0);
  }
`

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
