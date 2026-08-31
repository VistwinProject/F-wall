# F-wall — 寶鋪 showcase F 區「AI 大腦控制塔」牆面投影

NFC 卡片放上桌面讀卡機 → 牆面對應的家電節點亮起，一道彗星沿電路板走線流向中央 AI 中樞。
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
| `WallScene.jsx` | SVG 根、背景格線、中樞柔光、電視預留位、家電節點列表 |
| `Hub.jsx` | 中央 AI 中樞（同心環 + 放射刻度 + 旋轉弧 + 發光核），外環半徑 `R = 116` |
| `ApplianceNode.jsx` | 單一家電：電路板走線、環上接點、彗星動畫、黑色挖空框、狀態面板 |
| `config/appliances.js` | **唯一要改的設定檔**：9 家電的 id / label / 座標 / 尺寸 / 面板方向 / 狀態，以及 HUB、預留螢幕區、配色 token |
| `config/routing.js` | 自動八方位（octilinear）PCB 佈線，家電位置改了會自動重算 |

## 家電節點（9 個）

`hrv`(新風機) · `ac`(冷氣) · `dehum`(除濕機) · `purifier`(空氣清淨機) · `sensor`(12合一感測器) · `light`(燈) · `socket`(智慧插座) · `curtain`(窗簾) · `bathfan`(浴室暖風機)

> ⚠ 桌面端 `uid-map.json` 目前只登記 5 張卡（`ac` / `hrv` / `light` / `socket` / `curtain`）。
> `dehum` / `purifier` / `sensor` / `bathfan` 待現場拿到實體模型後補登記，未登記前這四個節點刷卡不會亮
> （前端會先確認 `known` 才點亮）。補卡流程見 `F-table/README.md`「現場佈線」。

座標 / 尺寸目前為設計值，**正式量牆後**要回 `appliances.js` 校正 `x/y/w/h`。

## 自動 PCB 佈線（`routing.js`）

- 每條 trace 只走 **0° / 45° / 90°**（45° 的倍數）的八方位線段。
- 主幹在家電自己的走道走正交（水平 / 垂直），最後一段以「最接近徑向朝內」的八方位插進中樞外環。
- 接點（pad）落在外環上（半徑 `RING_R = 116`，須與 `Hub.jsx` 的 `R` 一致）。
- 立柱若會穿過鄰框，自動外推一折繞過去（多折 OK）。
- `chamferPath()` 把直角轉折切成 45° 斜角（電路板招牌外觀），且只切真正的 90° 軸向轉角，避免切出非八方位線段。
- **家電位置改了不用手動改線**，重新 build 時會自動重算。

## 配色

主色 teal，對齊 SYNC-SPEC §7：`active #00dcdc`、`accent #009393`、`highlight #dcffff`、警告 `warn #f59e0b`、離線 `err #f43f5e`。
