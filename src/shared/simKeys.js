// ============================================================================
// 鍵盤模擬 NFC（開發用）。
//
// 這裡【不】自己模擬 —— 只是把按鍵送給 server，由 server 廣播真的
// tag-present / tag-remove。三端才會一起亮，那正是要看的東西；
// 各端自己模擬只會讓那一端亮，看不出同步。
//
//   1–9  放上／拿走該台家電（再按一次取消）
//   a    全部放上
//   0    全部拿走
//
// ⚠ 開關【只有一個】：server 要帶 --sim。
//   沒帶的話這些訊息會被完全忽略（server 會在終端機說一聲），所以前端這裡
//   不再另外要求網址帶 ?sim —— 兩道關卡只會讓人按了沒反應又不知道為什麼。
//   現場的 server 不帶 --sim，誤按不會有任何效果。
//
// ⚠ 這個檔案由 sync-tokens.mjs 從 F-wall 複製到 F-Ipad / F-table，不要單獨改。
// ============================================================================

const KEY = /^[0-9aA]$/

// 按鈕與鍵盤共用協議入口；呼叫端負責選擇本機 demo 或既有 server。
export function sendSimCommand(ws, key) {
  if (!KEY.test(String(key)) || !ws || ws.readyState !== 1) return false
  ws.send(JSON.stringify({ type: 'sim-key', key: String(key) }))
  return true
}

/**
 * 掛上鍵盤監聽，把 1–9 / 0 / a 送給 server。
 * @param getSocket 回傳目前 WebSocket 的函式（斷線會重建，所以不能直接傳 socket）
 * @returns 取消監聽的函式
 */
export function attachSimKeys(getSocket) {
  const onKey = (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (e.repeat) return // 按著不放會來回切換，很吵
    if (!KEY.test(e.key)) return
    // 有輸入焦點時不攔（目前三端都沒有輸入框，但別讓之後加的踩到）
    const t = e.target
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return

    sendSimCommand(getSocket(), e.key)
  }
  window.addEventListener('keydown', onKey)
  return () => window.removeEventListener('keydown', onKey)
}
