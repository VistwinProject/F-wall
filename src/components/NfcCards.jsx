import { useState } from 'react'
import { APPLIANCES } from '../config/appliances.js'
import './NfcCards.css'

export default function NfcCards({ activeIds, status, simulate, demo }) {
  const [expanded, setExpanded] = useState(true)
  const ready = demo && status === 'open'
  const preview = new URL(window.location.href)
  preview.searchParams.delete('live')
  preview.searchParams.delete('all')
  preview.searchParams.set('demo', '')
  preview.searchParams.set('manual', '')

  return (
    <aside className="nfc-cards" aria-label="替代 NFC 卡片">
      <button type="button" className="nfc-cards-heading" aria-expanded={expanded}
        aria-controls="nfc-card-options" onClick={() => setExpanded(!expanded)}>
        <span>替代 NFC 卡片</span>
        <span>{activeIds.size}/9 已放上 · {expanded ? '收合 ▾' : '展開 ▴'}</span>
      </button>
      {expanded && <div id="nfc-card-options" className="nfc-cards-body">
        <p>{demo ? '本機模擬 · 點選放上／拿走，可同時放多張' : '目前為實體 NFC 連線；請開啟本機模擬操作卡片。'}</p>
        {!demo && <a href={preview.href}>開啟本機模擬</a>}
        {demo && <>
          <p role="status">{status === 'open' ? `已放上 ${activeIds.size} / 9 張` : '模擬連線準備中…'}</p>
          <div className="nfc-cards-grid">
            {APPLIANCES.map(({ id, label }, index) => (
              <button type="button" key={id} disabled={!ready}
                aria-pressed={activeIds.has(id)} onClick={() => simulate(String(index + 1))}>
                <span>{label}</span>
                <small>{activeIds.has(id) ? '✓ 已放上' : '＋ 未放上'}</small>
              </button>
            ))}
          </div>
          <div className="nfc-cards-actions">
            <button type="button" disabled={!ready} onClick={() => simulate('a')}>全部放上</button>
            <button type="button" disabled={!ready} onClick={() => simulate('0')}>全部拿走</button>
          </div>
          <p className="nfc-cards-help">鍵盤 1–9 切換卡片 · A 全放 · 0 清空</p>
        </>}
      </div>}
    </aside>
  )
}
