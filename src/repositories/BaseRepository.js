const { db, FieldValue } = require('../database/firestore');
const NotFoundError = require('../errors/NotFoundError');
const logger = require('../utils/logger');

/**
 * BaseRepository: عمليات CRUD عامة لأي مجموعة فرعية تحت متجر معين.
 * stores/{storeId}/{collectionName}/{docId}
 *
 * كل مستودع (Repository) خاص بمجموعة معينة يرث من هذا الملف بلاصة ما يعاود يكتب نفس الكود.
 */
class BaseRepository {
  constructor(collectionName) {
    this.collectionName = collectionName;
  }

  collectionRef(storeId) {
    return db.collection('stores').doc(String(storeId)).collection(this.collectionName);
  }

  async create(storeId, data) {
    const ref = await this.collectionRef(storeId).add({
      ...data,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    logger.debug(`${this.collectionName}: تم إنشاء وثيقة جديدة`, { storeId, id: ref.id });
    return ref.id;
  }

  async findById(storeId, id) {
    const snap = await this.collectionRef(storeId).doc(id).get();
    if (!snap.exists) return null;
    return { id: snap.id, ...snap.data() };
  }

  async findByIdOrFail(storeId, id, resourceName = 'العنصر') {
    const doc = await this.findById(storeId, id);
    if (!doc) throw new NotFoundError(resourceName, { storeId, id });
    return doc;
  }

  async findAll(storeId, { orderByField = 'createdAt', direction = 'desc', limit = 50 } = {}) {
    const snap = await this.collectionRef(storeId)
      .orderBy(orderByField, direction)
      .limit(limit)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  async update(storeId, id, data) {
    await this.collectionRef(storeId)
      .doc(id)
      .update({ ...data, updatedAt: FieldValue.serverTimestamp() });
    logger.debug(`${this.collectionName}: تم تحديث وثيقة`, { storeId, id });
    return this.findById(storeId, id);
  }

  async delete(storeId, id) {
    await this.collectionRef(storeId).doc(id).delete();
    logger.debug(`${this.collectionName}: تم حذف وثيقة`, { storeId, id });
    return true;
  }

  async count(storeId) {
    const snap = await this.collectionRef(storeId).count().get();
    return snap.data().count;
  }
}

module.exports = BaseRepository;
