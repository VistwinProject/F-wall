import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const ROOT = path.dirname(fileURLToPath(import.meta.url))

// 編輯模式（鍵盤 e）的「存到專案」會 POST 到 /__wall-export，內容直接寫成
// wall-export.txt 放在專案根目錄。
//
// 為什麼要這個：匯出的文字原本只能靠剪貼簿，而 navigator.clipboard 在
// 沒有焦點 / 非安全環境時會安靜失敗，投影機那台又不見得方便貼上。寫成檔案之後
// 「調完 → 我直接讀檔」這條路不依賴剪貼簿。
//
// ⚠ apply: 'serve' —— 只有 dev server 有這個端點，build 出來的靜態檔沒有這段。
// ⚠ 路徑寫死，不吃 request 給的檔名 —— 這是本機開發工具，但沒有理由留一個
//    「任意路徑寫檔」的洞。
function wallExportSink() {
  return {
    name: 'wall-export-sink',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__wall-export', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          return res.end('POST only')
        }
        let body = ''
        req.on('data', (c) => {
          body += c
          if (body.length > 1_000_000) req.destroy() // 匯出頂多幾 KB，超過就是有問題
        })
        req.on('end', () => {
          try {
            fs.writeFileSync(path.join(ROOT, 'wall-export.txt'), body, 'utf8')
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ ok: true, file: 'wall-export.txt' }))
          } catch (err) {
            res.statusCode = 500
            res.end(String(err.message || err))
          }
        })
      })
    },
  }
}

export default defineConfig({
  // ⚠ 相對 base：靜態部署時整包可以放在任何子路徑底下（GitHub Pages 的
  //    專案站是 /<repo>/）。寫死 '/' 的話 build 出來的資產路徑會全部 404。
  //    這一版沒有前端路由，所以相對路徑不會有 history fallback 的問題。
  base: './',
  plugins: [react(), wallExportSink()],
  // 牆面投影機這台跑 kiosk，port 5174（SYNC-SPEC §1.1 拍板）。
  // strictPort：被佔用直接報錯，不偷偷 fallback 到 5180，免得投影機指向錯 URL。
  server: { host: true, port: 5174, strictPort: true },
  preview: { host: true, port: 5174, strictPort: true },
})
