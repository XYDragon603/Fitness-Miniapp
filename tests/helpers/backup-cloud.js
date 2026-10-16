// Exercise the actual cloud service against a deterministic in-memory database.
const { createService } = require('../../cloudfunctions/userBackup/service');
const clone = value => JSON.parse(JSON.stringify(value));
function createCloud() {
  const docs = new Map();
  let failure = null;
  let created = false;
  let queue = Promise.resolve();
  const db = {
    command: { lt: value => ({ $lt: value }) },
    async createCollection() { if (created) throw new Error('collection already exists'); created = true; },
    runTransaction(callback) {
      const operation = queue.then(async () => {
        const changes = new Map();
        const transaction = { collection: () => ({ doc: key => ({
          async get() { if (failure) throw new Error(failure); const data = changes.get(key) || docs.get(key); if (!data) throw new Error('document does not exist'); return { data: { ...clone(data), _id: key } }; },
          async set({ data }) { if (failure) throw new Error(failure); if ('_id' in data) throw Object.assign(new Error('document.set:fail -501007 invalid parameters. 不能更新_id的值'), { errCode: -501007 }); changes.set(key, clone(data)); }
        }) }) };
        const result = await callback(transaction);
        for (const [key, value] of changes) docs.set(key, value);
        return result;
      });
      queue = operation.catch(() => {}); return operation;
    },
    collection() { return {
      doc(key) { return {
        async get() { if (failure) throw new Error(failure); if (!docs.has(key)) throw new Error('document does not exist'); return { data: { ...clone(docs.get(key)), _id: key } }; },
        async set({ data }) { if (failure) throw new Error(failure); if ('_id' in data) throw Object.assign(new Error('document.set:fail -501007 invalid parameters. 不能更新_id的值'), { errCode: -501007 }); docs.set(key, clone(data)); },
        async remove() { docs.delete(key); }
      }; },
      where(filter) {
        let limit = Infinity;
        const match = data => Object.entries(filter).every(([key, value]) => value && typeof value === 'object' && '$lt' in value ? data[key] < value.$lt : data[key] === value);
        return { limit(value) { limit = value; return this; },
          async get() { return { data: [...docs.values()].filter(match).slice(0, limit).map(clone) }; },
          async remove() { for (const [key, value] of docs) if (match(value)) docs.delete(key); }
        };
      }
    }; }
  };
  return { docs, service: createService(db), createColdService: () => createService(db), setCollectionError(value) { db.createCollection = async () => { throw value; }; }, setFailure(value) { failure = value; } };
}
module.exports = { createCloud };
