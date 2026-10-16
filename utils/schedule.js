// Pure schedule rules shared by Today, the editor and reminder planning.
const REST_ID = '__weekday_rest__';
function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function addDays(key, offset) { const date = new Date(key + 'T12:00:00'); date.setDate(date.getDate() + offset); return dateKey(date); }
function weekday(key) { return new Date(key + 'T12:00:00').getDay() || 7; }
function normalize(value, days) {
  const ids = new Set((days || []).map(day => day.id));
  const weekdays = {};
  for (let i = 1; i <= 7; i += 1) {
    const id = value && value.weekdays && value.weekdays[i];
    if (typeof id === 'string' && ids.has(id)) weekdays[i] = id;
  }
  return { mode: value && value.mode === 'weekday' ? 'weekday' : 'cycle', weekdays };
}
function withRestDay(plan) {
  if (!plan || !plan.schedule || plan.schedule.mode !== 'weekday' || (plan.days || []).some(day => day.type === 'rest')) return plan;
  return { ...plan, days: (plan.days || []).concat({ id: REST_ID, type: 'rest', name: '休息日', icon: '🌿', color: '#5F9A88', exercises: [], description: '今天未安排训练，给身体留出恢复时间。' }) };
}
function resolveDay(plan, records, date) {
  const days = plan && plan.days || [];
  if (!days.length) return null;
  if (plan.schedule && plan.schedule.mode === 'weekday') {
    const id = plan.schedule.weekdays[weekday(date)];
    return days.find(day => day.id === id) || days.find(day => day.type === 'rest') || null;
  }
  const latest = (records || []).filter(record => record && record.date <= date && (!record.planId || record.planId === plan.id)
    && days.some(day => day.id === (record.dayId || record.dayType))).slice().sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!latest) return days[0];
  const index = days.findIndex(day => day.id === (latest.dayId || latest.dayType));
  return days[latest.date === date ? index : (index + 1) % days.length];
}
function upcoming(plan, records, from, count) {
  const effective = withRestDay(plan);
  const simulated = (records || []).slice();
  return Array.from({ length: count || 14 }, (_, offset) => {
    const date = addDays(from, offset);
    const day = resolveDay(effective, simulated, date);
    if (day && !simulated.some(record => record && record.date === date && (!record.planId || record.planId === effective.id))) {
      simulated.push({ date, planId: effective.id, dayId: day.id });
    }
    return { date, dayId: day && day.id || '', name: day && day.name || '休息日', isRest: !day || day.type === 'rest' };
  });
}
module.exports = { REST_ID, dateKey, addDays, weekday, normalize, withRestDay, resolveDay, upcoming };
