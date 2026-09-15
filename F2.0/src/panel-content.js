// Wall and iPad display content; independent of Table usage/chart data.
export const PANEL_CONTENT={
  purifier:{label:'空氣清淨機',rows:[['濾網壽命','65%'],['累積運轉','2,860 小時'],['','預估 96 天後更換濾網']]},
  ac:{label:'冷氣',rows:[['累積運轉','6,523 小時'],['下次維養','2026/09'],['','濾網清洗、出風口清潔、冷媒檢查']]},
  light:{label:'燈光',rows:[['已使用','8,200 / 25,000 小時'],['剩餘壽命','67%'],['','預估 2033 年更換']]},
  socket:{label:'智慧插座',rows:[['本月總用電','284 kWh'],['','較上月下降 8%'],['','最大耗能設備：客廳冷氣']]},
  curtain:{label:'窗簾',rows:[['馬達累積運轉','8,200 次'],['','距離下次保養約 1,800 次']]},
  bathfan:{label:'浴室暖風機',rows:[['累積運轉','1,180 小時'],['本月運轉','34 次'],['','建議清潔進風濾網']]},
  hrv:{label:'新風機',rows:[['濾網壽命','72%'],['累積運轉','4,320 小時'],['','預估 124 天後更換濾網']]},
  sensor:{label:'12 合 1 感測器',rows:[['溫度','26°C'],['濕度','72%'],['CO2','734 ppm'],['PM2.5','8'],['','甲醛正常']]},
  dehum:{label:'除濕機',rows:[['本月運轉','126 小時'],['累積運轉','1,532 小時'],['耗電量','48 kWh'],['下次維養','2027/03'],['','建議清潔集水箱與濾網']]},
};
// Client-approved red-box wall copy; keep iPad data independent.
export const WALL_PANEL_CONTENT={
  ...PANEL_CONTENT,
  purifier:{label:'空氣清淨機',rows:[['濾網壽命','63%'],['累積運轉','2,830 小時'],['','預估 98 天後更換濾網']]},
  bathfan:{label:'浴室暖風機',rows:[['累積運轉','820 小時'],['平均升溫','5.8°C'],['下次維養','2027/06'],['','加熱模組、排風系統檢查']]},
};
export function panelFacts(id,view='ipad'){
  const content=view==='wall'?WALL_PANEL_CONTENT:PANEL_CONTENT;
  return `<dl class="device-facts">${content[id].rows.map(([key,value])=>key?`<div><dt>${key}</dt><dd>${value}</dd></div>`:`<div class="fact-note"><dd>${value}</dd></div>`).join('')}</dl>`;
}
