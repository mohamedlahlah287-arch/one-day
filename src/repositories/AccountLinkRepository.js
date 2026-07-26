const crypto = require('crypto');
const { db, FieldValue } = require('../database/firestore');

const TTL_MS = 15 * 60 * 1000; // 15 دقيقة

// توكن مؤقت وحيد الاستخدام: يُنشأ من لوحة تحكم الموقع (بعد تسجيل الدخول) ليربط حساب الموقع
// بمتجر تيليغرام. التاجر يفتح t.me/البوت?start=link_التوكن، وبوت التاجر يكمل الربط.
class AccountLinkRepository {
  docRef(token) {
    return db.collection('accountLinkTokens').doc(token);
  }

  async create(webUserId) {
    const token = crypto.randomBytes(16).toString('hex');
    await this.docRef(token).set({
      webUserId,
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: new Date(Date.now() + TTL_MS),
    });
    return token;
  }

  async findValid(token) {
    if (!token) return null;
    const snap = await this.docRef(token).get();
    if (!snap.exists) return null;
    const data = snap.data();
    if (data.status !== 'pending') return null;
    const expiresAt = data.expiresAt?.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
    if (expiresAt.getTime() < Date.now()) return null;
    return { token, ...data };
  }

  async markCompleted(token, storeId) {
    await this.docRef(token).update({
      status: 'completed',
      storeId: String(storeId),
      completedAt: FieldValue.serverTimestamp(),
    });
  }

  async deleteExpiredBefore(date) {
    const snap = await db.collection('accountLinkTokens').where('expiresAt', '<=', date).limit(200).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
    return snap.size;
  }
}

module.exports = new AccountLinkRepository();
