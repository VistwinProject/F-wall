import { useEffect, useRef, useState } from 'react'

// ============================================================================
// ?fps —— 現場量幀率用的小浮層（跟 ?all 同一套 debug flag 慣例，正式投影不帶）
//
// 為什麼需要它：牆面最貴的一刻是「九張卡同時感應、九個毛玻璃面板一起出現」，
// 而 backdrop-filter 的成本在開發機的隱藏預覽視窗量不到（rAF 會被節流到 ~1fps）。
// 這個浮層讓現場那台投影機自己把數字講出來：
//   FPS      最近一秒的平均
//   worst    最近一秒最長的一幀（ms）——卡頓看這個，不是看平均
//   drops    最近一秒超過 33ms（掉到 30fps 以下）的幀數
//
// 用法：投影網址加 ?fps（可與 ?all 併用 → ?all&fps 直接看九個面板全開的最壞情況）
// ============================================================================
export default function FpsMeter() {
  const [s, setS] = useState({ fps: 0, worst: 0, drops: 0 })
  const raf = useRef(0)

  useEffect(() => {
    let last = performance.now()
    let frames = []
    let acc = 0
    const tick = (now) => {
      const dt = now - last
      last = now
      frames.push(dt)
      acc += dt
      if (acc >= 1000) {
        const worst = Math.max(...frames)
        setS({
          fps: Math.round(1000 / (acc / frames.length)),
          worst: Math.round(worst),
          drops: frames.filter((d) => d > 33).length,
        })
        frames = []
        acc = 0
      }
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [])

  const bad = s.fps < 50 || s.drops > 2
  return (
    <div className={`fps-meter${bad ? ' fps-meter--bad' : ''}`}>
      {s.fps} fps · worst {s.worst}ms · drops {s.drops}
    </div>
  )
}
