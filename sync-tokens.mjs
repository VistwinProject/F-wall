#!/usr/bin/env node
// ============================================================================
// 把三端共用的視覺 token 從【單一來源】推到三個 CSS 檔。
//
//   單一來源：F-wall/src/config/fx.js 的 SHARED
//   產生目標：三個 style(s).css 裡 `GLOW-TOKENS:BEGIN … END` 之間的內容
//
// 用法（在這個 repo 的根目錄）：
//   node sync-tokens.mjs          寫入
//   node sync-tokens.mjs --check  只檢查有沒有飄掉，不寫入（飄掉就 exit 1）
//
// ⚠ 這支腳本會寫到【隔壁兩個 repo】。它預期三個專案是並排的同層資料夾：
//
//     <任意上層>/
//       ├── F-wall/     ← 這個 repo（共用程式碼的原稿在這）
//       ├── F-Ipad/
//       └── F-table/
//
//   只 clone 了 F-wall 的話這支腳本沒有東西可以同步，它會直接報錯說明。
//
// ⚠ 這支腳本是【開發時】用的。產生出來的 CSS 與 glow/ 都會簽入各自的版本，
//   三個資料夾各自完整，單獨複製到展場電腦照樣跑得起來，現場永遠不需要執行它。
// ============================================================================
import { readFile, writeFile, readdir, mkdir, access } from 'node:fs/promises'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

// 腳本住在 F-wall/，但要寫到三個並排的專案 → 基準點是 F-wall 的上一層。
const HERE = dirname(fileURLToPath(import.meta.url))   // …/F-wall
const ROOT = join(HERE, '..')                          // …/  三個專案的共同上層
const SRC  = 'F-wall/src/config/fx.js'                 // 只給訊息用（相對 ROOT）

// 隔壁兩個專案不在就別跑 —— 否則會安靜地建出一堆空資料夾。
for (const need of ['F-Ipad/src', 'F-table/web/src']) {
  try {
    await access(join(ROOT, need))
  } catch {
    console.error(`✗ 找不到 ${join(ROOT, need)}`)
    console.error('')
    console.error('  這支腳本要三個專案並排放才能同步：')
    console.error('    <上層>/F-wall  ← 你在這')
    console.error('    <上層>/F-Ipad')
    console.error('    <上層>/F-table')
    console.error('')
    console.error('  只 clone 了 F-wall 的話，把另外兩個也 clone 到同一層再跑一次。')
    process.exit(1)
  }
}

const { SHARED: S, FX } = await import(new URL('src/config/fx.js', import.meta.url).href)
const { VIEWBOX } = await import(new URL('src/config/appliances.js', import.meta.url).href)

const BEGIN = '/* GLOW-TOKENS:BEGIN'
const END   = '/* GLOW-TOKENS:END */'

// rgba() 字串。⚠ 小數點後補到跟來源一致，避免每次跑出來的字串不穩定。
const rgba = ({ rgb: [r, g, b] }, a) => `rgba(${r}, ${g}, ${b}, ${a})`
const white = (a) => `rgba(255, 255, 255, ${a})`

const G = S.glass
// 牆面把「玻璃」與「邊緣高光」拆成兩個 DOM 元素（那是為了讓 opacity 動畫不觸發
// backdrop-filter 重算）；iPad / 桌面的高光是靜態的，合併成單一元素，
// 所以邊框色 = rim 的顏色乘上 rim 的 opacity。
const mergedBorderA = +(S.rim.a * G.rimOpacity).toFixed(3)

const BODY = `
  /* ── 光：淡藍發光線段 ── */
  --wall-bg:          ${S.bg};
  --glow:             ${S.line};
  --glow-core:        ${S.core};
  --glow-beam:        ${S.beam};
  --glow-deep:        ${S.deep};
  --glow-head:        ${S.head};
  --glow-rim:         ${rgba(S.rim, S.rim.a)};
  --glow-halo:        ${rgba(S.halo, S.halo.a)};
  --glow-dim:         ${rgba(S.halo, S.dim)};

  /* ── 毛玻璃面板 ── */
  --glass-bg:         ${white(G.bg)};
  --glass-bg-2:       ${white(G.bg2)};
  --glass-blur:       blur(${G.blur}px) saturate(${G.saturate});
  --glass-border:     ${rgba(S.rim, mergedBorderA)};
  --glass-border-2:   ${rgba(S.rim, 0.2)};
  --glass-border-flat: ${white(G.plainBorder)};
  --glass-shadow:
    0 10px 30px rgba(0, 0, 0, 0.55),
    0 0 ${G.haloBlur}px ${rgba(S.halo, +(S.halo.a * G.rimOpacity).toFixed(3))},
    inset 0 1px 0 ${white(0.42)},
    inset 0 0 12px ${white(0.08)};
  --glass-shadow-2:
    0 6px 18px rgba(0, 0, 0, 0.45),
    inset 0 1px 0 ${white(0.16)};

  /* ⚠ 走線彗星與光暈濾鏡的 CSS 變數已經拿掉 —— 那些光現在全部由 WebGL 發光層畫，
     參數在 glow/params.js（同樣由這支腳本從 FX 產生）。 */
`.replace(/\n$/, '')

const TARGETS = [
  'F-wall/src/styles.css',
  'F-Ipad/src/style.css',
  'F-table/web/src/style.css',
]

// ── 三端共用的程式碼資料夾 ─────────────────────────────────────────────────
// F-wall 底下的是原稿，整個資料夾複製到另外兩端（各專案仍自帶完整程式碼，
// 現場單獨複製一個資料夾照樣能跑 —— 這是不做共用檔案的理由）。
//   glow/    WebGL 發光層（shader、bloom 舞台、彗星）
//   shared/  其他共用的小東西（目前只有鍵盤模擬）
// glow/params.js 是【產生】出來的：把 FX 的數值換算成「世界寬的幾分之幾」，
// 讓同一份 shader 在三個大小完全不同的畫布上畫出一樣的光。
const SHARED_DIRS = ['glow', 'shared']
const W = VIEWBOX.w

const paramsSource = () => `// ⚠ 自動產生 —— 由 F-wall/sync-tokens.mjs 依 F-wall/src/config/fx.js 的 FX 換算。
// 不要手改，跑一次 \`node sync-tokens.mjs\` 就會被蓋掉。
//
// 長度一律是「世界寬的幾分之幾」。牆面的世界是 viewBox ${W} 寬，
// iPad 與桌面的世界寬是 PARAMS.refWidth —— 同一個比例乘上去，
// 三個畫布大小不同但線的粗細、光暈的擴散、彗星的長度都會等比一致。
export const PARAMS = {
  refWidth: 1600,       // 內部緩衝的基準寬（實際大小由容器寬高比 + 固定面積算出，見 stage.js）
  dpr: ${FX.dpr},
  bg: '${FX.bg}',
  color: {
    head: '${FX.color.head}',
    body: '${FX.color.body}',
    tail: '${FX.color.tail}',
    line: '${FX.color.line}',
  },
  bloom: {
    strength: ${FX.bloom.strength},
    radius: ${FX.bloom.radius},
    threshold: ${FX.bloom.threshold},
    softKnee: ${FX.bloom.softKnee},
  },
  breathe: { period: ${FX.breathe.period}, lo: ${FX.breathe.lo} },
  // 發光線（節點外圈 / 中樞環）＝ 牆面的 FX.frame
  line: {
    width: ${(FX.frame.width / W).toFixed(6)},
    coreSharp: ${FX.frame.coreSharp},
    softSharp: ${FX.frame.softSharp},
    core: ${FX.frame.core},
    soft: ${FX.frame.soft},
    idle: ${FX.frame.blockIdle},   // 沒感應時完全不發光
    on: ${FX.frame.blockOn},     // active 時的亮度倍率（再乘上呼吸）
  },
  // 走線光束＝ 牆面的 FX.beam
  beam: {
    width: ${(FX.beam.width / W).toFixed(6)},
    coreSharp: ${FX.beam.coreSharp},
    softSharp: ${FX.beam.softSharp},
    speed: ${(FX.beam.speed / W).toFixed(6)},
    minCycle: ${FX.beam.minCycle},
    comets: ${FX.beam.comets},
    tailWidths: ${(FX.beam.tailUnits / W).toFixed(6)},
    tailMaxFrac: ${FX.beam.tailMaxFrac},
    endFadeWidths: ${(FX.beam.endFade / W).toFixed(6)},
    base: ${FX.beam.base},
    baseSoft: ${FX.beam.baseSoft},
    peak: ${FX.beam.peak},
    headBoost: ${FX.beam.headBoost},
    headSharp: ${FX.beam.headSharp},
    drawSpeed: ${(FX.drawSpeed / W).toFixed(6)},
  },
}
`

const check = process.argv.includes('--check')
let drift = 0

for (const rel of TARGETS) {
  const path = join(ROOT, rel)
  const text = await readFile(path, 'utf8')

  const b = text.indexOf(BEGIN)
  const e = text.indexOf(END)
  if (b === -1 || e === -1 || e < b) {
    console.error(`✗ ${rel}：找不到 ${BEGIN} … ${END} 標記，跳過`)
    drift = 1
    continue
  }
  const headEnd = text.indexOf('*/', b) + 2
  const next = text.slice(0, headEnd) + BODY + '\n  ' + text.slice(e)

  if (next === text) { console.log(`= ${rel}`); continue }
  drift = 1
  if (check) { console.error(`✗ ${rel}：與 ${SRC} 不同步`); continue }
  await writeFile(path, next)
  console.log(`✓ ${rel}`)
}

// ── 同步共用資料夾 ──────────────────────────────────────────────────────────
await writeFile(join(ROOT, 'F-wall/src/glow/params.js'), paramsSource()).catch(() => {})
for (const dir of SHARED_DIRS) {
  const src = `F-wall/src/${dir}`
  const files = (await readdir(join(ROOT, src))).filter((f) => /\.(js|jsx)$/.test(f)).sort()
  for (const dst of [`F-Ipad/src/${dir}`, `F-table/web/src/${dir}`]) {
    await mkdir(join(ROOT, dst), { recursive: true })
    for (const f of files) {
      const from = await readFile(join(ROOT, src, f), 'utf8')
      let same = false
      try { same = (await readFile(join(ROOT, dst, f), 'utf8')) === from } catch {}
      if (same) { console.log(`= ${dst}/${f}`); continue }
      drift = 1
      if (check) { console.error(`✗ ${dst}/${f}：與 ${src}/${f} 不同步`); continue }
      await writeFile(join(ROOT, dst, f), from)
      console.log(`✓ ${dst}/${f}`)
    }
  }
}

if (check && drift) {
  console.error(`\n有檔案與 ${SRC} 不同步 —— 跑 \`node sync-tokens.mjs\` 修正。`)
  process.exit(1)
}
if (!check) console.log(`\n來源：${SRC} 的 SHARED`)
