import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { VIEWBOX } from '../config/appliances.js'
import { FX } from '../config/fx.js'

// ============================================================================
// WebGL 舞台：正交相機 1:1 對上 SVG 的 viewBox。
//
// ⚠ 這是整個改動裡【唯一】會影響「牆上實體展品對位」的東西。
//   SVG 是 preserveAspectRatio="xMidYMid meet"，投影機不是 16:9 時內容會 letterbox，
//   所以 canvas 必須貼齊【SVG 的內容框】而不是整個視窗。contentRect() 就是在算這個。
//
// ⚠ 相機用 top=0 / bottom=1080 讓 y 向下，跟 SVG 同向 ——
//   這樣 appliances.js 的座標可以原封不動餵進來，不用任何換算。
// ============================================================================

// ⚠ 顏色一律用這個建，不要直接 new THREE.Color('#xxxxxx')。
//
//   因為 outputColorSpace 設成 Linear（見下方 createStage 的註解），整條管線等於
//   「不做色彩管理、值原樣顯示」。而 new THREE.Color('#7FE3FF') 會把 sRGB 轉成
//   linear，於是螢幕上看到的比你打的那個色碼暗一大截、而且背景會跟 CSS 的
//   letterbox 邊界對不起來（實測 canvas 內 (3,5,7) vs CSS 的 (22,24,29)）。
//   指定 LinearSRGBColorSpace 就是「不要轉」—— 打什麼色碼就顯示什麼。
export function col(hex) {
  return new THREE.Color().setHex(parseInt(hex.slice(1), 16), THREE.LinearSRGBColorSpace)
}

export function contentRect(w, h) {
  const s = Math.min(w / VIEWBOX.w, h / VIEWBOX.h)
  const cw = VIEWBOX.w * s
  const ch = VIEWBOX.h * s
  return { left: (w - cw) / 2, top: (h - ch) / 2, width: cw, height: ch, scale: s }
}

export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false, // 框架也在 canvas 裡，底下不需要透出任何東西 → 不透明，
    powerPreference: 'high-performance', // 也就完全避開「透明 canvas 上做 bloom」的 alpha 問題
    // ?glowdbg：讓畫布內容在 render 之後仍可讀，才能用 readPixels 量真實輸出。
    // 這是唯一能在小預覽窗裡「量」而不是「猜」的方法（1920 的畫布被縮到 408 顯示，
    // 3px 的亮芯只剩 0.6px，肉眼與截圖都看不出東西）。正式投影不會帶這個參數。
    preserveDrawingBuffer:
      typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('glowdbg'),
  })
  renderer.setClearColor(col(FX.bg), 1)
  // 不做 tone mapping：頭部超過 1.0 的部分直接夾成純白，亮度交給 bloom 表現。
  renderer.toneMapping = THREE.NoToneMapping

  // ⚠ 這一行是踩過坑才加的，不要「順手改回 SRGBColorSpace」。
  //   實測：three 把場景畫進 EffectComposer 的中繼緩衝時就已經編成 sRGB 了
  //   （即使把緩衝標成 srgb-linear 也一樣）。若這裡維持預設的 SRGBColorSpace，
  //   OutputPass 會再編一次 —— 背景 #16181D 的 22 會變成 83，整張畫布霧成一片灰。
  //   量到的數字：改前 (83,86,95)、改後 (24,28,35)，目標值 (22,24,29)。
  //   副作用：bloom 的 threshold 因此是作用在「顯示值」而不是物理線性值上，
  //   調參數時心裡有數就好，不影響外觀。
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace

  const scene = new THREE.Scene()
  // ⚠ top=0 / bottom=1080 讓 y 向下（與 SVG 同向），代價是投影矩陣的 y 是負的 ——
  //   三角形的環繞方向跟著翻，所有面都變成背面。所有材質因此【必須】用 DoubleSide，
  //   不然畫得出 draw call 卻一個像素都不會出現（這個坑花了很久才抓到）。
  const camera = new THREE.OrthographicCamera(0, VIEWBOX.w, 0, VIEWBOX.h, -1000, 1000)
  camera.position.z = 10

  const composer = new EffectComposer(renderer)
  composer.renderTarget1.texture.colorSpace = THREE.LinearSRGBColorSpace
  composer.renderTarget2.texture.colorSpace = THREE.LinearSRGBColorSpace
  composer.addPass(new RenderPass(scene, camera))
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(VIEWBOX.w, VIEWBOX.h),
    FX.bloom.strength,
    FX.bloom.radius,
    FX.bloom.threshold
  )
  composer.addPass(bloom)
  composer.addPass(new OutputPass())

  // ⚠ 內部緩衝固定 1920×1080（× FX.dpr），CSS 尺寸才跟著視窗走。
  //
  //   一開始是讓緩衝跟著 CSS 尺寸跑，結果在小視窗裡整張畫面糊成一片灰：
  //   1920 寬的版面被壓進 408px 時每條線只剩 1px，bloom 的粗 mip 把它們攤成一層霧。
  //   固定內部解析度之後，不管在多大的視窗看都跟投影機上一模一樣 ——
  //   bloom 的表現與視窗大小脫鉤，調參數才有意義。
  const BUF_W = VIEWBOX.w * FX.dpr
  const BUF_H = VIEWBOX.h * FX.dpr
  renderer.setSize(BUF_W, BUF_H, false)
  composer.setSize(BUF_W, BUF_H)

  const resize = (cssW, cssH) => {
    canvas.style.width = `${cssW}px`
    canvas.style.height = `${cssH}px`
  }

  return {
    renderer,
    scene,
    camera,
    composer,
    bloom,
    resize,
    render: () => composer.render(),
    dispose: () => {
      composer.dispose()
      renderer.dispose()
    },
  }
}
