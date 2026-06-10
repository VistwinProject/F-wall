// 極簡靜態檔伺服器（純 Node，無相依套件）：把 ./app 這個資料夾的 build 結果丟到 5174。
// 牆面投影只需要這個 + Chrome 就能跑，不用 npm、不用網路。
import http from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, normalize, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), 'app')
const PORT = 5174

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
}

async function send(res, path) {
  const buf = await readFile(path)
  res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'application/octet-stream' })
  res.end(buf)
}

const server = http.createServer(async (req, res) => {
  try {
    // 擋掉目錄穿越；去掉 query string
    let urlPath = decodeURIComponent((req.url || '/').split('?')[0])
    let filePath = normalize(join(ROOT, urlPath))
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403).end('Forbidden')
      return
    }
    // 目錄 → index.html
    let s = await stat(filePath).catch(() => null)
    if (s && s.isDirectory()) filePath = join(filePath, 'index.html')
    s = await stat(filePath).catch(() => null)
    if (s && s.isFile()) {
      await send(res, filePath)
      return
    }
    // SPA fallback：找不到就回 index.html
    await send(res, join(ROOT, 'index.html'))
  } catch (err) {
    res.writeHead(500).end('Server error: ' + err.message)
  }
})

server.listen(PORT, () => {
  console.log(`[f-wall] 牆面投影已啟動： http://localhost:${PORT}`)
})
