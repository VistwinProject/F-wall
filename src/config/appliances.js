// ============================================================================
// 9 個家電節點設定 — 牆面投影唯一要改的地方
// ----------------------------------------------------------------------------
// id   : 跨三畫面 freeze 的 key，對齊桌面 SYNC-SPEC.md / server uid-map。
//        桌面 tag-present 的 data.id 必須是這組之一，牆面才對得到節點。
//        九個 id：hrv / ac / dehum / purifier / sensor / light / socket / curtain / bathfan
//        ⚠ uid-map 目前只登記 5 張卡，sensor / dehum / purifier / bathfan 待現場拿到
//          實體模型後補登記（流程見 F-table/README.md「現場佈線」）。
// label: 投影上顯示的文字
// x,y  : 黑色矩形「中心」座標，viewBox 1920x1080（16:9 投影面）
// w,h  : 黑色矩形長寬（刻意長寬不一，對齊牆上實體立方體模型的投影框）
//
// route：可選的手動走線路徑（見 routing.js）。下排四個家電的自動路徑會壓到鄰框，
//   故手動指定；除濕機 / 空氣清淨機 / 智慧插座 維持自動。
//
// slot 不寫死在這裡：桌面 slot↔家電採動態(方案 A)，牆面靠 data.id 認家電，
// 執行期再記 slot→id（見 useDeskState）。正式量牆後校正 x/y/w/h。
// ============================================================================

export const HUB = { x: 960, y: 540, size: 150, label: 'AI 大腦中樞' }

export const VIEWBOX = { w: 1920, h: 1080 }

// 正中上方預留給「實體螢幕(電視)」的淨空區：這塊不准排家電、也不准有連線穿過。
// 尺寸照實機紅框（約 540×280），中心 (960, 215)，剛好落在中樞圓環上方、不打到核心。
export const RESERVED_SCREEN = { x: 960, y: 215, w: 540, h: 280 }

// 設計 token 已移出到 config/theme.js —— 這個檔案只留「幾何 + 內容」。
// 舊版把色票混在這裡，導致「刪掉設計檔」會連帶毀掉牆面座標；分開後就不會誤刪。

// 位置刻意打散（不規則網格），框框大小≈各家電實體尺寸的相對比例。
// 正中上方只留小塊給電視(RESERVED_SCREEN)；左/右家電靠內側，預留「外側」放狀態面板；
// 下方家電的狀態面板開在框框下方。連線一律往中樞（內側）走，面板一律往外側開，互不打架。
//
// panelDir：active 時狀態面板開的方向（L 往左 / R 往右 / B 往下）。
// status：active 時面板顯示的設備運作資訊（mock；之後接 Welltek API §5）。
//   tone: ok=正常 / warn=即將到期 / err=離線。樣本階段三者皆為無彩，靠字重與圓點實心/空心區分。
export const APPLIANCES = [
  // 上排（跨在電視預留區兩側）
  { id: 'hrv',     label: '新風機', x: 468,  y: 170, w: 295, h: 170, panelDir: 'L',
    status: { code: 'HRV-02', state: '運轉中', tone: 'ok', rows: [['CO₂', '620 ppm'], ['風量', '中速']] } },
  { id: 'ac',      label: '冷氣',   x: 1440, y: 170, w: 310, h: 140, panelDir: 'R',
    status: { code: 'AC-07', state: '製冷中', tone: 'ok', rows: [['設定溫度', '26.5°C'], ['功率', '1.18 kW']] } },
  // 中排（中樞左右）
  { id: 'dehum',   label: '除濕機', x: 468,  y: 534, w: 200, h: 325, panelDir: 'L',
    status: { code: 'DH-01', state: '除濕中', tone: 'ok', rows: [['目前濕度', '58%'], ['水箱', '40%']] } },
  { id: 'purifier', label: '空氣清淨機', x: 1435, y: 534, w: 140, h: 370, panelDir: 'R',
    status: { code: 'AP-06', state: '淨化中', tone: 'ok', rows: [['PM2.5', '12 µg/m³'], ['濾網壽命', '72%']] } },
  // 下排（五個並排）— panelDir 'T'：面板開在框「上方」。
  //   框底已到 y≈997，下方放不下 116 高的面板（會被 1080 底邊切掉），故往上開。
  //   面板會自動水平避讓中排的高框（見 ApplianceNode.jsx 的 avoidX）。
  { id: 'sensor',  label: '12合一感測器', x: 310, y: 900, w: 225, h: 115, panelDir: 'T',
    // 上到燈面板下緣(790) → 水平右 → 走 796–850 走廊上行 → 45° 斜插中樞
    route: [[310, 790], [826, 790], [826, 629]],
    status: { code: 'SEN-09', state: '偵測中', tone: 'ok', rows: [['溫濕', '24° / 55%'], ['空氣', '良好']] } },
  { id: 'light',   label: '燈',     x: 620,  y: 900, w: 125, h: 195, panelDir: 'T',
    // 右出框 → 走 796–850 走廊上行 → 45° 斜插中樞
    route: [[800, 900], [800, 705], [848, 657]],
    status: { code: 'LT-03', state: '開啟', tone: 'ok', rows: [['亮度', '80%'], ['色溫', '4000K']] } },
  { id: 'socket',  label: '智慧插座', x: 960, y: 900, w: 235, h: 125, panelDir: 'T',
    status: { code: 'PG-04', state: '供電中', tone: 'ok', rows: [['即時負載', '340 W'], ['今日用電', '2.1 kWh']] } },
  { id: 'curtain', label: '窗簾',   x: 1290, y: 900, w: 185, h: 185, panelDir: 'T',
    // 左出框 → 走 1070–1137 走廊上行 → 一條 45° 直接收進 pad
    //   （692.1 是讓斜線剛好 45° 對準 pad(1038.4,625.5) 算出來的）
    route: [[1105, 900], [1105, 692.1]],
    status: { code: 'CT-05', state: '開啟', tone: 'ok', rows: [['位置', '60%'], ['模式', '自動']] } },
  { id: 'bathfan', label: '浴室暖風機', x: 1600, y: 900, w: 195, h: 180, panelDir: 'T',
    // 上到窗簾面板下緣(800) → 水平左過窗簾框上方 → 走 1070–1137 走廊上行 → 45° 斜插中樞
    route: [[1600, 800], [1125, 800], [1125, 661], [1093, 629]],
    status: { code: 'BF-08', state: '暖風運轉', tone: 'ok', rows: [['模式', '暖風'], ['濕度', '62%']] } },
]

export const APPLIANCE_IDS = APPLIANCES.map((a) => a.id)
