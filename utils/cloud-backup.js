// 本地数据 <-> 云端备份（云函数 userBackup）。打包、拆分、校验是纯函数，方便测试。
const FUNCTION_NAME = 'userBackup';
const META_KEY = 'cloud_backup_meta';
const PART_SIZE = 256 * 1024;
const AUTO_INTERVAL_MS = 6 * 60 * 60 * 1000;
// 不备份：备份自身的记录、调试日志
const EXCLUDED_KEYS = [META_KEY, 'logs'];

function hashString(text) {
  let hash = 5381;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) + hash + text.charCodeAt(index)) | 0;
  }
  return (hash >>> 0).toString(36) + text.length.toString(36);
}

function buildSnapshot(keys, read) {
  const data = {};
  (keys || []).filter(key => !EXCLUDED_KEYS.includes(key) && !String(key).startsWith('__')).sort().forEach(key => {
    const value = read(key);
    if (value !== undefined && value !== '') data[key] = value;
  });
  const body = JSON.stringify(data);
  return { data, keyCount: Object.keys(data).length, hash: hashString(body), body };
}

function splitText(text, size) {
  const step = size || PART_SIZE;
  const parts = [];
  for (let index = 0; index < text.length; index += step) parts.push(text.slice(index, index + step));
  return parts.length ? parts : [''];
}

function parseSnapshot(text) {
  const parsed = JSON.parse(text);
  if (!parsed || parsed.version !== 1 || typeof parsed.data !== 'object') throw new Error('bad_backup');
  return parsed;
}

function shouldAutoBackup(meta, hash, now) {
  if (!meta || !meta.savedAt) return true;
  if (meta.hash === hash) return false;
  return now - new Date(meta.savedAt).getTime() >= AUTO_INTERVAL_MS;
}

// ---------- 调用云函数 ----------
function call(data) {
  return new Promise((resolve, reject) => {
    if (!wx.cloud || !wx.cloud.callFunction) {
      reject(new Error('cloud_unavailable'));
      return;
    }
    wx.cloud.callFunction({
      name: FUNCTION_NAME,
      data,
      success: res => {
        const result = res && res.result;
        if (result && result.ok) resolve(result);
        else reject(new Error((result && result.error) || 'call_failed'));
      },
      fail: error => reject(new Error((error && error.errMsg) || 'call_failed'))
    });
  });
}

function readLocalSnapshot() {
  const info = wx.getStorageInfoSync();
  return buildSnapshot(info.keys, key => wx.getStorageSync(key));
}

async function backupNow() {
  const snapshot = readLocalSnapshot();
  const savedAt = new Date().toISOString();
  const text = JSON.stringify({ version: 1, savedAt, data: snapshot.data });
  const parts = splitText(text);
  for (let part = 0; part < parts.length; part += 1) {
    await call({ action: 'savePart', part, total: parts.length, data: parts[part], savedAt, keyCount: snapshot.keyCount, size: text.length, hash: snapshot.hash });
  }
  const meta = { savedAt, hash: snapshot.hash, keyCount: snapshot.keyCount, size: text.length };
  wx.setStorageSync(META_KEY, meta);
  return meta;
}

function getStatus() {
  return call({ action: 'status' });
}

async function restoreFromCloud() {
  const head = await call({ action: 'loadPart', part: 0 });
  const total = Number(head.total) || 1;
  const texts = [head.data];
  for (let part = 1; part < total; part += 1) {
    const piece = await call({ action: 'loadPart', part });
    texts.push(piece.data);
  }
  const snapshot = parseSnapshot(texts.join(''));
  Object.keys(snapshot.data).forEach(key => wx.setStorageSync(key, snapshot.data[key]));
  const local = readLocalSnapshot();
  wx.setStorageSync(META_KEY, { savedAt: snapshot.savedAt, hash: local.hash, keyCount: local.keyCount });
  return { savedAt: snapshot.savedAt, keyCount: Object.keys(snapshot.data).length };
}

// 离开小程序时调用：有变化且距上次超过 6 小时才备份，失败不打扰用户
function autoBackup() {
  try {
    if (!wx.cloud || typeof wx.getStorageInfoSync !== 'function') return;
    const snapshot = readLocalSnapshot();
    if (!snapshot.keyCount) return;
    if (!shouldAutoBackup(wx.getStorageSync(META_KEY), snapshot.hash, Date.now())) return;
    backupNow().catch(() => {});
  } catch (error) {
    // 忽略
  }
}

module.exports = {
  META_KEY,
  PART_SIZE,
  AUTO_INTERVAL_MS,
  hashString,
  buildSnapshot,
  splitText,
  parseSnapshot,
  shouldAutoBackup,
  backupNow,
  getStatus,
  restoreFromCloud,
  autoBackup
};
