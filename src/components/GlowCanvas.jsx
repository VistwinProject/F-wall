import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { APPLIANCES } from '../config/appliances.js'
import { FX } from '../config/fx.js'
import { createStage, contentRect } from '../webgl/stage.js'
import { createBeam } from '../webgl/TraceBeam.js'
import { createFrame, createBlockOutlines } from '../webgl/FrameLines.js'

// ============================================================================
// 牆面的「光」全部畫在這張 canvas 上：框架格線、家電框外圈、走線光束、彗星、微粒，
// 最後過 UnrealBloomPass。SVG（畫在這之上）只負責擋光的黑塊與要銳利的文字／面板。
//
// ⚠ canvas 必須貼齊 SVG 的【內容框】而不是整個視窗 —— SVG 是 xMidYMid meet，
//   投影機不是 16:9 時會 letterbox。對不上就等於牆上的實體展品全部位移。
//
// ⚠ 九台都沒 active 時 rAF 會停掉。canvas 上留著最後一幀（＝靜態框架），
//   idle 畫面完全靜止也不燒 GPU。
// ============================================================================

const EASE = 6 // 淡入淡出的收斂速率（每秒），數字越大越快

export default function GlowCanvas({ activeIds }) {
  const canvasRef = useRef(null)
  const apiRef = useRef(null)
  const activeRef = useRef(activeIds)
  activeRef.current = activeIds

  useEffect(() => {
    const canvas = canvasRef.current
    let stage
    try {
      stage = createStage(canvas)
    } catch (err) {
      // 沒有 WebGL 就安靜退場：黑塊與面板仍然正常，不要讓一顆 GPU 打掉整面牆。
      console.error('[GlowCanvas] WebGL 起不來，發光層停用：', err)
      canvas.style.display = 'none'
      return
    }

    const frame = createFrame()
    const outlines = createBlockOutlines()
    stage.scene.add(frame.group, outlines.group)

    const beams = APPLIANCES.map((n, i) => createBeam(n, i))
    for (const b of beams) stage.scene.add(b.mesh)

    // 每條線的狀態：on = 淡入淡出、progress = 射到哪了
    const state = beams.map(() => ({ on: 0, progress: 0 }))

    let raf = 0
    let running = false
    let t0 = performance.now()
    let time = 0
    const root = document.documentElement

    const resize = () => {
      const r = contentRect(window.innerWidth, window.innerHeight)
      canvas.style.left = `${r.left}px`
      canvas.style.top = `${r.top}px`
      stage.resize(r.width, r.height)
      request()
    }

    const tick = () => {
      const now = performance.now()
      const dt = Math.min(0.05, (now - t0) / 1000)
      t0 = now
      time += dt

      const set = activeRef.current
      let busy = false

      // 呼吸：走線底光與 active 的家電框共用同一個值 —— 九台同相位，
      // 讀起來是「一個系統在運轉」，而不是九個各自閃各自的。
      // 想讓九台錯開就把 time 換成 time + phaseOf(i) * period。
      const wave = (period, lo) =>
        lo + (1 - lo) * (0.5 + 0.5 * Math.cos((time * 2 * Math.PI) / period))
      const breathe = wave(FX.breathe.period, FX.breathe.lo)
      // 背景框架自己一組呼吸（3 秒），與家電／核心那組（1.5 秒）分開。
      // 兩者是 2:1，會週期性地對齊，讀起來像「快的疊在慢的上面」而不是各走各的。
      const frameGain = wave(FX.frame.breathe.period, FX.frame.breathe.lo)
      for (const m of frame.mats) m.uniforms.uGain.value = frameGain
      // ⚠ 同一個值也要餵給 SVG 那層的銳利白框。
      //   只讓 canvas 的光暈呼吸的話，上面壓著一條恆亮的硬白線 —— 主體不動，
      //   整體就讀成「光暈在旁邊閃」而不是「這個框在呼吸」，看起來很僵硬。
      //   用 CSS 變數傳，節奏的唯一來源仍然是這裡（不會又變成 CSS 與 JS 各有一份）。
      root.style.setProperty('--fx-breathe', breathe.toFixed(4))

      for (let i = 0; i < beams.length; i++) {
        const b = beams[i]
        const s = state[i]
        const want = set.has(b.id) ? 1 : 0
        s.on += (want - s.on) * Math.min(1, dt * EASE)
        // ⚠ 門檻要比下面 busy 的判斷（> 0.01）鬆，不然會停在 0.01 留下一絲永遠不熄的殘影
        if (Math.abs(want - s.on) < 0.02) s.on = want

        // 射向中樞：等速 FX.drawSpeed，從家電框邊緣掃到核心框邊緣
        s.progress = want ? Math.min(1, s.progress + dt / b.drawSec) : 0

        b.mat.uniforms.uTime.value = time
        b.mat.uniforms.uOn.value = s.on
        b.mat.uniforms.uProgress.value = s.progress
        b.mat.uniforms.uBreathe.value = breathe

        // 家電框：idle 時與格線同亮（背景框架是同一套東西），active 時提亮並跟著呼吸。
        const on = FX.frame.blockOn * breathe
        const g = FX.frame.blockIdle + (on - FX.frame.blockIdle) * s.on
        for (const m of outlines.items[b.id]) m.uniforms.uGain.value = g

        if (s.on > 0.01) busy = true
      }

      // 核心框跟著「有沒有任何一張卡」亮，並與九台同相位一起呼吸。
      // 沒感應時 hubIdle = 0 ＝ 全暗。
      const anyOn = state.reduce((m, s) => Math.max(m, s.on), 0)
      const hubGain = FX.frame.hubIdle + (FX.frame.blockOn * breathe - FX.frame.hubIdle) * anyOn
      for (const m of outlines.items.hub) m.uniforms.uGain.value = hubGain

      stage.render()

      // ⚠ 背景框架會一直呼吸，所以 rAF 不能再停 —— 以前「idle 就停住不燒 GPU」
      //   那個性質沒了。idle 時場景只剩框架（沒有光束、沒有彗星），實測仍是 60fps。
      //   真的要省，把 FX.frame.breathe.period 設成 0 再把這裡改回會停的版本。
      if (!busy) root.style.setProperty('--fx-breathe', '1')
      raf = requestAnimationFrame(tick)
    }

    const request = () => {
      if (running) return
      running = true
      t0 = performance.now()
      raf = requestAnimationFrame(tick)
    }

    const onLost = (e) => {
      e.preventDefault()
      console.error('[GlowCanvas] WebGL context lost —— 發光層停用，其餘照常')
      cancelAnimationFrame(raf)
      running = false
      canvas.style.display = 'none'
    }
    canvas.addEventListener('webglcontextlost', onLost)
    window.addEventListener('resize', resize)
    resize()
    stage.render() // idle 也要有一幀（靜態框架）

    apiRef.current = { request }
    // dev 用的除錯把手：主控台可以即時改參數再 __glow.render()
    if (import.meta.env?.DEV) window.__glow = { stage, beams, state, frame, outlines, THREE, render: () => stage.render() }

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      canvas.removeEventListener('webglcontextlost', onLost)
      stage.dispose()
    }
  }, [])

  // activeIds 一變就把迴圈叫醒（停住之後不會自己醒）
  useEffect(() => {
    apiRef.current?.request()
  }, [activeIds])

  return <canvas ref={canvasRef} className="glow-canvas" />
}
