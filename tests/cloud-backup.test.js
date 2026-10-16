const assert = require('assert');
const { createCloud } = require('./helpers/backup-cloud');
const cloud = createCloud();
const local = {};
const clone = value => JSON.parse(JSON.stringify(value));
let failPart = false;
let corruptPart = false;
let loadHook = null;
let rejectWrite = null;
global.wx = {
  getStorageInfoSync() { return { keys: Object.keys(local), currentSize: 1 }; },
  getStorageSync(key) { return local[key] === undefined ? '' : clone(local[key]); },
  setStorageSync(key, value) { if (rejectWrite === key) { rejectWrite = null; throw new Error('quota'); } local[key] = clone(value); },
  removeStorageSync(key) { delete local[key]; },
  cloud: { callFunction({ name, data, success, fail }) {
    assert.strictEqual(name, 'userBackup');
    if (data.action === 'savePart') assert(Buffer.byteLength(data.data) <= 200 * 1024);
    if (failPart && data.action === 'savePart') { Promise.resolve().then(() => fail({ errMsg: 'network interrupted' })); return; }
    Promise.resolve().then(async () => {
      if (loadHook && data.action === 'loadPart') { const hook = loadHook; loadHook = null; await hook(); }
      const result = await cloud.service('user-a', data);
      if (corruptPart && data.action === 'loadPart' && result.ok) result.data = result.data.replace('杠铃卧推', '哑铃卧推');
      success({ result });
    }).catch(error => fail({ errMsg: error.message }));
  } }
};
const backup = require('../utils/cloud-backup');
assert.deepStrictEqual(backup.splitText('abcdefg', 3), ['abc', 'def', 'g']);
assert.deepStrictEqual(backup.splitText('中文😀abc', 7), ['中文', '😀abc']);
assert.strictEqual(backup.byteSize('中文😀'), 10);
assert.strictEqual(backup.splitText('中文😀abc', 7).join(''), '中文😀abc');
for (const text of ['{"version":1,"data":null}', '{"version":1,"data":[]}', '{"version":2,"data":{}}', '{"version":1,"data":{"__proto__":{}}}']) assert.throws(() => backup.parseSnapshot(text));
assert.strictEqual(backup.shouldAutoBackup(null, 'h', Date.now()), false, 'first backup must be explicit');
assert.strictEqual(backup.shouldAutoBackup({ savedAt: new Date().toISOString(), hash: 'h' }, 'h', Date.now()), false);
(async () => {
  local.training_dates = ['2026-10-16'];
  local['training_2026-10-16'] = { date: '2026-10-16', exercises: [{ name: '杠铃卧推', sets: [{ weight: 60, reps: 12, done: true }] }] };
  local.big_notes = '训练笔记😀'.repeat(60000);
  local.exercise_favorites = ['0025'];
  const meta = await backup.backupNow();
  assert(meta.version && local[backup.META_KEY]);
  const oldHead = await backup.getStatus();
  assert.strictEqual(oldHead.protocol, 2);
  assert(oldHead.total > 1);
  assert.strictEqual((await cloud.service('user-b', { action: 'status' })).exists, false, 'accounts are isolated');
  assert.strictEqual((await cloud.service('user-b', { action: 'loadPart', version: oldHead.version, part: 0 })).ok, false);
  assert.strictEqual((await cloud.service('', { action: 'status' })).error, 'no_openid');

  // Failed replacement retains the previous manifest and local success metadata.
  local.big_notes = '更改后的笔记'.repeat(60000);
  failPart = true;
  await assert.rejects(backup.backupNow(), /network interrupted/);
  failPart = false;
  assert.strictEqual((await backup.getStatus()).version, oldHead.version);
  assert.strictEqual(local[backup.META_KEY].version, oldHead.version);
  const upload = await cloud.service('user-a', { action: 'begin', total: 2, size: 10, keyCount: 0, hash: 'bad' });
  assert.strictEqual((await cloud.service('user-a', { action: 'commit', version: upload.version })).error, 'incomplete_upload');
  assert.strictEqual((await backup.getStatus()).version, oldHead.version);

  // Corruption is detected before any local write.
  Object.keys(local).forEach(key => delete local[key]); local.sentinel = 'keep';
  const before = JSON.stringify(local);
  corruptPart = true;
  await assert.rejects(backup.restoreFromCloud(), /checksum_mismatch/);
  assert.strictEqual(JSON.stringify(local), before);
  corruptPart = false;
  local['training_2026-10-17'] = { date: '2026-10-17', dayId: 'local_only', exercises: [] };
  local.training_dates = ['2026-10-17'];
  local['nutrition_2026-10-17'] = [{ name: '本机新记录', calories: 100 }];
  local.nutrition_dates = ['2026-10-17'];

  // A new backup publishing during restore cannot mix pinned version parts.
  const replacementText = JSON.stringify({ version: 1, data: { replacement: true } });
  loadHook = async () => {
    const state = await cloud.service('user-a', { action: 'begin', total: 1, size: Buffer.byteLength(replacementText), keyCount: 1, hash: backup.hashString(JSON.stringify({ replacement: true })) });
    await cloud.service('user-a', { action: 'savePart', version: state.version, part: 0, data: replacementText });
    assert.strictEqual((await cloud.service('user-a', { action: 'commit', version: state.version })).ok, true);
  };
  await backup.restoreFromCloud();
  assert.strictEqual(local['training_2026-10-16'].exercises[0].name, '杠铃卧推');
  assert.deepStrictEqual(local.exercise_favorites, ['0025']);
  assert.strictEqual(local.replacement, undefined);
  assert.strictEqual(local.big_notes, '训练笔记😀'.repeat(60000));
  assert.deepStrictEqual(local.training_dates, ['2026-10-17', '2026-10-16'], 'local-only dates remain reachable after restoring an older index');
  assert.deepStrictEqual(local.nutrition_dates, ['2026-10-17']);
  assert.strictEqual(local['nutrition_2026-10-17'][0].name, '本机新记录');
  const merged = backup.buildSnapshot(Object.keys(local), key => local[key]);
  assert.notStrictEqual(local[backup.META_KEY].hash, merged.hash, 'retained local-only data must still be eligible for a later backup');
  const newer = (await backup.getStatus()).version;
  assert.strictEqual((await cloud.service('user-a', { action: 'commit', version: oldHead.version })).ok, true);
  assert.strictEqual((await backup.getStatus()).version, newer, 'retry of an old committed upload cannot replace a newer backup');

  // Storage failure rolls incoming keys back; completed uploads are immutable.
  local.replacement = 'local';
  rejectWrite = 'replacement';
  await assert.rejects(backup.restoreFromCloud(), /restore_write_failed/);
  assert.strictEqual(local.replacement, 'local');
  const beforeMetaFailure = JSON.stringify(local);
  rejectWrite = backup.META_KEY;
  await assert.rejects(backup.restoreFromCloud(), /restore_write_failed/);
  assert.strictEqual(JSON.stringify(local), beforeMetaFailure, 'metadata write failure rolls back restored user data too');
  assert.strictEqual((await cloud.service('user-a', { action: 'savePart', version: oldHead.version, part: 0, data: 'evil' })).error, 'already_committed');

  // Database errors are not misrepresented as an empty backup.
  cloud.setFailure('permission denied');
  assert.strictEqual((await backup.getStatus().catch(error => ({ error: error.message }))).error, 'database_error');
  cloud.setFailure(null);
  // Exact production SDK response: the collection exists after an earlier cold
  // start. This is a success condition, never a database outage.
  const existsError = { errCode: -1, errMsg: 'createCollection:fail [ResourceUnavailable.ResourceExist] Table exist. Please check your request' };
  cloud.setCollectionError(existsError);
  const cold = cloud.createColdService();
  const coldStatus = await cold('user-a', { action: 'status' });
  assert.strictEqual(coldStatus.ok, true);
  assert.strictEqual(coldStatus.exists, true);
  assert.strictEqual(coldStatus.protocol, 2);
  const { collectionExists } = require('../cloudfunctions/userBackup/service');
  assert.strictEqual(collectionExists(existsError), true);
  assert.strictEqual(collectionExists({ errCode: -502002, errMsg: 'invalid database operator' }), false);
  assert.strictEqual(collectionExists({ errCode: -502003, errMsg: 'permission denied' }), false);
  cloud.setCollectionError({ errCode: -502003, errMsg: 'permission denied' });
  const denied = await cloud.createColdService()('user-a', { action: 'status' });
  assert.strictEqual(denied.ok, false);
  assert.strictEqual(denied.stage, 'create_collection');
  assert.strictEqual(denied.code, '-502003');
  const originalCloud = wx.cloud;
  wx.cloud = null; await assert.rejects(backup.backupNow(), /cloud_unavailable/);
  assert.doesNotThrow(() => backup.autoBackup()); wx.cloud = originalCloud;
  console.log('actual cloud service: atomic publish, interruption, pinned restore, account isolation, checksum and rollback passed');
})().catch(error => { console.error(error); process.exit(1); });
