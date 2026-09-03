import { useCallback, useEffect, useRef, useState } from 'react'
import { APPLIANCE_IDS } from '../config/appliances.js'
import { attachSimKeys } from '../shared/simKeys.js'

// ============================================================================
// 連桌面端 Python ws server（權威資料源，port 8787），牆面只收不送。
// 協議見 vibenfc/SYNC-SPEC.md，四種訊息：
//   reader-connected / reader-disconnected / tag-present / tag-remove
//
// tag-remove 只給 slot_index、不給 id → 必須自記 slot→id（最後一次 tag-present
// 在該 slot 看到的 data.id），拿走時才知道熄滅哪個家電。slot↔家電走動態(方案 A)。
//
// activeIds = 目前有卡片在上面的家電 id 集合（支援多卡同時 active）。
// ============================================================================

const KNOWN = new Set(APPLIANCE_IDS)
const DESK_WS = import.meta.env.VITE_DESK_WS ?? 'ws://localhost:8787'
const RECONNECT_MS = 3000

export function useDeskState({ url = DESK_WS } = {}) {
  const [activeIds, setActiveIds] = useState(() => new Set())
  const [status, setStatus] = useState('connecting') // connecting | open | closed
  const slotToId = useRef({}) // slot_index -> 上次看到的 data.id

  // 唯一的事件入口：WS onmessage 走這裡
  const handleMessage = useCallback((msg) => {
    if (!msg || typeof msg !== 'object') return
    const slot = msg.slot_index

    switch (msg.type) {
      case 'tag-present': {
        const id = msg.known ? msg.data?.id : undefined
        if (!KNOWN.has(id)) return // 未註冊或不在 9 家電內，牆面不亮
        slotToId.current[slot] = id
        setActiveIds((prev) => {
          const next = new Set(prev)
          next.add(id)
          return next
        })
        break
      }
      case 'tag-remove':
      case 'reader-disconnected': {
        const id = slotToId.current[slot]
        delete slotToId.current[slot]
        if (!id) return
        setActiveIds((prev) => {
          if (!prev.has(id)) return prev
          const next = new Set(prev)
          next.delete(id)
          return next
        })
        break
      }
      // reader-connected：讀卡機上線、尚無卡片。牆面目前不畫 connected 中間態，先略過。
      default:
        break
    }
  }, [])

  useEffect(() => {
    let closedByUs = false
    let ws = null
    let retry = null

    const connect = () => {
      ws = new WebSocket(url)
      ws.onopen = () => setStatus('open')
      ws.onmessage = ({ data }) => {
        try {
          handleMessage(JSON.parse(data))
        } catch {}
      }
      ws.onclose = () => {
        setStatus('closed')
        // 桌面斷線：清空，避免卡在某個亮著的狀態
        slotToId.current = {}
        setActiveIds((prev) => (prev.size ? new Set() : prev))
        if (!closedByUs) retry = setTimeout(connect, RECONNECT_MS)
      }
      ws.onerror = () => ws.close()
    }
    connect()
    // ⚠ 牆面原則上【只收不送】(見檔頭)。?sim 是唯一的例外:開發時想直接在
    //   牆面這個視窗按 1–9,不用切到平板。沒帶 ?sim 就完全不掛監聽,
    //   而且 server 沒帶 --sim 也不會理這則訊息,現場不會誤觸。
    const detachSim = attachSimKeys(() => ws)

    return () => {
      detachSim()
      closedByUs = true
      clearTimeout(retry)
      ws?.close()
    }
  }, [url, handleMessage])

  return { activeIds, status, handleMessage }
}
