import * as THREE from 'three'
import { col } from './stage.js'
import { FX } from '../config/fx.js'

// ============================================================================
// 彗星頭沿途灑出來的微粒。
//
// 固定容量的環狀緩衝：CPU 端每隔一小段時間在頭部位置寫入一顆（位置 + 出生時間），
// shader 依 (uTime - aBirth) 算壽命做縮放與淡出。約 400 顆，CPU 寫入可以忽略。
// 不做 GPU 端曲線取樣（要把每條曲線烘成 data texture），複雜度不值得。
// ============================================================================

const VERT = /* glsl */ `
  attribute float aBirth;
  attribute float aScale;
  uniform float uTime;
  uniform float uLife;
  uniform float uSize;
  varying float vLife;
  void main() {
    vLife = clamp((uTime - aBirth) / uLife, 0.0, 1.0);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    // 正交相機：gl_PointSize 直接用世界單位換算（螢幕像素 = 世界單位 × 縮放）
    gl_PointSize = uSize * aScale * (1.0 - vLife) * uPixelScale;
  }
`

const FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uHead;
  uniform vec3 uBody;
  uniform float uBright;
  varying float vLife;
  void main() {
    if (vLife >= 1.0) discard;
    vec2 uv = gl_PointCoord - 0.5;
    float r = length(uv) * 2.0;
    if (r > 1.0) discard;
    float g = pow(1.0 - r, 2.2);              // 圓形柔邊
    float fade = 1.0 - vLife;                  // 慢速消退
    vec3 col = mix(uHead, uBody, vLife);
    gl_FragColor = vec4(col * g * fade * uBright, 1.0);
  }
`

export function createSparks() {
  const n = FX.sparks.max
  const pos = new Float32Array(n * 3)
  const birth = new Float32Array(n).fill(-1e6) // 一開始全部都是「早就死掉」
  const scale = new Float32Array(n).fill(1)

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('aBirth', new THREE.BufferAttribute(birth, 1))
  geo.setAttribute('aScale', new THREE.BufferAttribute(scale, 1))
  geo.setDrawRange(0, n)

  const mat = new THREE.ShaderMaterial({
    vertexShader: 'uniform float uPixelScale;\n' + VERT,
    fragmentShader: FRAG,
    transparent: true,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    uniforms: {
      uTime: { value: 0 },
      uLife: { value: FX.sparks.life },
      uSize: { value: FX.sparks.size },
      uPixelScale: { value: 1 },
      uBright: { value: FX.sparks.bright },
      uHead: { value: col(FX.color.head) },
      uBody: { value: col(FX.color.body) },
    },
  })

  const points = new THREE.Points(geo, mat)
  points.frustumCulled = false
  points.renderOrder = 3

  let cursor = 0
  // 決定性的偽亂數：同一顆位置每次載入都一樣，不用 Math.random
  const rnd = (i) => {
    const s = Math.sin(i * 12.9898) * 43758.5453
    return s - Math.floor(s)
  }

  return {
    points,
    mat,
    spawn(x, y, time) {
      const i = cursor
      cursor = (cursor + 1) % n
      const a = rnd(i) * Math.PI * 2
      const rad = rnd(i + 7) * FX.sparks.spread
      pos[i * 3] = x + Math.cos(a) * rad
      pos[i * 3 + 1] = y + Math.sin(a) * rad
      pos[i * 3 + 2] = 0
      birth[i] = time
      scale[i] = 0.6 + rnd(i + 13) * 0.8
      geo.attributes.position.needsUpdate = true
      geo.attributes.aBirth.needsUpdate = true
      geo.attributes.aScale.needsUpdate = true
    },
    clear(time) {
      birth.fill(time - FX.sparks.life * 2)
      geo.attributes.aBirth.needsUpdate = true
    },
  }
}
