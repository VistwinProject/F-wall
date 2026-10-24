# 驗證記錄 — 2026-10-24

驗證位置為本機隔離副本，未向展場主控發送操作。

| 檢查 | 結果 |
|---|---|
| `npm ci --ignore-scripts --no-audit --no-fund` | 通過；未編譯或連接 NFC 硬體 |
| `npm run check` | release 資產檢查、46/46 測試通過、9 裝置 iPad 統計驗證通過 |
| `powershell.exe -NoProfile -File scripts/check-windows.ps1` | 10 個 PowerShell 腳本語法通過 |
| `node scripts/build-pages.mjs ROLE` | 對應 table/wall/ipad 建置通過；未發布 Pages |
| 現場畫面 | Graph、Wall、Table 在移除錯誤入口後仍顯示 |

測試涵蓋 NFC 子程序隔離／重連、X revision 與必要角色回報、重設、視窗恢復、顯示器不明時停止錯誤路由、範圍限定的停止指令、長跑日誌限制與校正遷移。

最初有兩項校正測試失敗：現場 10 月 13 日已更新 preset，但 fixture 仍使用 10 月 12 日 revision／identity quad。更新測試資料後補測遷移備份、再次載入不覆寫調整。production code 與現場保持一致。

三個 F repo 各自獨立完成上述檢查。主分支推送不會觸發現有 Pages（v2.0）或 Windows 離線包（指定開發分支）的 workflow；沒有連接現場的部署 workflow。

限制：本輪未做實體刷卡、音響、iPad 端操作、Windows 原生 NFC 模組編譯、Mac 或長時間連續硬體驗收。不能以自動測試代表全場硬體零風險。現場設定、瀏覽器資料與 runtime 未上傳公開 repo，也未在現場覆蓋。
