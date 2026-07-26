const { db, FieldValue } = require('../database/firestore');
const NotFoundError = require('../errors/NotFoundError');
const logger = require('../utils/logger');

// ReferralRepository: مسؤول على 3 مجموعات مستقلة على مستوى الجذر (وليس تحت متجر معين):
//  - referralCodes/{code}      : فهرسة سريعة code -> storeId (بحث مباشر بلا query)
//  - referralCommissions/{id}  : سجل كل عمولة تُحتسب (من هو الداعي، من هو المدعو، المبلغ...)
//  - withdrawalRequests/{id}   : طلبات سحب الرصيد لكاش (CCP / BaridiMob)
class ReferralRepository {
  codesCollection() {
    return db.collection('referralCodes');
  }

  commissionsCollection() {
    return db.collection('referralCommissions');
  }

  withdrawalsCollection() {
    return db.collection('withdrawalRequests');
  }

  // يحجز كودًا جديدًا لمتجر معين. يرجع false إذا الكود مستعمل مسبقًا (حتى نجرب كود آخر).
  async reserveCode(code, storeId) {
    const ref = this.codesCollection().doc(code);
    const existing = await ref.get();
    if (existing.exists) return false;
    await ref.set({ storeId: String(storeId), createdAt: FieldValue.serverTimestamp() });
    return true;
  }

  async findStoreIdByCode(code) {
    if (!code) return null;
    const snap = await this.codesCollection().doc(String(code).toUpperCase()).get();
    return snap.exists ? snap.data().storeId : null;
  }

  // ===== العمولات =====

  async recordCommission({ referrerStoreId, referredStoreId, referredStoreName, amount, percent, paymentNumber }) {
    const ref = await this.commissionsCollection().add({
      referrerStoreId: String(referrerStoreId),
      referredStoreId: String(referredStoreId),
      referredStoreName: referredStoreName || '',
      amount,
      percent,
      paymentNumber,
      createdAt: FieldValue.serverTimestamp(),
    });
    logger.info('تم تسجيل عمولة إحالة جديدة', { referrerStoreId, referredStoreId, amount, percent, paymentNumber });
    return ref.id;
  }

  async listCommissionsForReferrer(referrerStoreId, limit = 100) {
    const snap = await this.commissionsCollection()
      .where('referrerStoreId', '==', String(referrerStoreId))
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  // ===== طلبات السحب =====

  async createWithdrawal({ storeId, amount, method, accountNumber, phone }) {
    const ref = await this.withdrawalsCollection().add({
      storeId: String(storeId),
      amount,
      method, // 'ccp' | 'baridimob'
      accountNumber,
      phone,
      status: 'pending', // pending | approved | rejected
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return this.findById(ref.id);
  }

  async findById(id) {
    const snap = await this.withdrawalsCollection().doc(id).get();
    return snap.exists ? { id: snap.id, ...snap.data() } : null;
  }

  async findByIdOrFail(id) {
    const doc = await this.findById(id);
    if (!doc) throw new NotFoundError('طلب السحب', { id });
    return doc;
  }

  async updateStatus(id, status, extra = {}) {
    await this.withdrawalsCollection()
      .doc(id)
      .update({ status, ...extra, updatedAt: FieldValue.serverTimestamp() });
    return this.findById(id);
  }

  async listForStore(storeId, limit = 50) {
    const snap = await this.withdrawalsCollection()
      .where('storeId', '==', String(storeId))
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  async listPending(limit = 100) {
    const snap = await this.withdrawalsCollection()
      .where('status', '==', 'pending')
      .orderBy('createdAt', 'asc')
      .limit(limit)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  async listAll(limit = 200) {
    const snap = await this.withdrawalsCollection().orderBy('createdAt', 'desc').limit(limit).get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  // ===== حماية من معالجة نفس حدث الدفع مرتين (إعادة إرسال webhook من Chargily) =====

  async isPaymentEventProcessed(eventId) {
    if (!eventId) return false;
    const snap = await db.collection('processedPaymentEvents').doc(String(eventId)).get();
    return snap.exists;
  }

  async markPaymentEventProcessed(eventId) {
    if (!eventId) return;
    await db
      .collection('processedPaymentEvents')
      .doc(String(eventId))
      .set({ processedAt: FieldValue.serverTimestamp() });
  }
}

module.exports = new ReferralRepository();
