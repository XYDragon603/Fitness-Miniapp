// The same bounded snapshot powers the exported image and shared mini-program card.
function cleanText(value, max) { return String(value || '').replace(/[\u0000-\u001f]/g, '').slice(0, max); }
function safeNumber(value, nullable) {
  if (nullable && (value === null || value === undefined)) return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(-1000000000, Math.min(1000000000, Math.round(number * 10) / 10)) : 0;
}
function snapshot(report) {
  const result = { kind: report.kind === 'week' ? 'week' : 'session', title: cleanText(report.title, 36),
    date: cleanText(report.date, 10), start: cleanText(report.start, 10), end: cleanText(report.end, 10),
    trainingCount: safeNumber(report.trainingCount), volume: safeNumber(report.volume), setCount: safeNumber(report.setCount),
    exerciseCount: safeNumber(report.exerciseCount), durationMin: safeNumber(report.durationMin),
    avgCalories: safeNumber(report.avgCalories, true), avgProtein: safeNumber(report.avgProtein, true),
    weightChange: safeNumber(report.weightChange, true), nutritionDays: safeNumber(report.nutritionDays),
    prCount: Array.isArray(report.newRecords) ? report.newRecords.length : safeNumber(report.prCount) };
  result.prNames = (report.prNames || (report.newRecords || []).map(pr => `${pr.name} · ${pr.label}`)).slice(0, 3).map(value => cleanText(value, 28));
  return result;
}
function parse(value) {
  try {
    if (typeof value !== 'string' || value.length > 6000) return null;
    const result = JSON.parse(value);
    if (!result || typeof result !== 'object' || Array.isArray(result)) return null;
    const validDate = require('./training-insights.js').validDate;
    if (result.kind === 'week' ? !(validDate(result.start) && validDate(result.end)) : result.kind !== 'session' || !validDate(result.date)) return null;
    return snapshot(result);
  } catch (_) { return null; }
}
function sharePath(report) { return '/pages/report/report?shared=' + encodeURIComponent(JSON.stringify(snapshot(report))); }
function render(canvas, report) {
  const data = snapshot(report);
  canvas.width = 750; canvas.height = 1120;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#12191C'; ctx.fillRect(0, 0, 750, 1120);
  const text = (value, x, y, size, color, bold) => {
    ctx.fillStyle = color || '#F6F4EE'; ctx.font = `${bold ? 'bold ' : ''}${size}px sans-serif`; ctx.fillText(String(value), x, y);
  };
  text('练迹记录', 56, 84, 24, '#C8F76E', true);
  text(data.kind === 'week' ? '这一周，都算数。' : '又一次，完成。', 56, 165, 48, '', true);
  text(data.kind === 'week' ? `${data.start} — ${data.end}` : data.date, 56, 218, 24, '#A7B0B4');
  text(data.title.slice(0, 16), 56, 285, 32, '', true);
  ctx.fillStyle = '#202A2F'; ctx.fillRect(44, 330, 662, 200);
  text('训练量', 70, 375, 24, '#A7B0B4');
  // 不用 toLocaleString：iOS 的 JSCore 不一定按 en-US 加千分位
  text(String(Math.round(data.volume)).replace(/\B(?=(\d{3})+(?!\d))/g, ','), 70, 468, 74, '#C8F76E', true);
  text('kg', 590, 468, 28, '#C8F76E');
  const metrics = data.kind === 'week' ? [['训练', data.trainingCount + ' 次'], ['新纪录', data.prCount + ' 项'],
    ['平均摄入', data.avgCalories === null ? '未记录' : data.avgCalories + ' kcal'], ['体重变化', data.weightChange === null ? '记录不足' : (data.weightChange > 0 ? '+' : '') + data.weightChange + ' kg']]
    : [['动作', data.exerciseCount + ' 个'], ['完成组', data.setCount + ' 组'], ['时长', data.durationMin ? data.durationMin + ' 分钟' : '未计时'], ['新纪录', data.prCount + ' 项']];
  metrics.forEach((metric, index) => {
    const x = 56 + (index % 2) * 345; const y = 600 + Math.floor(index / 2) * 118;
    text(metric[0], x, y, 23, '#A7B0B4'); text(metric[1], x, y + 48, 34, '', true);
  });
  if (data.kind === 'week') text(`平均摄入按 ${data.nutritionDays} 个有记录日计算`, 56, 855, 20, '#A7B0B4');
  data.prNames.slice(0, 2).forEach((name, index) => text(name, 56, 920 + index * 34, 21, '#C8F76E'));
  text('每一次，都在积累进步。', 56, 1040, 26, '', true);
  return data;
}
module.exports = { snapshot, parse, sharePath, render };
