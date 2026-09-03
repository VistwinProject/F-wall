import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { PARAMS } from './params.js'

// ============================================================================
// WebGL 舞台（通用版）—— 牆面 webgl/stage.js 的參數化版本，給 iPad 與桌面用。
//
// 牆面那支的世界固定是 SVG 的 viewBox 1920×1080；這一支的世界由呼叫端給，
// 因為 iPad 與桌面的「舞台」是一個【會隨裝置變形的 DOM 容器】，不是固定 viewBox。
//
// 世界的定義（兩端都一樣，很重要）：
//   寬固定 PARAMS.refWidth，高 = refWidth / 容器的寬高比。
//   容器上任何一個「百分比座標」乘上去就是世界座標。
//   這樣做的好處是 x 與 y 同一把尺 —— ribbon 的寬度、彗星的速度才不會因為
//   容器變形而在橫向與縱向不一樣（CSS 版就是敗在這裡，只能用 drop-shadow 硬湊）。
//
// ⚠ 這個檔案由 sync-tokens.mjs 從 F-wall 複製到 F-Ipad / F-table，不要單獨改。
// ============================================================================

// ⚠ 顏色一律用這個建，不要直接 new THREE.Color('#xxxxxx')。
//   因為 outputColorSpace 是 Linear（見下方註解），整條管線等於「不做色彩管理、
//   值原樣顯示」。而 new THREE.Color('#7FE3FF') 會把 sRGB 轉成 linear，
//   螢幕上看到的會比色碼暗一大截，而且背景會跟 CSS 對不起來。
export function col(hex) {
  return new THREE.Color().setHex(parseInt(hex.slice(1), 16), THREE.LinearSRGBColorSpace)
}

/**
 * @param canvas  掛載的 <canvas>
 * @param aspect  容器的寬 / 高。世界大小由它決定（見檔頭）。
 * @param opts.transparent  true = canvas 透明（底下要透出東西時用）。
 *        牆面是 false（框架也在 canvas 裡，底下不需要透出任何東西），
 *        iPad / 桌面是 true —— 平面圖、毛玻璃面板都在 canvas 之外，
 *        canvas 只負責「光」，所以必須讓底下透出來。
 */
// 內部緩衝的像素預算。⚠ 用【面積】固定，不是用寬度固定。
//
// 一開始是 W = refWidth、H = refWidth / aspect。容器一旦變得又窄又高
// （例如視窗縮到資訊面板把中樞區擠成一條），H 會爆掉 —— 實測 aspect 0.24
// 時緩衝變成 1600×6667＝10.6 MP，幀時間掉到 21ms，而且 UnrealBloomPass 的
// 橫向／縱向模糊是各自相對於 resolution.x / y 的，非方形緩衝會把光暈拉成直立的橢圓。
// 固定面積之後不管容器多怪，緩衝都維持在 1.6 MP 上下。
const AREA = (PARAMS.refWidth * PARAMS.refWidth) / 1.6 // ≈ 1600×1000

export function createStage(canvas, aspect, { transparent = true } = {}) {
  const H = Math.round(Math.sqrt(AREA / aspect))
  const W = Math.round(H * aspect)

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: transparent,
    // ⚠ 必須是 true（＝ WebGL 預設）。shader 現在輸出的 alpha 是「該像素的亮度」
    //   （見 shaders.js 的 uAlphaLuma），色值本身沒有再除以 alpha ——
    //   那正是「已預乘」的形式。設成 false 的話瀏覽器合成時會再乘一次 alpha，
    //   暗的地方等於被平方，整層光會明顯變暗（實際踩過）。
    premultipliedAlpha: true,
    powerPreference: 'high-performance',
  })
  // 透明時 clear alpha = 0；不透明時填背景色。
  renderer.setClearColor(col(PARAMS.bg), transparent ? 0 : 1)
  // 不做 tone mapping：彗星頭超過 1.0 的部分直接夾成純白，亮度交給 bloom 表現。
  renderer.toneMapping = THREE.NoToneMapping

  // ⚠ 不要「順手改回 SRGBColorSpace」。three 把場景畫進 EffectComposer 的中繼緩衝時
  //   就已經編成 sRGB 了，這裡若維持預設，OutputPass 會再編一次 —— 整張畫布會霧成一片灰。
  //   （牆面 webgl/stage.js 有量到的數字，那段註解是同一個坑。）
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace

  const scene = new THREE.Scene()
  // ⚠ top=0 / bottom=H 讓 y 向下（與 CSS / SVG 同向），代價是投影矩陣的 y 是負的 ——
  //   三角形環繞方向跟著翻，所有材質【必須】用 DoubleSide，
  //   不然畫得出 draw call 卻一個像素都不會出現。
  const camera = new THREE.OrthographicCamera(0, W, 0, H, -1000, 1000)
  camera.position.z = 10

  const composer = new EffectComposer(renderer)
  composer.renderTarget1.texture.colorSpace = THREE.LinearSRGBColorSpace
  composer.renderTarget2.texture.colorSpace = THREE.LinearSRGBColorSpace
  composer.addPass(new RenderPass(scene, camera))
  const B = PARAMS.bloom
  const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), B.strength, B.radius, B.threshold)
  // ⚠ 預設 0.01 等於硬切，呼吸時泛光會一頓一頓地冒出來。
  bloom.highPassUniforms.smoothWidth.value = B.softKnee
  composer.addPass(bloom)
  composer.addPass(new OutputPass())

  // ⚠ 內部緩衝固定【面積】，CSS 尺寸才跟著容器走。
  //   若讓緩衝跟著 CSS 尺寸跑，小視窗裡每條線只剩 1px，bloom 的粗 mip 會把它們
  //   攤成一層霧；固定之後不管在多大的視窗看都一樣，調參數才有意義。
  renderer.setSize(W * PARAMS.dpr, H * PARAMS.dpr, false)
  composer.setSize(W * PARAMS.dpr, H * PARAMS.dpr)

  return {
    renderer,
    scene,
    camera,
    composer,
    world: { w: W, h: H },
    /** 把 canvas 貼齊容器（CSS 尺寸，與內部緩衝無關）。 */
    fit: (cssW, cssH) => {
      canvas.style.width = `${cssW}px`
      canvas.style.height = `${cssH}px`
    },
    render: () => composer.render(),
    dispose: () => {
      composer.dispose()
      renderer.dispose()
    },
  }
}
