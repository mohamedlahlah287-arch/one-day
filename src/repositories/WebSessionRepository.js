const crypto = require('crypto');
const { db, FieldValue } = require('../database/firestore');

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 يوم

// جلسات تسجيل الدخول للموقع - توكن عشوائي طويل (opaque) يُحفظ كـ cookie httpOnly عند المستخدم،
// ونحتفظ بنسخة منه هنا في Firestore حتى نقدر نلغيه (logout) أو نتحقق منه بسرعة.
class WebSessionRepository {
  collection() {
    return db.collection('webSessions');
  }

  async create(userId) {
    const token = crypto.randomBytes(32).toString('hex');
    await this.collection()
      .doc(token)
      .set({
        userId,
        createdAt: FieldValue.serverTimestamp(),
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      });
    return token;
  }

  async findValid(token) {
    if (!token) return null;
    const snap = await this.collection().doc(token).get();
    if (!snap.exists) return null;
    const data = snap.data();
    const expiresAt = data.expiresAt?.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
    if (expiresAt.getTime() < Date.now()) return null;
    return { token, ...data };
  }

  async revoke(token) {
    if (!token) return;
    await this.collection().doc(token).delete();
  }

  async deleteExpiredBefore(date) {
    const snap = await this.collection().where('expiresAt', '<=', date).limit(200).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
    return snap.size;
  }
}

module.exports = new WebSessionRepository();
