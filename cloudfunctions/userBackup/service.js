const crypto = require('crypto');
const COLLECTION = 'user_backups';
const MAX_PARTS = 40;
const MAX_PART_BYTES = 300 * 1024;
function hashString(text) { let hash = 5381; for (let i = 0; i < text.length; i++) hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0; return (hash >>> 0).toString(36) + text.length.toString(36); }
function missing(error) { return /not found|not exist|does not exist|DOCUMENT_NOT_FOUND|-502005/i.test(String(error && (error.errMsg || error.message || error.code))); }
function collectionExists(error) { return /already exist|已存在|COLLECTION_(?:ALREADY_)?EXIST|\bResourceUnavailable\.ResourceExist\b|\bTable exists?\b/i.test(String(error && (error.errMsg || error.message || error.code))); }
function validData(value) { return value && value.version === 1 && value.data && typeof value.data === 'object' && !Array.isArray(value.data) && !Object.keys(value.data).some(key => ['__proto__', 'constructor', 'prototype'].includes(key)); }
function createService(db) {
  let ready = false;
  const collection = () => db.collection(COLLECTION);
  const id = (openid, suffix) => openid + '_' + suffix;
  async function read(key) { try { return (await collection().doc(key).get()).data || null; } catch (error) { if (missing(error)) return null; error.backupStage = 'read_document'; throw error; } }
  async function ensure() {
    if (ready) return;
    try { await db.createCollection(COLLECTION); } catch (error) { if (!collectionExists(error)) { error.backupStage = 'create_collection'; throw error; } }
    ready = true;
  }
  async function dispatch(openid, event) {
    if (!openid) return { ok: false, error: 'no_openid' };
    await ensure();
    const action = event && event.action;
    if (action === 'status') {
      const head = await read(id(openid, 'manifest')) || await read(id(openid, '0'));
      return head ? { ok: true, protocol: 2, exists: true, version: head.version || '', total: head.total,
        savedAt: head.savedAt, keyCount: head.keyCount, size: head.size, hash: head.hash, contentHash: head.contentHash || '' }
        : { ok: true, protocol: 2, exists: false };
    }
    if (action === 'begin') {
      const total = Number(event.total), size = Number(event.size), keyCount = Number(event.keyCount);
      if (!Number.isInteger(total) || total < 1 || total > MAX_PARTS || !Number.isInteger(size) || size < 1 || size > MAX_PARTS * MAX_PART_BYTES
        || !Number.isInteger(keyCount) || keyCount < 0 || typeof event.hash !== 'string' || event.hash.length > 100) return { ok: false, error: 'bad_upload' };
      const version = crypto.randomBytes(16).toString('hex');
      const savedAt = new Date().toISOString();
      await collection().doc(id(openid, version + '_upload')).set({ data: { openid, _openid: openid, kind: 'upload', version,
        status: 'uploading', total, size, keyCount, hash: event.hash, savedAt, createdAt: savedAt } });
      return { ok: true, version, savedAt };
    }
    const version = typeof event.version === 'string' ? event.version : '';
    if (version && !/^[a-f0-9]{32}$/.test(version)) return { ok: false, error: 'bad_version' };
    if (action === 'loadPart') {
      const part = Number(event.part);
      if (!Number.isInteger(part) || part < 0 || part >= MAX_PARTS) return { ok: false, error: 'bad_part' };
      const upload = version ? await read(id(openid, version + '_upload')) : null;
      if (version && (!upload || upload.status !== 'committed' || part >= upload.total)) return { ok: false, error: 'not_found' };
      const piece = await read(id(openid, version ? version + '_' + part : String(part)));
      return piece ? { ok: true, version, part: piece.part, total: piece.total, data: piece.data, savedAt: piece.savedAt } : { ok: false, error: 'not_found' };
    }
    if (!['savePart', 'commit'].includes(action)) return { ok: false, error: 'unknown_action' };
    if (!version) return { ok: false, error: 'client_update_required' };
    const upload = await read(id(openid, version + '_upload'));
    if (!upload) return { ok: false, error: 'upload_not_found' };
    if (action === 'savePart') {
      const part = Number(event.part);
      if (upload.status !== 'uploading') return { ok: false, error: 'already_committed' };
      if (!Number.isInteger(part) || part < 0 || part >= upload.total || typeof event.data !== 'string' || Buffer.byteLength(event.data, 'utf8') > MAX_PART_BYTES) return { ok: false, error: 'bad_part' };
      await collection().doc(id(openid, version + '_' + part)).set({ data: { openid, _openid: openid, kind: 'part', version, part, total: upload.total,
        data: event.data, savedAt: upload.savedAt, createdAt: upload.createdAt } });
      return { ok: true };
    }
    const parts = await Promise.all(Array.from({ length: upload.total }, (_, part) => read(id(openid, version + '_' + part))));
    if (parts.some((piece, part) => !piece || piece.part !== part || piece.version !== version || piece.total !== upload.total)) return { ok: false, error: 'incomplete_upload' };
    const text = parts.map(piece => piece.data).join('');
    let parsed; try { parsed = JSON.parse(text); } catch (_) { return { ok: false, error: 'bad_backup' }; }
    if (!validData(parsed) || Buffer.byteLength(text, 'utf8') !== upload.size || Object.keys(parsed.data).length !== upload.keyCount
      || hashString(JSON.stringify(parsed.data)) !== upload.hash) return { ok: false, error: 'checksum_mismatch' };
    const contentHash = hashString(text);
    // Publish only an immutable, fully validated version. A failed upload never
    // overwrites the currently visible backup; readers pin this version.
    const published = await db.runTransaction(async transaction => {
      const uploads = transaction.collection(COLLECTION).doc(id(openid, version + '_upload'));
      const latest = (await uploads.get()).data;
      if (latest.status === 'committed') return { ok: true, version, savedAt: latest.savedAt, contentHash: latest.contentHash, alreadyCommitted: true };
      const manifest = transaction.collection(COLLECTION).doc(id(openid, 'manifest'));
      let current = null; try { current = (await manifest.get()).data; } catch (error) { if (!missing(error)) throw error; }
      if (current && current.savedAt > upload.savedAt) return { ok: false, error: 'superseded_upload' };
      await uploads.set({ data: { openid, _openid: openid, kind: 'upload', version, total: upload.total,
        size: upload.size, keyCount: upload.keyCount, hash: upload.hash, savedAt: upload.savedAt,
        createdAt: upload.createdAt, status: 'committed', contentHash } });
      await manifest.set({ data: { openid, _openid: openid, kind: 'manifest', version,
        total: upload.total, savedAt: upload.savedAt, size: upload.size, keyCount: upload.keyCount, hash: upload.hash, contentHash } });
      return { ok: true, version, savedAt: upload.savedAt, contentHash };
    });
    if (!published.ok) return published;
    if (published.alreadyCommitted) return published;
    // Retain at least 24 hours of versions for active restores; remove older
    // orphaned uploads in bounded batches on the next successful backup.
    try {
      const cutoff = new Date(Date.now() - 86400000).toISOString();
      const active = await read(id(openid, 'manifest'));
      const old = await collection().where({ openid, kind: 'upload', createdAt: db.command.lt(cutoff) }).limit(10).get();
      for (const item of old.data || []) if (item.version !== version && (!active || item.version !== active.version)) await collection().where({ openid, version: item.version }).remove();
    } catch (_) { /* Cleanup failure does not invalidate the published backup. */ }
    return published;
  }
  return async function(openid, event = {}) { try { return await dispatch(openid, event); } catch (error) {
    const stage = error && error.backupStage || 'database_operation';
    const code = String(error && (error.errCode || error.code) || 'unknown').slice(0, 80);
    const detail = String(error && (error.errMsg || error.message) || '').replace(/[\r\n]/g, ' ').slice(0, 220);
    console.error('userBackup database failure', stage, code, detail);
    return { ok: false, error: 'database_error', stage, code, detail };
  } };
}
module.exports = { createService, hashString, MAX_PARTS, MAX_PART_BYTES, collectionExists };
