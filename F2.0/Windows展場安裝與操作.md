# F 區｜Windows 展場安裝與操作

適用配置：一台 Windows 電腦＋兩個獨立延伸顯示器／投影機＋同區網 iPad。

## 完成後的操作方式

- Windows 桌面雙擊 **F Zone** 捷徑，自動啟動服務，將 Table、Wall 開在指定的兩個螢幕，以無邊框全畫面顯示。
- iPad 開啟 `http://展演電腦IP:6275/ipad`，控制同一場體驗。
- iPad 按 **重置**：停止語音及自動展示、清除感應狀態，Table／iPad 回首頁，Wall 回未啟用的待機狀態。Wall 本來沒有首頁。
- 重置不會重開 Windows、關閉瀏覽器或清除投影校正值。

## 1. 第一次安裝

1. 將整個 `F2.0` 資料夾放到 Windows 固定位置，例如 `C:\FZone\F2.0`。保留 `public`、`src`、`server`、`windows`、`package.json`、`package-lock.json` 及啟動檔。
2. **不要搬 Mac 的 `node_modules`**。Windows 必須重新安裝相依套件，尤其 NFC 使用原生模組。
3. 安裝 Windows 版 Node.js LTS（含 npm）、NFC 讀卡機驅動；原生套件若需編譯，依錯誤提示安裝 Python 與 Visual Studio Build Tools 的 C++ 工作負載。
4. 連接兩個投影機／螢幕，在 Windows「顯示設定」選擇 **延伸這些顯示器**，確認排列與解析度。建議現場先使用一致的顯示縮放比例，完成投影定位後固定設定。
5. 雙擊 **`Install-F.cmd`**。它會執行 `npm ci`，列出顯示器，要求輸入 Table 與 Wall 的顯示器索引，再選 `live` 或 `sim`。
6. 安裝畫面中的索引從 `0` 起，依列出的裝置名稱及座標辨識，**不一定等於 Windows 設定上的螢幕編號**。兩端不可選同一個顯示器。
7. `live` 為正式 NFC 展演（預設），`sim` 為無硬體演練。設定存於 `windows/settings.json`，並建立桌面的 **F Zone** 捷徑。
8. 雙擊桌面捷徑，確認兩個畫面都開在指定投影機。

安裝需連網下載 npm 套件；完成相依套件與素材安裝後，展演不需外部網際網路，但 iPad 與主機仍需區網連線。套件編譯及讀卡機驅動不是此安裝檔自動提供的部分。

移動資料夾或更換投影機後，重新執行 `Install-F.cmd` 更新捷徑及螢幕指定。若相同埠已有舊服務或不同模式的服務，啟動檔會提示，請先關閉原服務再啟動。

## 2. NFC 設定

- 依 `server/reader-map.example.json` 建立 `server/reader-map.json`，固定各讀卡機位置。
- 檢查 `server/uid-map.json` 是否涵蓋現場九種家電感應卡；逐台確認，不以檔案存在代表硬體已驗收。
- 正式啟動使用 `--live --no-sim`，隱藏模擬工具。硬體未準備好時，安裝設定先選 `sim`，可用 iPad 的替代卡片演練。
- 正式模式不能用 iPad 的虛擬卡片代替未登記的 NFC 卡。

## 3. iPad 連線

1. Windows 與 iPad 接到同一個展演路由器／區域網路，避免啟用用戶隔離的訪客 Wi-Fi。
2. 在 Windows 執行 `ipconfig`，找到展演網卡的 IPv4，例如 `192.168.1.50`。啟動檔也會列出候選 iPad 網址；若有多張網卡，選展演網路的 IP。
3. iPad Safari 開啟 `http://192.168.1.50:6275/ipad`，可加入主畫面。
4. Windows 防火牆若詢問，允許 Node.js 通過展場使用的私人網路。若由場館 IT 管理，請其允許 iPad 區網連入 TCP `6275`（HTTP 與 WebSocket 共用此埠）；不需要把服務公開到網際網路。
5. 建議由路由器保留主機 IP，避免重新開機後 iPad 網址改變。

iPad 不能使用 `localhost`，那會指向 iPad 自己。GitHub Pages 展示網址也不能控制這台 Windows 的本機展演服務。

## 4. 每日開展

1. 開啟投影機、確認 Windows 偵測到兩個延伸顯示器。
2. 雙擊桌面 **F Zone**。
3. 啟動器等待服務正常後開啟兩個獨立瀏覽器視窗；重複雙擊會優先使用原有的專用視窗。
4. Table 使用 `?projection&exhibition`，Wall 同樣使用正式投影模式，隱藏模擬工具與牆面示意照片。
5. 啟動器設定瀏覽器允許自動音訊，Table 嘗試自動啟用語音。若企業政策仍阻擋，畫面會保留「啟用 Table 語音」，現場點一次即可。
6. 在 iPad 開展演網址，測試前導、放卡及重置後，開始正式接待。

兩端各使用獨立且持久保存的瀏覽器設定檔，位置為 `%LOCALAPPDATA%\FZone\browser-table` 與 `browser-wall`。第一次安裝需在這兩個視窗匯入／設定展場投影校正；Mac 或一般瀏覽器的 localStorage 不會自動帶過來。不要刪除設定檔，以免遺失校正。

## 5. iPad 重置的操作結果

1. 先取走所有實體感應物件。
2. 在 iPad 主畫面按「↶ 重置」。若正在詳細頁，先關閉詳細頁。
3. 三端收到同一個重置事件，語音停止、已放置數量歸零、連動取消；Table／iPad 回首頁，Wall 回待機。
4. 下一組從 iPad 首頁播放前導，再開始放卡。

卡片若一直留在讀卡機上，重置後不一定重新產生「放上」事件，因此下一輪要拿起再放回。iPad 斷線時無法送出重置，先恢復連線再操作。

這是**展演狀態重置**。如果瀏覽器整個當機、Windows 服務停止或電腦失去網路，iPad 無法透過此按鈕修復作業系統；需要工作人員在主機處理。

## 6. 收展與故障定位

- 收展：先用 iPad 重置，兩個展示視窗可用 `Alt+F4` 關閉，最後正常關閉 Windows。只關瀏覽器時，背景服務仍持續執行，可再次雙擊捷徑開畫面。
- 啟動失敗：查看 `%LOCALAPPDATA%\FZone\server.log` 與 `server-error.log`。
- 切換 `sim`／`live`：先停止原有 F 區 Node 服務，再重新安裝設定並啟動；不要終止電腦上其他用途的 Node 服務。
- 投影到錯誤螢幕：確認延伸模式與設備連接順序，再重新執行安裝指定螢幕。
- iPad 不通：先在主機開 `http://localhost:6275/ipad`，再查 IP、防火牆及 Wi-Fi 隔離。
- 避免展中自動休眠、關閉顯示器或重新開機；由場館管理人員設定 Windows 電源與更新時段。

## 7. 現場驗收

- [ ] 重新開機後，雙擊捷徑能開啟服務與兩個指定螢幕。
- [ ] Table／Wall 均無邊框、沒有工作列遮擋，縮放、校正與投影位置正確。
- [ ] iPad 連上主機，前導只從 Table 播放，語音球有反應。
- [ ] 九台實體家電逐一感應，三端同步；最後一台播完出現全屋串聯。
- [ ] iPad 重置後音訊停止、設備清空、Table 回首頁、Wall 回待機。
- [ ] 下一輪可以再次播放前導及放卡。
- [ ] 連續雙擊捷徑不重複開同一個專用視窗。

開發環境已提供三端同步重置整合測試；Windows 視窗位置、DPI、音訊政策與 NFC 驅動仍需在展場 Windows 實機驗收。

參考：[nfc-pcsc 原生套件安裝](https://github.com/pokusew/nfc-pcsc)、[node-gyp Windows 編譯環境](https://github.com/nodejs/node-gyp#on-windows)。
