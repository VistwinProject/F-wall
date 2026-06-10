// ============================================================================
// 9 個家電節點設定 — 牆面投影唯一要改的地方
// ----------------------------------------------------------------------------
// id   : 跨三畫面 freeze 的 key，對齊桌面 SYNC-SPEC.md / server uid-map。
//        桌面 tag-present 的 data.id 必須是這組之一，牆面才對得到節點。
//        ⚠ camera / sensor 是第 8、9 個，桌面 §5 目前只列 7 個，需請桌面端補上。
// label: 投影上顯示的文字
// x,y  : 黑色矩形「中心」座標，viewBox 1920x1080（16:9 投影面）
// w,h  : 黑色矩形長寬（刻意長寬不一，對齊牆上實體立方體模型的投影框）
//
// slot 不寫死在這裡：桌面 slot↔家電採動態(方案 A)，牆面靠 data.id 認家電，
// 執行期再記 slot→id（見 useDeskState）。正式量牆後校正 x/y/w/h。
// ============================================================================

export const HUB = { x: 960, y: 540, size: 150, label: 'AI 大腦中樞' }

export const VIEWBOX = { w: 1920, h: 1080 }

// 正中上方預留給「實體螢幕(電視)」的淨空區：這塊不准排家電、也不准有連線穿過。
// 尺寸照實機紅框（約 540×280），中心 (960, 215)，剛好落在中樞圓環上方、不打到核心。
export const RESERVED_SCREEN = { x: 960, y: 215, w: 540, h: 280 }

// 設計 token（對齊桌面 SYNC-SPEC.md §7，主色 teal，不准用別的）
export const COLORS = {
  idle: '#16596e', // 微弱底噪線（idle 要安靜）
  active: '#00dcdc', // beam-cyan 高亮
  accent: '#009393', // 主 teal（中樞）
  accent2: '#4dbaba', // accent-2
  highlight: '#dcffff', // sweep 慧星亮白 rgba(220,255,255,0.95)
  labelIdle: '#3f7283',
  labelActive: '#9ff5f5',
  grid: '#0a2c36', // 格線更暗，不搶戲
  warn: '#f59e0b', // §7 amber：警告 / 即將到期
  err: '#f43f5e', // §7 red：錯誤 / 離線
}

// 位置刻意打散（不規則網格），框框大小≈各家電實體尺寸的相對比例。
// 正中上方只留小塊給電視(RESERVED_SCREEN)；左/右家電靠內側，預留「外側」放狀態面板；
// 下方家電的狀態面板開在框框下方。連線一律往中樞（內側）走，面板一律往外側開，互不打架。
//
// panelDir：active 時狀態面板開的方向（L 往左 / R 往右 / B 往下）。
// status：active 時面板顯示的設備運作資訊（mock；之後接 Welltek API §5）。
//   tone: ok=正常(teal) / warn=即將到期(amber) / err=離線(red)。
export const APPLIANCES = [
  // 左半（L）：面板往左開
  { id: 'door',    label: '門',     x: 470,  y: 250, w: 150, h: 230, panelDir: 'L',
    status: { code: 'DR-01', state: '已鎖定', tone: 'ok', rows: [['門鎖', 'SECURED'], ['今日進出', '12']] } },
  { id: 'light',   label: '燈',     x: 450,  y: 560, w: 90,  h: 90,  panelDir: 'L',
    status: { code: 'LT-03', state: '開啟', tone: 'ok', rows: [['亮度', '80%'], ['色溫', '4000K']] } },
  { id: 'socket',  label: '插座',   x: 460,  y: 850, w: 70,  h: 70,  panelDir: 'L',
    status: { code: 'PG-04', state: '供電中', tone: 'ok', rows: [['即時負載', '340 W'], ['今日用電', '2.1 kWh']] } },
  // 右半（R）：面板往右開
  { id: 'curtain', label: '窗簾',   x: 1450, y: 260, w: 220, h: 200, panelDir: 'R',
    status: { code: 'CT-05', state: '開啟', tone: 'ok', rows: [['位置', '60%'], ['模式', '自動']] } },
  { id: 'sound',   label: '音響',   x: 1595, y: 560, w: 120, h: 190, panelDir: 'R',
    status: { code: 'SD-06', state: '播放中', tone: 'ok', rows: [['音量', '42%'], ['來源', '藍牙']] } },
  { id: 'sensor',  label: '感測器', x: 1460, y: 850, w: 70,  h: 70,  panelDir: 'R',
    status: { code: 'SEN-09', state: '偵測中', tone: 'ok', rows: [['溫濕', '24° / 55%'], ['空氣', '良好']] } },
  // 下方（B）：面板往下開
  { id: 'hrv',     label: '新風機', x: 720,  y: 810, w: 180, h: 140, panelDir: 'B',
    status: { code: 'HRV-02', state: '運轉中', tone: 'ok', rows: [['CO₂', '620 ppm'], ['風量', '中速']] } },
  { id: 'camera',  label: '攝影機', x: 1000, y: 810, w: 90,  h: 80,  panelDir: 'B',
    status: { code: 'CAM-08', state: '監控中', tone: 'ok', rows: [['解析度', '1080P'], ['位移偵測', '靜止']] } },
  { id: 'ac',      label: '冷氣',   x: 1250, y: 840, w: 240, h: 110, panelDir: 'B',
    status: { code: 'AC-07', state: '製冷中', tone: 'ok', rows: [['設定溫度', '26.5°C'], ['功率', '1.18 kW']] } },
]

export const APPLIANCE_IDS = APPLIANCES.map((a) => a.id)
