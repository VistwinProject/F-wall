// ============================================================================
// 展示模式的假 WebSocket（https 之下自動啟用，或網址帶 ?demo）
//
// 為什麼需要：三端的資料都來自本機的 NFC server（ws://localhost:8787）。
// 部署到靜態主機（GitHub Pages 之類）之後那台 server 不存在，而且頁面是 HTTPS
// —— 瀏覽器會直接擋掉 ws:// 的連線（mixed content），所以連「連不上再重試」
// 都不會發生，畫面會永遠停在離線待機。
//
// 這支就是那顆 server 的替身：介面與 WebSocket 相同（onopen/onmessage/…、
// send、close、readyState），送出的訊息形狀與真的 server【逐欄位相同】，
// 所以三端的接收端一行都不用改，只有「new 哪一個」不同。
//
// ⚠ 訊息形狀要跟 F-table/server/index.js 對齊：
//     reader-connected / reader-disconnected / tag-present / tag-remove
//     session-start / session-end
//   欄位：slot_index、uid、known、data{ id, label, description }
//   改 server 的協議時這裡要一起改，不然展示版會跟現場版說不同的話。
//
// ⚠ 這個檔案由 sync-tokens.mjs 從 F-wall 複製到 F-Ipad / F-table，不要單獨改。
// ============================================================================

/**
 * 要不要走展示模式。三端共用同一個判斷，不要各寫各的。
 *
 * 規則：頁面是 https 就【自動】展示模式。
 * ⚠ 這不是隨手加的方便：真實資料來自 ws://<host>:8787，而瀏覽器【禁止】從
 *   https 頁面連 ws://（mixed content，硬性阻擋、無法用設定放行）。也就是說
 *   https 之下真的那條路一定連不上，自動切過去才是正確行為 —— 不然使用者
 *   看到的是一個永遠在重連的離線畫面，而且沒有任何提示說要加 ?demo。
 * ⚠ 現場不受影響：投影機與 iPad 都是走 http（vite dev server / kiosk），
 *   protocol 是 'http:'，這個判斷是 false。
 * ⚠ 逃生門：?live 強制走真的連線（將來若改成 https + wss 就用這個，或直接
 *   把這段條件改掉）；?demo 則是在 http 之下也強制展示模式（本機預覽用）。
 */
export const isDemo = () => {
  if (typeof window === 'undefined') return false
  const q = new URLSearchParams(window.location.search)
  if (q.has('live')) return false
  if (q.has('demo')) return true
  return window.location.protocol === 'https:'
}

// 九台的順序＝鍵盤 1–9，與 server 的 SIM_IDS 一致。
const SIM_IDS = ['hrv', 'ac', 'dehum', 'purifier', 'sensor', 'light', 'socket', 'curtain', 'bathfan']
const LABELS = {
  hrv: '新風機', ac: '冷氣', dehum: '除濕機', purifier: '空氣清淨機',
  sensor: '12合一感測器', light: '燈', socket: '智慧插座',
  curtain: '窗簾', bathfan: '浴室暖風機',
}
// 有實體卡的沿用真 UID（與 server/uid-map.json 相同），其餘照 server 的 simCard 補。
const REAL_UID = {
  ac: 'B7F6401E', hrv: 'FE53411E', light: 'B00C411E',
  socket: 'EEA1E43C', curtain: 'FB9AE53C',
}
const cardOf = (id) => ({
  uid: REAL_UID[id] ?? `SIM-${id.toUpperCase()}`,
  data: { id, label: LABELS[id] ?? id, description: '（展示模式）' },
})

// 編排：一台一台放上，全滿後停一下，再一台一台收掉，然後重來。
const STEP_MS = 2600   // 每放一台的間隔
const HOLD_MS = 5000   // 九台全亮後停留
const CLEAR_MS = 420   // 收掉時每台的間隔
const OPEN_MS = 260    // 「連上」的延遲，讓 UI 有一瞬間的 connecting 狀態

export class DemoSocket {
  constructor(_url) {
    this.readyState = 0 // CONNECTING
    this.onopen = null
    this.onmessage = null
    this.onerror = null
    this.onclose = null
    this._timers = new Set()
    this._present = new Set() // 目前有卡的 slot_index
    this._auto = !new URLSearchParams(window.location.search).has('manual')
    this._step = 0
    this._t = setTimeout(() => this._open(), OPEN_MS)
  }

  // ── WebSocket 介面 ────────────────────────────────────────────────────────
  send(raw) {
    // 鍵盤模擬（shared/simKeys.js 會把按鍵送過來）。真的 server 也是收這個。
    // ⚠ 一旦有人按鍵就把自動編排關掉 —— 不然自動流程會跟手動搶著改狀態。
    let msg
    try { msg = JSON.parse(raw) } catch { return }
    if (msg?.type !== 'sim-key') return
    this._auto = false
    const k = String(msg.key)
    if (k === '0') { this._clearAll(); return }
    if (k === 'a' || k === 'A') { SIM_IDS.forEach((_, i) => this._place(i)); return }
    const i = parseInt(k, 10) - 1
    if (i >= 0 && i < SIM_IDS.length) this._toggle(i)
  }

  close() {
    if (this.readyState === 3) return
    this.readyState = 3 // CLOSED
    for (const t of this._timers) clearTimeout(t)
    this._timers.clear()
    clearTimeout(this._t)
    this.onclose?.({ code: 1000, reason: 'demo' })
  }

  // ── 內部 ──────────────────────────────────────────────────────────────────
  _later(fn, ms) {
    const t = setTimeout(() => { this._timers.delete(t); fn() }, ms)
    this._timers.add(t)
    return t
  }

  _emit(obj) {
    if (this.readyState !== 1) return
    // 真的 WebSocket 給的是 MessageEvent，接收端讀的是 .data（字串）。
    this.onmessage?.({ data: JSON.stringify(obj) })
  }

  _open() {
    this.readyState = 1 // OPEN
    this.onopen?.({})
    // 九台讀卡機上線 —— 與真 server 一樣，先報 reader 再報卡。
    SIM_IDS.forEach((_, i) =>
      this._emit({ type: 'reader-connected', slot_index: i, reader: `DEMO-${i + 1}` }))
    // 離開歡迎頁。⚠ 一定要送：桌面與 iPad 的歡迎頁只認這個訊息。
    this._later(() => this._emit({ type: 'session-start' }), 700)
    this._later(() => this._tick(), 1600)
  }

  _place(i) {
    if (this._present.has(i)) return
    this._present.add(i)
    const { uid, data } = cardOf(SIM_IDS[i])
    this._emit({ type: 'tag-present', slot_index: i, uid, known: true, data })
  }

  _remove(i) {
    if (!this._present.has(i)) return
    this._present.delete(i)
    this._emit({ type: 'tag-remove', slot_index: i })
  }

  _toggle(i) { this._present.has(i) ? this._remove(i) : this._place(i) }

  _clearAll() { [...this._present].forEach((i) => this._remove(i)) }

  // 自動編排的一拍。⚠ 用遞迴的 setTimeout 而不是 setInterval：
  //   分頁被切到背景時 interval 會累積成一串補跑的 tick，回來會看到九台瞬間全亮。
  _tick() {
    if (this.readyState !== 1 || !this._auto) return
    const n = SIM_IDS.length
    if (this._step < n) {
      this._place(this._step)
      this._step += 1
      this._later(() => this._tick(), this._step < n ? STEP_MS : HOLD_MS)
      return
    }
    // 收掉：一台一台熄，收完回到第一步
    const order = [...this._present].sort((a, b) => a - b)
    order.forEach((i, k) => this._later(() => {
      if (this._auto) this._remove(i)
    }, k * CLEAR_MS))
    this._step = 0
    this._later(() => this._tick(), order.length * CLEAR_MS + 1200)
  }
}

DemoSocket.CONNECTING = 0
DemoSocket.OPEN = 1
DemoSocket.CLOSING = 2
DemoSocket.CLOSED = 3

/** 要 new 的那個類別：展示模式 → 假的，其餘 → 瀏覽器原生的（判斷見 isDemo）。 */
export const socketClass = () => (isDemo() ? DemoSocket : WebSocket)
