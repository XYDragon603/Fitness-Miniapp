const assert = require('assert');
const path = require('path');

// 用内存模拟本机 storage 和云函数（含云函数里的分片逻辑），跑一遍备份 -> 清空 -> 恢复
const local = {};
const cloudDocs = {};
global.wx = {
  getStorageInfoSync() { return { keys: Object.keys(local), currentSize: 1 }; },
  getStorageSync(key) { return local[key] === undefined ? '' : JSON.parse(JSON.stringify(local[key])); },
  setStorageSync(key, value) { local[key] = JSON.parse(JSON.stringify(value)); },
  cloud: {
    callFunction({ name, data, success }) {
      assert.strictEqual(name, 'userBackup');
      let result;
      if (data.action === 'savePart') {
        assert(data.data.length <= 300 * 1024, 'parts fit the cloud function limit');
        cloudDocs[data.part] = { ...data };
        if (data.part === data.total - 1) Object.keys(cloudDocs).filter(key => Number(key) >= data.total).forEach(key => delete cloudDocs[key]);
        result = { ok: true };
      } else if (data.action === 'loadPart') {
        result = cloudDocs[data.part] ? { ok: true, ...cloudDocs[data.part] } : { ok: false, error: 'not_found' };
      } else if (data.action === 'status') {
        result = cloudDocs[0] ? { ok: true, exists: true, ...cloudDocs[0] } : { ok: true, exists: false };
      }
      Promise.resolve().then(() => success({ result }));
    }
  }
};

const backup = require(path.join(__dirname, '../utils/cloud-backup.js'));

// 纯函数
assert.notStrictEqual(backup.hashString('abc'), backup.hashString('abd'));
assert.deepStrictEqual(backup.splitText('abcdefg', 3), ['abc', 'def', 'g']);
assert.deepStrictEqual(backup.splitText('', 3), ['']);
const snap = backup.buildSnapshot(['b', 'a', backup.META_KEY, 'logs', '__tmp', 'empty'], key => ({ a: 1, b: { x: 2 }, empty: '' })[key] || '');
assert.deepStrictEqual(Object.keys(snap.data), ['a', 'b'], 'meta, logs, temp and empty keys are skipped');
assert.throws(() => backup.parseSnapshot('{"version":2,"data":{}}'));
const now = Date.parse('2026-10-16T12:00:00Z');
assert.strictEqual(backup.shouldAutoBackup(null, 'h', now), true);
assert.strictEqual(backup.shouldAutoBackup({ savedAt: '2026-10-16T11:00:00Z', hash: 'h' }, 'h', now), false, 'unchanged');
assert.strictEqual(backup.shouldAutoBackup({ savedAt: '2026-10-16T11:00:00Z', hash: 'old' }, 'h', now), false, 'changed but too soon');
assert.strictEqual(backup.shouldAutoBackup({ savedAt: '2026-10-16T05:00:00Z', hash: 'old' }, 'h', now), true);

(async () => {
  // 准备一份比单个分片大的数据（中文，验证分片拼接）
  local.training_dates = ['2026-10-16'];
  local['training_2026-10-16'] = { date: '2026-10-16', dayName: '胸与三头', exercises: [{ name: '杠铃卧推', sets: [{ weight: '60', reps: '12', done: true }] }] };
  local.big_notes = '训练笔记'.repeat(200000);
  local.workout_plans = [{ id: 'custom_1', title: '我的计划' }];

  const meta = await backup.backupNow();
  assert(Object.keys(cloudDocs).length >= 2, 'large data is split into several parts');
  assert.strictEqual(local[backup.META_KEY].hash, meta.hash);
  assert.strictEqual((await backup.getStatus()).exists, true);

  // 换手机：本机清空后恢复
  Object.keys(local).forEach(key => delete local[key]);
  const restored = await backup.restoreFromCloud();
  assert.strictEqual(restored.keyCount, 4);
  assert.strictEqual(local['training_2026-10-16'].exercises[0].name, '杠铃卧推');
  assert.strictEqual(local.big_notes.length, '训练笔记'.length * 200000);
  assert(local[backup.META_KEY], 'restoring records a fresh meta so it is not re-uploaded immediately');

  // 再备份一份更小的数据：多余的旧分片被清理
  delete local.big_notes;
  await backup.backupNow();
  assert.strictEqual(Object.keys(cloudDocs).length, 1);

  // 云函数不可用时报错，自动备份静默
  const cloud = global.wx.cloud;
  global.wx.cloud = null;
  await assert.rejects(backup.backupNow(), /cloud_unavailable/);
  assert.doesNotThrow(() => backup.autoBackup());
  global.wx.cloud = cloud;

  console.log('cloud backup tests passed');
})().catch(error => { console.error(error); process.exit(1); });
