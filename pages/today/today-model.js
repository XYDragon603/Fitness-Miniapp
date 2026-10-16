const schedule = require('../../utils/schedule.js');
function formatDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function buildOverview(plan, records, today, selectedDayId) {
  const days = plan && Array.isArray(plan.days) ? plan.days : [];
  const list = (records || []).filter(Boolean).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const belongs = record => (!record.planId || record.planId === (plan && plan.id)) && days.some(day => day.id === (record.dayId || record.dayType));
  const latest = list.find(record => record.date <= today && belongs(record));
  let selectedIndex = days.findIndex(day => day.id === selectedDayId);
  if (selectedIndex < 0 && latest && latest.date === today) selectedIndex = days.findIndex(day => day.id === (latest.dayId || latest.dayType));
  if (selectedIndex < 0 && plan && plan.schedule && plan.schedule.mode === 'weekday') {
    const planned = schedule.resolveDay(plan, records, today);
    selectedIndex = days.findIndex(day => planned && day.id === planned.id);
  }
  if (selectedIndex < 0 && latest) {
    const lastIndex = days.findIndex(day => day.id === (latest.dayId || latest.dayType));
    selectedIndex = latest.date === today ? lastIndex : (lastIndex + 1) % days.length;
  }
  if (selectedIndex < 0) selectedIndex = days.length ? 0 : -1;
  const date = new Date(today + 'T12:00:00');
  date.setDate(date.getDate() - (date.getDay() + 6) % 7);
  const week = ['一', '二', '三', '四', '五', '六', '日'].map(label => {
    const key = formatDate(date);
    const record = list.find(item => item.date === key);
    const rest = record && record.type === 'rest';
    const status = !record ? '' : rest ? (record.restCompleted === false ? '待恢复' : '休息') : Number(record.completionRate) >= 100 ? '完成' : '已记录';
    const item = { date: key, label, day: date.getDate(), status, isToday: key === today, isRest: !!rest };
    date.setDate(date.getDate() + 1);
    return item;
  });
  const selected = days[selectedIndex] || null;
  return {
    selectedIndex, selected,
    hasTodayRecord: !!(selected && list.some(item => item.date === today && belongs(item) && (item.dayId || item.dayType) === selected.id)),
    week, weekTrainingCount: week.filter(item => item.status && !item.isRest).length
  };
}

module.exports = { buildOverview };
