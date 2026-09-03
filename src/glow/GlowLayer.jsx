import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createStage } from './stage.js'
import { createGlowLines, createGlowBeams } from './scene.js'
import { PARAMS } from './params.js'

// ============================================================================
// 發光層（通用版）—— 一張貼在容器上的 WebGL canvas，牆面那套光的 iPad / 桌面版。
//
// 用法：呼叫端給一個 build(world, px) 函式，回傳這一幀要畫的東西：
//   { lines: [{ id, pts, closed, always }], beams: [{ id, pts }] }
// pts 是【世界座標】—— world.w / world.h 由容器的寬高比決定（見 stage.js）。
// px 是容器的 CSS 尺寸，給「CSS 裡寫死 px 的東西」換算用
//   （例如桌面的 86px slot 圓環：world 半徑 = 43 * world.w / px.width）。
// 再給 activeIds（Set），發光層負責淡入淡出、呼吸、彗星發射。
//
// rebuildKey：幾何是在建場景時就烤進 ribbon 的（線粗、半徑、座標都是頂點資料），
// 光改 build 沒有用 —— 那些值變了要把這個字串換掉，場景才會重建。
// 平常留空即可；iPad 的調參面板（鍵盤 e）就是靠它即時反映。
//
// ⚠ canvas 是【透明】的，疊在容器最底層（z-index 0）。
//   平面圖、毛玻璃面板、文字全部畫在它之上 —— 與牆面同一個分層原則：
//   canvas 只負責「光」，要銳利的東西不要進來。
//
// ⚠ 這個檔案由 sync-tokens.mjs 從 F-wall 複製到 F-Ipad / F-table，不要單獨改。
// ============================================================================

const EASE = 6 // 淡入淡出的收斂速率（每秒）

export default function GlowLayer({ containerRef, build, activeIds, rebuildKey = '', className = 'glow-layer' }) {
  const canvasRef = useRef(null)
  // 重建場景的依據。寬高比決定世界形狀；寬度會影響「px 換算成世界單位」的比例，
  // 所以也要進 key —— 但取整到 8px 一階，拖視窗時不要每個像素都重建。
  const [key, setKey] = useState('')
  const pxRef = useRef({ width: 0, height: 0 })

  const buildRef = useRef(build)
  buildRef.current = build
  const activeRef = useRef(activeIds)
  activeRef.current = activeIds

  // ── 量容器 ────────────────────────────────────────────────────────────────
  // ⚠ containerRef 指的是【父層】的 div，而 React 的 commit 是深度優先：
  //   子元件的 useLayoutEffect 會在父層的 ref 掛上去【之前】就跑，
  //   第一次進來時 containerRef.current 常常還是 null。
  //   依賴陣列又不會因為 ref 物件而重跑，所以量不到就得自己排下一幀重試，
  //   否則畫布永遠停在預設的 300×150、什麼都不會畫（實際踩過）。
  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let ro = null
    let retry = 0

    const measure = () => {
      const el = containerRef.current
      if (!el) return false
      const r = el.getBoundingClientRect()
      if (r.width < 2 || r.height < 2) return false
      canvas.style.width = `${r.width}px`
      canvas.style.height = `${r.height}px`
      pxRef.current = { width: r.width, height: r.height }
      const a = Math.round((r.width / r.height) * 100) / 100
      const k = `${a}|${Math.round(r.width / 8)}`
      setKey((prev) => (prev === k ? prev : k))
      return true
    }

    const start = () => {
      if (!measure()) {
        // ⚠ 用 setTimeout 而不是 requestAnimationFrame —— 分頁在背景時 rAF 會被凍住，
        //   那樣發光層要等到分頁被看見才會初始化（查這個查了很久）。
        //   量版面本來也不需要對齊到影格。
        retry = setTimeout(start, 32)
        return
      }
      ro = new ResizeObserver(measure)
      ro.observe(containerRef.current)
    }
    start()

    return () => {
      clearTimeout(retry)
      ro?.disconnect()
    }
  }, [containerRef])

  // ── 舞台：只跟容器尺寸有關 ────────────────────────────────────────────────
  // ⚠ 舞台【不能】跟著 rebuildKey 重建。在同一張 canvas 上重複 new WebGLRenderer
  //   會留下前一個 context（Chrome 大約 16 個就開始強制回收最舊的），
  //   拖一次滑桿就重建一次的話很快就會掉 context。
  //   所以尺寸變 → 重建舞台；只有幾何變 → 只換場景內容（下一個 effect）。
  const stageRef = useRef(null)
  const [stageReady, setStageReady] = useState(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !key) return
    const aspect = parseFloat(key.split('|')[0])

    let stage
    try {
      stage = createStage(canvas, aspect, { transparent: true })
    } catch (err) {
      // 沒有 WebGL 就安靜退場：面板、文字、平面圖仍然正常，
      // 不要讓一顆 GPU 打掉整個畫面。
      console.error('[GlowLayer] WebGL 起不來，發光層停用：', err)
      canvas.style.display = 'none'
      return
    }
    stageRef.current = stage
    setStageReady((n) => n + 1)

    const onLost = (e) => {
      e.preventDefault()
      console.error('[GlowLayer] WebGL context lost —— 發光層停用，其餘照常')
      canvas.style.display = 'none'
    }
    canvas.addEventListener('webglcontextlost', onLost)

    return () => {
      canvas.removeEventListener('webglcontextlost', onLost)
      stageRef.current = null
      stage.dispose()
    }
  }, [key])

  // ── 場景內容 + 動畫迴圈 ───────────────────────────────────────────────────
  // 幾何是烤進 ribbon 頂點的（線粗、半徑、座標都是頂點資料），所以 rebuildKey
  // 一變就要整組重做 —— 但舞台留著。
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return

    const { lines = [], beams = [] } = buildRef.current(stage.world, pxRef.current) || {}
    const glowLines = createGlowLines(stage.world.w, lines)
    const glowBeams = createGlowBeams(stage.world.w, beams)
    stage.scene.add(glowLines.group)
    for (const b of glowBeams) stage.scene.add(b.mesh)

    // 每條線/每個環的狀態：on = 淡入淡出、progress = 射到哪了
    const beamState = glowBeams.map(() => ({ on: 0, progress: 0 }))
    const lineState = {}
    for (const it of lines) lineState[it.id] = { on: 0 }

    let raf = 0
    let time = 0
    let t0 = performance.now()

    const tick = () => {
      const now = performance.now()
      const dt = Math.min(0.05, (now - t0) / 1000)
      t0 = now
      time += dt

      const set = activeRef.current || new Set()
      const wave = (period, lo) =>
        lo + (1 - lo) * (0.5 + 0.5 * Math.cos((time * 2 * Math.PI) / period))
      // 全部同相位 —— 讀起來是「一個系統在運轉」，而不是各自閃各自的。
      const breathe = wave(PARAMS.breathe.period, PARAMS.breathe.lo)

      for (let i = 0; i < glowBeams.length; i++) {
        const b = glowBeams[i]
        const st = beamState[i]
        const want = set.has(b.id) ? 1 : 0
        st.on += (want - st.on) * Math.min(1, dt * EASE)
        // ⚠ 門檻要鬆一點，不然會停在 0.01 留下一絲永遠不熄的殘影
        if (Math.abs(want - st.on) < 0.02) st.on = want
        st.progress = want ? Math.min(1, st.progress + dt / b.drawSec) : 0
        b.mat.uniforms.uTime.value = time
        b.mat.uniforms.uOn.value = st.on
        b.mat.uniforms.uProgress.value = st.progress
        b.mat.uniforms.uBreathe.value = breathe
      }

      for (const it of lines) {
        const st = lineState[it.id]
        // 環的 id 若不在 activeIds 裡就維持 idle。always = 一直亮（例如靜態格線）。
        const want = it.always || set.has(it.id) ? 1 : 0
        st.on += (want - st.on) * Math.min(1, dt * EASE)
        if (Math.abs(want - st.on) < 0.02) st.on = want
        const on = PARAMS.line.on * breathe
        glowLines.gains[it.id](PARAMS.line.idle + (on - PARAMS.line.idle) * st.on)
      }

      stage.render()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      // ⚠ 一定要自己回收：調參面板拖一下滑桿就重建一次場景，
      //   不回收的話 GPU buffer 會一路累積上去。
      stage.scene.remove(glowLines.group)
      glowLines.group.traverse((o) => {
        o.geometry?.dispose()
        o.material?.dispose()
      })
      for (const b of glowBeams) {
        stage.scene.remove(b.mesh)
        b.mesh.geometry.dispose()
        b.mat.dispose()
      }
    }
    // ⚠ activeIds 走 ref，不進依賴 —— 每次刷卡都重建場景會把彗星的相位
    //   打回原點，看起來像整組線閃一下。
  }, [stageReady, rebuildKey])

  return <canvas ref={canvasRef} className={className} />
}
