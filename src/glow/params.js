// ⚠ 自動產生 —— 由 /Users/chunming/F/sync-tokens.mjs 依 F-wall/src/config/fx.js 的 FX 換算。
// 不要手改，跑一次 `node sync-tokens.mjs` 就會被蓋掉。
//
// 長度一律是「世界寬的幾分之幾」。牆面的世界是 viewBox 1920 寬，
// iPad 與桌面的世界寬是 PARAMS.refWidth —— 同一個比例乘上去，
// 三個畫布大小不同但線的粗細、光暈的擴散、彗星的長度都會等比一致。
export const PARAMS = {
  refWidth: 1600,       // 內部緩衝的基準寬（實際大小由容器寬高比 + 固定面積算出，見 stage.js）
  dpr: 1,
  bg: '#16181D',
  color: {
    head: '#FFFFFF',
    body: '#7FE3FF',
    tail: '#1B4FA8',
    line: '#A0D8FF',
  },
  bloom: {
    strength: 1.15,
    radius: 0.62,
    threshold: 0.5,
    softKnee: 0.55,
  },
  breathe: { period: 1.5, lo: 0.5 },
  // 發光線（節點外圈 / 中樞環）＝ 牆面的 FX.frame
  line: {
    width: 0.013542,
    coreSharp: 17,
    softSharp: 2.2,
    core: 1.95,
    soft: 0.3,
    idle: 0,   // 沒感應時完全不發光
    on: 1.9,     // active 時的亮度倍率（再乘上呼吸）
  },
  // 走線光束＝ 牆面的 FX.beam
  beam: {
    width: 0.013542,
    coreSharp: 7,
    softSharp: 1.6,
    speed: 0.218776,
    minCycle: 2,
    comets: 2,
    tailWidths: 0.085951,
    tailMaxFrac: 0.6,
    endFadeWidths: 0.003125,
    base: 0.75,
    baseSoft: 0.35,
    peak: 1.1,
    headBoost: 1.8,
    headSharp: 26,
    drawSpeed: 0.729167,
  },
}
