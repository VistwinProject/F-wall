// ============================================================================
// 三端共用的 GLSL。
//
// 這是「牆面的光長什麼樣子」的唯一定義 —— iPad 與桌面用的是同一份字串，
// 所以三個畫面的亮芯收斂、光暈衰減、彗星拖尾曲線與三階混色都是同一條公式，
// 不是各自調到看起來很像。
//
// ⚠ 這個檔案由 sync-tokens.mjs 從 F-wall 複製到 F-Ipad / F-table，不要單獨改。
// ⚠ 牆面的 webgl/FrameLines.js 與 webgl/TraceBeam.js 也是 import 這裡，
//    改一次三端一起變 —— 這正是把它抽出來的目的。
// ============================================================================

// 發光線：頂點只是把 aSide / aT 傳下去，位置已經在 CPU 端鋪好。
export const LINE_VERT = /* glsl */ `
  attribute float aSide;
  varying float vSide;
  void main() {
    vSide = aSide;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`


// ── uAlphaLuma ──────────────────────────────────────────────────────────────
// 0 = alpha 恆為 1（牆面）。牆面的 canvas 是【不透明】的，底下不需要透出東西，
//     alpha 寫什麼都無所謂，維持原本的行為。
// 1 = alpha 跟著亮度走（iPad / 桌面）。這兩端的 canvas 是【透明】的，疊在平面圖
//     與面板之上；若 alpha 恆為 1，一條 uGain=0 的線（＝沒感應、應該看不見）
//     仍然會把整條 ribbon 的 alpha 寫成 1，變成一條不透明的黑帶蓋住底下的平面圖。
//     ⚠ 實際踩過：iPad 上出現一整片灰色的網格，就是所有 idle 的關聯邊在蓋圖。

// 發光線：橫剖面 pow(cross, uSharp) —— 芯層用大指數（緊），暈層用小指數（散）。
export const LINE_FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uColor;
  uniform float uAmp;       // 這一層的亮度（芯層用 core、光暈層用 soft）
  uniform float uSharp;     // 這一層的收斂指數
  uniform float uGain;      // 整體倍率：家電框 active 時拉高、呼吸也乘在這裡
  uniform float uAlphaLuma;  // 見檔案上方說明
  varying float vSide;

// ── ridge()：把亮芯限制成「至少一個像素寬」──────────────────────────────────
//
// pow(cross, uSharp) 的半高半寬約 ln2 / uSharp（cross 單位）。線越細、指數越大，
// 芯就越窄；窄到比一個像素還細時，畫出來的亮度取決於「像素中心有沒有剛好落在芯上」。
//
// ⚠ 實際踩過：iPad 的關聯邊線寬調細之後芯只剩 0.52px，近水平的線（0.6°）
//   每 ~100px 才跨過一個像素列，於是每 ~100px 亮一段暗一段 —— 看起來就是
//   「一節一節」。陡的線每 1px 就跨一列，高頻反而看不出來。
//   實測峰值沿線 255→191→255→205…，峰值所在的像素列同時在 0 / -1 之間跳。
//
// fwidth(vSide) = vSide 在螢幕上每個像素變化多少。把指數壓到「芯剛好一像素寬」，
// 同時等比降低亮度（pow 的積分約 ∝ 1/s）把能量守住 —— 線不會因此變亮或變暗，
// 只是不再忽亮忽暗。芯本來就夠寬時 min() 不會生效，畫面完全不變。
float ridge(float c, float sharp, float dSide) {
  float sMax = 1.386 / max(dSide, 1e-5);   // 2*ln2 / 一像素 → 芯的 FWHM ≈ 1px
  float s = min(sharp, sMax);
  return pow(c, s) * (s / sharp);
}

  void main() {
    float cross = max(0.0, 1.0 - abs(vSide));
    vec3 c = uColor * uAmp * ridge(cross, uSharp, fwidth(vSide)) * uGain;
    float a = mix(1.0, clamp(max(max(c.r, c.g), c.b), 0.0, 1.0), uAlphaLuma);
    gl_FragColor = vec4(c, a);
  }
`

// 走線光束：同上，但彗星要用 aT 比對位置。
export const BEAM_VERT = /* glsl */ `
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

// 走線光束：彗星 + 底光。詳細推導見各 uniform 的註解。
export const BEAM_FRAG = /* glsl */ `
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
  uniform float uAlphaLuma;  // 見檔案上方說明
  uniform vec3  uHead;
  uniform vec3  uBody;
  uniform vec3  uTail;
  varying float vT;
  varying float vSide;

// ── ridge()：把亮芯限制成「至少一個像素寬」──────────────────────────────────
//
// pow(cross, uSharp) 的半高半寬約 ln2 / uSharp（cross 單位）。線越細、指數越大，
// 芯就越窄；窄到比一個像素還細時，畫出來的亮度取決於「像素中心有沒有剛好落在芯上」。
//
// ⚠ 實際踩過：iPad 的關聯邊線寬調細之後芯只剩 0.52px，近水平的線（0.6°）
//   每 ~100px 才跨過一個像素列，於是每 ~100px 亮一段暗一段 —— 看起來就是
//   「一節一節」。陡的線每 1px 就跨一列，高頻反而看不出來。
//   實測峰值沿線 255→191→255→205…，峰值所在的像素列同時在 0 / -1 之間跳。
//
// fwidth(vSide) = vSide 在螢幕上每個像素變化多少。把指數壓到「芯剛好一像素寬」，
// 同時等比降低亮度（pow 的積分約 ∝ 1/s）把能量守住 —— 線不會因此變亮或變暗，
// 只是不再忽亮忽暗。芯本來就夠寬時 min() 不會生效，畫面完全不變。
float ridge(float c, float sharp, float dSide) {
  float sMax = 1.386 / max(dSide, 1e-5);   // 2*ln2 / 一像素 → 芯的 FWHM ≈ 1px
  float s = min(sharp, sMax);
  return pow(c, s) * (s / sharp);
}

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
    float dSide = fwidth(vSide);
    float core = ridge(cross, uCoreSharp, dSide);
    float soft = ridge(cross, uSoftSharp, dSide);

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
    vec3 c = col * amount;
    float a = mix(1.0, clamp(max(max(c.r, c.g), c.b), 0.0, 1.0), uAlphaLuma);
    gl_FragColor = vec4(c, a);
  }
`
