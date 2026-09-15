# ANLB 語音球 v1 — 給 Astra6 的接入說明

這是已核准 v12 球體的可攜版。只加入控制封裝與音訊分析，不重新設計球。沒有 E 區專用章節、字幕、正式音檔、時間碼或遠端服務依賴。請在接收區域的專案接入，不修改其他區域。

## 最快開始

把整個資料夾放進現有網站的靜態檔案目錄，開啟 demo.html。需要 HTTP localhost 或 HTTPS，以及支援 WebGPU 的瀏覽器／GPU；不支援時頁面會顯示錯誤。不能直接雙擊 file:// 使用 ES module。若沒有網站，請由 Astra6 在此資料夾啟動本機靜態伺服器（例如 Python：python3 -m http.server 8080 --bind 127.0.0.1），開 http://127.0.0.1:8080/demo.html 。不需 npm、建置或 CDN。

## 建議：直接接入現有網頁

```html
<div id="voice-orb" style="width:520px;height:520px"></div>
<audio id="narration" src="./narration.wav" controls></audio>
<button id="start">開始導覽</button>
<button id="finish">整場結束</button>
<script type="module">
import {mountOrb} from './ANLB語音球-v1/orb.js';
const orb = mountOrb(document.querySelector('#voice-orb'));
const audio = document.querySelector('#narration');
await orb.ready;
document.querySelector('#start').onclick = async () => {
  await orb.connectAudio(audio); // 在使用者點擊裡啟動 AudioContext
  orb.start();
  await audio.play();
};
document.querySelector('#finish').onclick = () => {
  audio.pause();
  orb.end();
};
</script>
```

同一場若有多支音檔，建議重用同一 audio 元素更換 src。請由整場播放器發出 end()，不要把單支音檔 ended 綁到 end()。音檔 pause、斷句與章間停頓都維持 thinking，只收回額外起伏。音源需同源；跨來源必須有允許的 CORS，並在設定 src 前設 audio.crossOrigin='anonymous'。

若播放器已經有 Web Audio 音訊圖，不要對同一元素再建立 MediaElementAudioSource：直接從既有 analyser 取得 RMS，送 orb.setLevel(0到1)；分析分支不應重複連到喇叭。範例預設將 RMS 減 0.008 後乘 5 並限制 0到1，可在 connectAudio(audio,{gain:5,noiseFloor:0.008}) 調整不同錄音音量。這是輸入校正，請不要改球的 shader。

## 三個控制入口

- orb.start()：整場開始 → thinking。
- orb.setLevel(value)：0～1 音量；0 只取消出聲起伏，不退出 thinking。
- orb.end()：明確整場完成或重設 → idle。
- orb.ready：等待 WebGPU 初始化，可捕捉錯誤。
- orb.disconnectAudio()：停止分析；原音訊仍正常播放。
- orb.dispose()：移除元件、停止繪圖。audio 的生命週期由呼叫方管理。

也可 iframe 嵌入 index.html（不含控制UI），但建議採直接 mountOrb 以便音訊接線。同源 iframe 載入後可存取 contentWindow.anlbOrb；本包未提供跨來源 postMessage 協定。球容器請保持正方形、寬高皆大於0。背景透明，顯示大小由容器決定；玻璃中的色彩是原版渲染，不額外用 CSS 濾鏡調亮。預設 520px，渲染解析度延續核准版本1600，較弱設備需實測效能。

## 不可擅改的核准內容

restored-orb.js 原樣保留。粒子、玻璃、idle/thinking預設、240ms啟動、650ms回落、出聲動態係數保持不變。字幕不是本元件的一部分，需要時接收區域自行搭配。不可把無聲示範當成真實音訊同步，或把本包當成 ASR/TTS；本包不生成聲音、不辨識文字、不取用麥克風。

## 接入驗收

1. 待機能渲染原版量子絲帶，無GPU錯誤。
2. 開始保持 thinking；語音有可見短促起伏。
3. 靜音／暫停至少1秒，額外起伏歸零，常態思考仍持續。
4. 單支音檔結束不回待機，明確整場結束才回 idle。
5. 同一音檔重播和切換音檔，聲音不重複、不消失，無重複 source 錯誤。
6. 在接收區域實際設備與背景下檢查對比及幀率。

## 來源與授權

原始專案 https://github.com/LerSent001/orb ，保留隨附 MIT LICENSE（Copyright 2026 LerSent001）。本球來源為使用者提供的原版匯出，沿用本地核准 v12 控制改動；不宣稱自行創作原版 shader。UPSTREAM.txt 記錄來源及檔案雜湊。轉交需一併保留 LICENSE 與來源資訊。
