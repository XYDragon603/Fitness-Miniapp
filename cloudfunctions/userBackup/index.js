// 用户数据云备份：按 OPENID 把小程序本地数据分片存进云数据库。
// action:
//   status                          -> 上次备份的信息
//   savePart { part, total, data, savedAt, keyCount, hash } -> 写入一个分片；最后一片写完后清理多余旧分片
//   loadPart { part }               -> 读取一个分片
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const COLLECTION = 'user_backups';
const MAX_PART_LENGTH = 300 * 1024;
const MAX_PARTS = 40;

async function ensureCollection() {
  try {
    await db.createCollection(COLLECTION);
  } catch (error) {
    // 已存在时会报错，忽略
  }
}

function partId(openid, part) {
  return `${openid}_${part}`;
}

async function status(openid) {
  try {
    const doc = await db.collection(COLLECTION).doc(partId(openid, 0)).get();
    const data = doc.data || {};
    return { ok: true, exists: true, savedAt: data.savedAt, total: data.total, keyCount: data.keyCount, size: data.size, hash: data.hash };
  } catch (error) {
    return { ok: true, exists: false };
  }
}

async function savePart(openid, event) {
  const part = Number(event.part);
  const total = Number(event.total);
  const data = typeof event.data === 'string' ? event.data : '';
  if (!Number.isInteger(part) || !Number.isInteger(total) || total < 1 || total > MAX_PARTS || part < 0 || part >= total) {
    return { ok: false, error: 'bad_part' };
  }
  if (data.length > MAX_PART_LENGTH) {
    return { ok: false, error: 'part_too_large' };
  }
  await ensureCollection();
  await db.collection(COLLECTION).doc(partId(openid, part)).set({
    data: {
      openid,
      part,
      total,
      data,
      savedAt: event.savedAt || new Date().toISOString(),
      keyCount: Number(event.keyCount) || 0,
      size: Number(event.size) || 0,
      hash: String(event.hash || ''),
      updatedAt: db.serverDate()
    }
  });
  // 最后一片：删掉上一次备份多出来的分片
  if (part === total - 1) {
    for (let index = total; index < MAX_PARTS; index += 1) {
      try {
        await db.collection(COLLECTION).doc(partId(openid, index)).remove();
      } catch (error) {
        break;
      }
    }
  }
  return { ok: true };
}

async function loadPart(openid, event) {
  const part = Number(event.part);
  if (!Number.isInteger(part) || part < 0 || part >= MAX_PARTS) return { ok: false, error: 'bad_part' };
  try {
    const doc = await db.collection(COLLECTION).doc(partId(openid, part)).get();
    const data = doc.data || {};
    return { ok: true, part: data.part, total: data.total, data: data.data, savedAt: data.savedAt };
  } catch (error) {
    return { ok: false, error: 'not_found' };
  }
}

exports.main = async event => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { ok: false, error: 'no_openid' };
  switch (event && event.action) {
    case 'status':
      return status(OPENID);
    case 'savePart':
      return savePart(OPENID, event);
    case 'loadPart':
      return loadPart(OPENID, event);
    default:
      return { ok: false, error: 'unknown_action' };
  }
};
