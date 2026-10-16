// Versioned cloud backups: upload immutable parts, validate, then publish.
const FUNCTION_NAME = 'userBackup';
const META_KEY = 'cloud_backup_meta';
const PART_SIZE = 200 * 1024;
const MAX_PARTS = 40;
const AUTO_INTERVAL_MS = 6 * 60 * 60 * 1000;
const EXCLUDED_KEYS = [META_KEY, 'logs'];
let busy = false;
function hashString(text) { let hash = 5381; for (let i = 0; i < text.length; i++) hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0; return (hash >>> 0).toString(36) + text.length.toString(36); }
function byteSize(text) { let count = 0; for (const char of text) { const code = char.codePointAt(0); count += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4; } return count; }
function allowed(key) { return !EXCLUDED_KEYS.includes(key) && !String(key).startsWith('__') && !['constructor', 'prototype'].includes(key); }
function buildSnapshot(keys, read) {
  const data = {};
  (keys || []).filter(allowed).sort().forEach(key => { const value = read(key); if (value !== undefined && value !== '') data[key] = value; });
  const body = JSON.stringify(data);
  return { data, keyCount: Object.keys(data).length, hash: hashString(body), body };
}
function splitText(text, size) {
  const step = size || PART_SIZE;
  const parts = [];
  let current = '', bytes = 0;
  for (const char of text) {
    const length = byteSize(char);
    if (bytes && bytes + length > step) { parts.push(current); current = ''; bytes = 0; }
    current += char; bytes += length;
  }
  if (current || !parts.length) parts.push(current);
  return parts;
}
function parseSnapshot(text) {
  let parsed; try { parsed = JSON.parse(text); } catch (_) { throw new Error('bad_backup'); }
  if (!parsed || parsed.version !== 1 || !parsed.data || typeof parsed.data !== 'object' || Array.isArray(parsed.data)
    || Object.keys(parsed.data).some(key => !allowed(key))) throw new Error('bad_backup');
  return parsed;
}
function shouldAutoBackup(meta, hash, now) {
  if (!meta || !meta.savedAt || meta.hash === hash) return false;
  return now - new Date(meta.savedAt).getTime() >= AUTO_INTERVAL_MS;
}
function call(data) {
  return new Promise((resolve, reject) => {
    if (!wx.cloud || !wx.cloud.callFunction) { reject(new Error('cloud_unavailable')); return; }
    wx.cloud.callFunction({ name: FUNCTION_NAME, data,
      success: response => { const result = response && response.result;
        if (result && result.ok) resolve(result);
        else { const error = new Error(result && result.error || 'call_failed');
          error.stage = result && result.stage || '';
          error.code = result && result.code || '';
          error.detail = result && result.detail || '';
          error.requestId = response && response.requestID || '';
          reject(error);
        }
      },
      fail: error => reject(new Error(error && error.errMsg || 'call_failed'))
    });
  });
}
function readLocalSnapshot() { return buildSnapshot(wx.getStorageInfoSync().keys, key => wx.getStorageSync(key)); }
async function backupNow() {
  if (busy) throw new Error('backup_busy');
  busy = true;
  try {
    const snapshot = readLocalSnapshot();
    const text = JSON.stringify({ version: 1, savedAt: new Date().toISOString(), data: snapshot.data });
    const parts = splitText(text);
    if (parts.length > MAX_PARTS) throw new Error('backup_too_large');
    const upload = await call({ action: 'begin', total: parts.length, size: byteSize(text), hash: snapshot.hash, keyCount: snapshot.keyCount });
    if (!/^[a-f0-9]{32}$/.test(upload.version || '')) throw new Error('service_outdated');
    for (let part = 0; part < parts.length; part++) await call({ action: 'savePart', version: upload.version, part, data: parts[part] });
    const committed = await call({ action: 'commit', version: upload.version });
    if (committed.contentHash !== hashString(text)) throw new Error('checksum_mismatch');
    const meta = { savedAt: committed.savedAt, hash: snapshot.hash, version: upload.version, keyCount: snapshot.keyCount, size: byteSize(text) };
    wx.setStorageSync(META_KEY, meta);
    return meta;
  } finally { busy = false; }
}
function getStatus() { return call({ action: 'status' }); }
function repairRecordIndexes() {
  const allKeys = wx.getStorageInfoSync().keys;
  ['training', 'nutrition'].forEach(kind => {
    const dates = allKeys.filter(key => new RegExp('^' + kind + '_\\d{4}-\\d{2}-\\d{2}$').test(key))
      .filter(key => { const value = wx.getStorageSync(key); return kind === 'nutrition' ? Array.isArray(value) && value.length > 0 : value && typeof value === 'object' && !Array.isArray(value); })
      .map(key => key.slice(kind.length + 1)).sort().reverse();
    const indexKey = kind + '_dates';
    if (dates.length || allKeys.includes(indexKey)) wx.setStorageSync(indexKey, dates);
  });
}
async function restoreFromCloud() {
  if (busy) throw new Error('backup_busy');
  busy = true;
  try {
    const head = await getStatus();
    const total = Number(head.total);
    if (!head.exists) throw new Error('not_found');
    if (!Number.isInteger(total) || total < 1 || total > MAX_PARTS) throw new Error('bad_backup');
    const texts = [];
    for (let part = 0; part < total; part++) {
      const piece = await call({ action: 'loadPart', version: head.version || '', part });
      if (piece.part !== part || piece.total !== total || typeof piece.data !== 'string'
        || (head.version && piece.version !== head.version)) throw new Error('bad_backup');
      texts.push(piece.data);
    }
    const text = texts.join('');
    const snapshot = parseSnapshot(text);
    if (head.contentHash && hashString(text) !== head.contentHash) throw new Error('checksum_mismatch');
    if (head.hash && hashString(JSON.stringify(snapshot.data)) !== head.hash) throw new Error('checksum_mismatch');
    const info = wx.getStorageInfoSync();
    const keys = Object.keys(snapshot.data);
    const transactionKeys = [...new Set(keys.concat(META_KEY, 'training_dates', 'nutrition_dates'))];
    const before = {};
    transactionKeys.forEach(key => { before[key] = { exists: info.keys.includes(key), value: wx.getStorageSync(key) }; });
    try {
      keys.forEach(key => wx.setStorageSync(key, snapshot.data[key]));
      // Restore replaces matching records and retains local-only records. Rebuild
      // indexes so those newer records remain reachable from calendar/list pages.
      repairRecordIndexes();
      const local = readLocalSnapshot();
      wx.setStorageSync(META_KEY, { savedAt: head.savedAt || snapshot.savedAt, hash: head.hash || hashString(JSON.stringify(snapshot.data)), version: head.version || '', keyCount: local.keyCount });
    }
    catch (error) {
      transactionKeys.filter(key => !before[key].exists).forEach(key => wx.removeStorageSync(key));
      transactionKeys.filter(key => before[key].exists).forEach(key => wx.setStorageSync(key, before[key].value));
      throw new Error('restore_write_failed');
    }
    return { savedAt: head.savedAt || snapshot.savedAt, keyCount: keys.length };
  } finally { busy = false; }
}
function autoBackup() {
  try {
    if (busy || !wx.cloud || typeof wx.getStorageInfoSync !== 'function') return;
    const meta = wx.getStorageSync(META_KEY);
    if (!meta || !meta.savedAt) return;
    const snapshot = readLocalSnapshot();
    if (snapshot.keyCount && shouldAutoBackup(meta, snapshot.hash, Date.now())) backupNow().catch(() => {});
  } catch (_) { /* A background failure never replaces the last successful metadata. */ }
}
module.exports = { META_KEY, PART_SIZE, MAX_PARTS, AUTO_INTERVAL_MS, hashString, byteSize, buildSnapshot, splitText,
  parseSnapshot, shouldAutoBackup, backupNow, getStatus, restoreFromCloud, autoBackup };
