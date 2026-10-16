// Local preferences are separate from WeChat subscription authorization.
const KEY = 'training_reminder_settings';
function normalize(value) {
  const input = value || {};
  return { enabled: input.enabled === true, time: /^([01]\d|2[0-3]):[0-5]\d$/.test(input.time || '') ? input.time : '20:00',
    timezoneOffset: Number.isFinite(input.timezoneOffset) ? input.timezoneOffset : new Date().getTimezoneOffset(),
    updatedAt: input.updatedAt || '', scheduleChanged: input.scheduleChanged === true };
}
function load() { return normalize(wx.getStorageSync(KEY)); }
function save(value) { const settings = { ...normalize(value), updatedAt: new Date().toISOString() }; wx.setStorageSync(KEY, settings); return settings; }
function markScheduleChanged() { const value = load(); if (value.enabled) save({ ...value, scheduleChanged: true }); }
function upcoming(plan, records, today) {
  return require('./schedule.js').upcoming(plan, records, today, 14).filter(day => !day.isRest)
    .filter(day => !(records || []).some(record => record && record.date === day.date && record.type !== 'rest'));
}
module.exports = { KEY, normalize, load, save, markScheduleChanged, upcoming };
