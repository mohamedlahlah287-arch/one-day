const crypto = require('crypto');
const { db, FieldValue } = require('../database/firestore');

const TTL_MS = 10 * 60 * 1000; // 10 دقائق - وقت كافي للتاجر باش يسجل دخول بفيسبوك

// توكن ربط فيسبوك: عشوائي، وحيد الاستخدام، مخزّن فـ Firestore (بلا Map فـ الذاكرة) باش يخدم
// حتى لو بوت التاجر وبوت الزبائن كل واحد فـ خدمة Railway منفصلة (allInOne.js أو منفصلين، بالحيلتين).
class OAuthConnectRepository {
  docRef(token) {
    return db.collection('oauthConnectTokens').doc(token);
  }

  async create(storeId) {
    const token = crypto.randomBytes(24).toString('hex');
    await this.docRef(token).set({
      storeId: String(storeId),
      status: 'pending', // pending -> completed (بعد الاستعمال، ما يخدمش مرة ثانية)
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: new Date(Date.now() + TTL_MS),
    });
    return token;
  }

  // يرجع الوثيقة فقط إذا التوكن موجود، لسه "pending"، وماخرجش وقتو - وإلا null
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

  // يُستدعى فقط بعد نجاح الربط الفعلي - يمنع أي إعادة استخدام لاحقة لنفس الرابط (حماية من CSRF/الروابط القديمة)
  async markCompleted(token) {
    await this.docRef(token).update({ status: 'completed', completedAt: FieldValue.serverTimestamp() });
  }

  // تنظيف دوري (اختياري) - يحذف التوكنات القديمة المنتهية باش ما تتكدسش فـ القاعدة
  async deleteExpiredBefore(date) {
    const snap = await db.collection('oauthConnectTokens').where('expiresAt', '<=', date).limit(200).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
    return snap.size;
  }
}

module.exports = new OAuthConnectRepository();
