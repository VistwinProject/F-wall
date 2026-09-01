# F-wall — 寶鋪 showcase F 區「AI 大腦控制塔」牆面投影

NFC 卡片放上桌面讀卡機 → 牆面對應的家電框亮成白高光、連線提亮、旁邊彈出狀態面板。
此專案只負責**牆面投影畫面**，資料權威源在桌面端，牆面**只收不送**。

完整規格見 `寶鋪 showcase/zones/F-AI大腦控制塔.md` 與 `vibenfc/SYNC-SPEC.md`。

---

## 技術棧

- **Vite 5** + **React 18** + **framer-motion 11**
- 純 **SVG** 場景（viewBox 1920×1080，16:9 投影面）
- 開發 / 預覽固定 port **5174**（`strictPort`，投影機 kiosk 指向此 URL，被佔用直接報錯不 fallback）

## 啟動

```bash
npm install
npm run dev        # http://localhost:5174
npm run build      # 產出 dist/
npm run preview    # 預覽 build 結果（同樣 5174）
```

### 除錯參數

- `?all` — 強制所有家電同時 active，用來驗證連線 / 狀態面板排版不打架。正式投影不帶此參數。

## 資料流

```
桌面 Python WS server (ws://localhost:8787, 權威)
        │  只收不送
        ▼
useDeskState  ──►  activeIds (Set<id>)  ──►  WallScene
```

- 連線位址可用環境變數 `VITE_DESK_WS` 覆寫，預設 `ws://localhost:8787`。
- 斷線自動每 3 秒重連；斷線時清空 `activeIds`，避免卡在亮著的狀態。
- 協議四種訊息：`reader-connected` / `reader-disconnected` / `tag-present` / `tag-remove`。
- `tag-remove` 只給 `slot_index` 不給 `id`，故 hook 自記 `slot → id`（最後一次 `tag-present` 看到的 `data.id`），拿走卡片時才知道熄滅哪個家電。slot↔家電為動態綁定（方案 A）。

## 畫面結構

| 元件 | 職責 |
| --- | --- |
| `WallScene.jsx` | SVG 根（viewBox / preserveAspectRatio **結構性，不可動**）、電視預留位、家電節點列表 |
| `Hub.jsx` | 中央 AI 中樞（單圈 hairline + 標題），半徑 `R = 116` **必須與 `routing.js` 的 `RING_R` 一致** |
| `ApplianceNode.jsx` | 單一家電：極細走線、黑色挖空框（**牆上展品預留位**）、狀態面板（`avoidX` 自動避讓） |
| `config/appliances.js` | **幾何 + 內容**：9 家電的 id / label / 座標 / 尺寸 / 面板方向 / 狀態，以及 HUB、預留螢幕區。配色已移出到 `config/theme.js` |
| `config/theme.js` | 設計 token（顏色 / 圓角 / 動態 / 字體），三端共用 |
| `config/routing.js` | 自動八方位（octilinear）佈線，家電位置改了會自動重算 |

## 家電節點（9 個）

`hrv`(新風機) · `ac`(冷氣) · `dehum`(除濕機) · `purifier`(空氣清淨機) · `sensor`(12合一感測器) · `light`(燈) · `socket`(智慧插座) · `curtain`(窗簾) · `bathfan`(浴室暖風機)

> ⚠ 桌面端 `uid-map.json` 目前只登記 5 張卡（`ac` / `hrv` / `light` / `socket` / `curtain`）。
> `dehum` / `purifier` / `sensor` / `bathfan` 待現場拿到實體模型後補登記，未登記前這四個節點刷卡不會亮
> （前端會先確認 `known` 才點亮）。補卡流程見 `F-table/README.md`「現場佈線」。

座標 / 尺寸目前為設計值，**正式量牆後**要回 `appliances.js` 校正 `x/y/w/h`。

## 自動佈線（`routing.js`）

- 每條 trace 只走 **0° / 45° / 90°**（45° 的倍數）的八方位線段。
- 主幹在家電自己的走道走正交（水平 / 垂直），最後一段以「最接近徑向朝內」的八方位插進中樞外環。
- 接點（pad）落在外環上（半徑 `RING_R = 116`，須與 `Hub.jsx` 的 `R` 一致）。
- 立柱若會穿過鄰框，自動外推一折繞過去（多折 OK）。
- 佈線幾何（八方位、避讓、pad 落點）沿用；但極簡版改用 `linePath()` 直接串折點，**不再倒角** —— 45° 斜角正是「電路板」的招牌特徵。
- `chamferPath()` 保留匯出但目前沒有元件在用，之後若要把倒角外觀加回來可直接切換。
- **家電位置改了不用手動改線**，重新 build 時會自動重算。

## 配色 / 設計 token

極簡黑灰白透明（樣本版），token 定義在 `src/config/theme.js`，三端共用同一組名稱與數值。

| 用途 | token | 值 |
| --- | --- | --- |
| 背景 | `bg` | `#000000` — 投影機的黑 = 不出光，牆上實體展品才不會被打亮。**這不是配色偏好，不要改成深灰。** |
| 走線 idle | `line` | `rgba(255,255,255,0.10)` |
| 家電框 idle / 面板外框 | `lineStrong` | `rgba(255,255,255,0.22)` |
| active 高光 | `lineActive` | `rgba(255,255,255,0.85)` |
| 文字三階 | `text` / `text2` / `text3` | `0.95` / `0.62` / `0.38` |

家電框 idle 用 `lineStrong` 而走線用 `line`，是刻意分兩階：九個框是牆上實體展品的位置，
attract 狀態（還沒人刷卡）觀眾走近就該看得到；走線則要安靜。環境光會把投影的黑墊高，
`0.10` 那一階在現場幾乎看不見。

狀態色（`warn` / `err`）樣本階段一併走無彩，語意由文字與「圓點實心 vs 空心」承擔。
要開回琥珀 / 紅，改 `theme.js` 裡註解好的那兩行。

字體：Latin / 數字走系統字（`-apple-system` / `Segoe UI`）並開 `tabular-nums`；
CJK 用 Chiron Hei HK，fallback 到 `PingFang TC` / 微軟正黑體。
⚠ 字體是從 CDN 抓的，展場離線時會退到 fallback —— `portable/` 若要真的免連網，得把字體檔自帶進去。
