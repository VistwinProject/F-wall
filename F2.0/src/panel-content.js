// Client copy: 截圖 2026-09-14 晚上10.15.54.png.
export const PANEL_CONTENT={
  purifier:{label:'空氣清淨機',rows:[['濾網壽命','63%'],['累積運轉','2,830 小時'],['','預估 98 天後更換濾網']]},
  ac:{label:'冷氣',rows:[['累積運轉','6,523 小時'],['下次維養','2026/10'],['','濾網清洗、出風口清潔、冷媒檢查']]},
  light:{label:'燈光',rows:[['已使用','8,200 / 25,000 小時'],['剩餘壽命','67%'],['','預估 2033 年更換']]},
  socket:{label:'智慧插座',rows:[['本月總用電','284 kWh'],['','較上月下降 8%'],['','最大耗能設備：客廳冷氣']]},
  curtain:{label:'窗簾',rows:[['馬達累積運轉','8,200 次'],['','距離下次保養約 1,800 次']]},
  bathfan:{label:'浴室暖風機',rows:[['累積運轉','820 小時'],['平均升溫','5.8°C'],['下次維養','2027/06'],['','加熱模組、排風系統檢查']]},
  hrv:{label:'新風機',rows:[['濾網壽命','72%'],['累積運轉','4,320 小時'],['','預估 124 天後更換濾網']]},
  sensor:{label:'12 合 1 感測器',rows:[['溫度','26°C'],['濕度','72%'],['CO2','734 ppm'],['PM2.5','8'],['','甲醛正常']]},
  dehum:{label:'除濕機',rows:[['本月運轉','126 小時'],['累積運轉','1,532 小時'],['耗電量','48 kWh'],['下次維養','2027/03'],['','建議清潔集水箱與濾網']]},
};
export const TABLE_CONTENT={
  socket:{heading:'設備耗電排行',rows:[['1. 客廳冷氣','162 kWh'],['2. 除濕機','48 kWh'],['3. 電暖器','36 kWh']]},
  light:{heading:'客廳燈開啟',rows:[['亮度','70%'],['今日使用','5.2 小時']]},
  ac:{heading:'客廳降溫中',rows:[['目前','28°C → 目標 25°C'],['','舒適溫控啟動']]},
  hrv:{heading:'新風換氣中',rows:[['CO₂','912 ppm'],['風量','中']]},
  bathfan:{heading:'浴室預熱中',rows:[['目前','18°C → 目標 24°C'],['','溫差保護啟動']]},
  sensor:{heading:'空氣品質良好',rows:[['濕度','72%'],['PM2.5','8']]},
  dehum:{heading:'除濕中',rows:[['目前','72% → 目標 60%'],['','濕度控制啟動']]},
  purifier:{heading:'空氣淨化中',rows:[['目前 PM2.5','18 → 目標 7.9 以下'],['','淨化模式啟動']]},
  curtain:{heading:'客廳窗簾關閉 80%',rows:[['','西曬遮陽中']]},
};
// Compact iPad summaries use the same approved detail data.
export const IPAD_SUMMARY={
  socket:'本月用電 284 kWh',light:'剩餘壽命 67%',ac:'累積運轉 6,523 小時',
  hrv:'濾網壽命 72%',bathfan:'累積運轉 820 小時',sensor:'26°C · 濕度 72%',
  dehum:'本月運轉 126 小時',purifier:'濾網壽命 63%',curtain:'累積運轉 8,200 次',
};
// Client-approved red-box wall copy; keep iPad data independent.
export const WALL_PANEL_CONTENT={
  ...PANEL_CONTENT,
  ac:{...PANEL_CONTENT.ac,rows:PANEL_CONTENT.ac.rows.map(([key,value])=>[key,key==='下次維養'?'2026/09':value])},
  purifier:{label:'空氣清淨機',rows:[['濾網壽命','63%'],['累積運轉','2,830 小時'],['','預估 98 天後更換濾網']]},
  bathfan:{label:'浴室暖風機',rows:[['累積運轉','820 小時'],['平均升溫','5.8°C'],['下次維養','2027/06'],['','加熱模組、排風系統檢查']]},
};
export function panelFacts(id,view='ipad'){
  const content=view==='wall'?WALL_PANEL_CONTENT:view==='table'?TABLE_CONTENT:PANEL_CONTENT;
  return `<dl class="device-facts">${content[id].rows.map(([key,value])=>key?`<div><dt>${key}</dt><dd>${value}</dd></div>`:`<div class="fact-note"><dd>${value}</dd></div>`).join('')}</dl>`;
}
