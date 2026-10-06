export const REPORT_TYPES=[
  {id:'health',label:'健康報告',video:'/table-reports/health.mp4'},
  {id:'energy',label:'用電報告',video:'/table-reports/energy.mp4'},
  {id:'maintenance',label:'設備維養報告',video:'/table-reports/maintenance.mp4'},
];

export const DEVICE_REPORT={
  sensor:'health',curtain:'health',hrv:'health',
  ac:'energy',socket:'energy',dehum:'energy',
  light:'maintenance',purifier:'maintenance',bathfan:'maintenance',
};

export function tableReports(id,deviceLabel){
  const report=REPORT_TYPES.find(report=>report.id===DEVICE_REPORT[id]);
  return `<div class="table-reports"><section class="table-report" data-report="${report.id}" aria-label="${report.label}"><header><h1>365 app</h1><div class="table-report-heading"><p>${deviceLabel}</p></div></header><div class="table-report-media"><div class="table-report-phone"><div class="table-report-crop"><video class="table-report-video" src="${report.video}" autoplay muted playsinline preload="auto" aria-label="${report.label}影片"></video></div></div></div></section></div>`;
}
