import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // 牆面投影機這台跑 kiosk，port 5174（SYNC-SPEC §1.1 拍板）。
  // strictPort：被佔用直接報錯，不偷偷 fallback 到 5180，免得投影機指向錯 URL。
  server: { host: true, port: 5174, strictPort: true },
  preview: { host: true, port: 5174, strictPort: true },
})
