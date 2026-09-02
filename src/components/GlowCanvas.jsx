import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { APPLIANCES } from '../config/appliances.js'
import { FX } from '../config/fx.js'
import { createStage, contentRect } from '../webgl/stage.js'
import { createBeam } from '../webgl/TraceBeam.js'
import { createFrame, createBlockOutlines } from '../webgl/FrameLines.js'
import { createSparks } from '../webgl/Sparks.js'

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
    const sparks = createSparks()
    stage.scene.add(frame.group, outlines.group, sparks.points)

    const beams = APPLIANCES.map((n, i) => createBeam(n, i))
    for (const b of beams) stage.scene.add(b.mesh)

    // 每條線的狀態：on = 淡入淡出、progress = 射到哪了
    const state = beams.map((b) => ({ on: 0, progress: b.range.start, lastSpark: 0 }))

    let raf = 0
    let running = false
    let t0 = performance.now()
    let time = 0
    let pixelScale = 1

    const resize = () => {
      const r = contentRect(window.innerWidth, window.innerHeight)
      canvas.style.left = `${r.left}px`
      canvas.style.top = `${r.top}px`
      stage.resize(r.width, r.height)
      // 內部緩衝固定 1920×1080×dpr，所以「世界單位 → 緩衝像素」的比例是常數。
      pixelScale = FX.dpr
      sparks.mat.uniforms.uPixelScale.value = pixelScale
      request()
    }

    const tick = () => {
      const now = performance.now()
      const dt = Math.min(0.05, (now - t0) / 1000)
      t0 = now
      time += dt

      const set = activeRef.current
      let busy = false

      for (let i = 0; i < beams.length; i++) {
        const b = beams[i]
        const s = state[i]
        const want = set.has(b.id) ? 1 : 0
        s.on += (want - s.on) * Math.min(1, dt * EASE)
        // ⚠ 門檻要比下面 busy 的判斷（> 0.01）鬆，不然會停在 0.01 留下一絲永遠不熄的殘影
        if (Math.abs(want - s.on) < 0.02) s.on = want

        // 射向中樞：等速 FX.drawSpeed，從可見段的起點開始（前面那截藏在黑塊裡）
        if (want) {
          s.progress = Math.min(1, s.progress + dt / b.drawSec)
        } else {
          s.progress = b.range.start
        }

        b.mat.uniforms.uTime.value = time
        b.mat.uniforms.uOn.value = s.on
        b.mat.uniforms.uProgress.value = s.progress

        const gain = FX.frame.blockIdle + (FX.frame.blockOn - FX.frame.blockIdle) * s.on
        if (outlines.items[b.id]) outlines.items[b.id].uniforms.uGain.value = gain

        if (s.on > 0.01) {
          busy = true
          // 微粒：只在彗星頭真的在飛、而且已經跑出黑塊之後才灑
          const ph = (time / b.cycle + b.phase) % 1
          const head = Math.max(0, ph - (1 - b.travel)) / b.travel
          if (head > b.range.start && head < 1 && time - s.lastSpark > FX.sparks.every) {
            s.lastSpark = time
            const p = b.curve.getPointAt(Math.min(0.999, head))
            sparks.spawn(p.x, p.y, time)
          }
        }
      }

      // 核心框跟著「有沒有任何一張卡」亮
      const anyOn = state.reduce((m, s) => Math.max(m, s.on), 0)
      outlines.items.hub.uniforms.uGain.value =
        FX.frame.blockIdle + (FX.frame.blockOn - FX.frame.blockIdle) * anyOn

      sparks.mat.uniforms.uTime.value = time
      stage.render()

      if (busy) {
        raf = requestAnimationFrame(tick)
      } else {
        // 全部熄了：再畫一幀乾淨的（微粒清掉），然後停住
        sparks.clear(time)
        stage.render()
        running = false
        raf = 0
      }
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
    if (import.meta.env?.DEV) window.__glow = { stage, beams, state, frame, outlines, sparks, THREE, render: () => stage.render() }

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
