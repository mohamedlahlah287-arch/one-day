const crypto = require('crypto');
const { db, FieldValue } = require('../database/firestore');

const TTL_MS = 30 * 60 * 1000; // 30 دقيقة - وقت كافي باش يوصل التاجر لتيليغرام ويضغط "ابدأ"

// تسجيل ذاتي من الموقع: التاجر يعبّي فورم (اسم المتجر...) على الموقع، وهذا ينشئ توكن مؤقت.
// المتجر الفعلي (وثيقة store) ما يتخلقش إلا بعد ما التاجر يفتح بوت التاجر عبر رابط
// t.me/البوت?start=reg_التوكن، لأن معرف Telegram (اللي هو مفتاح المتجر) ما نعرفوهش قبل هذا.
class PendingRegistrationRepository {
  docRef(token) {
    return db.collection('pendingRegistrations').doc(token);
  }

  // referralCode/signupIp (اختياري): كود الدعوة اللي دخله التاجر فـ فورم الموقع + IP وقت التعبئة،
  // نحتفظ بيهم هنا حتى نمرروهم لـ StoreService.selfRegisterStore بعد تأكيد Telegram (راجع admin.routes.js)
  async create({ storeName, ownerName, phone, referralCode, signupIp }) {
    const token = crypto.randomBytes(16).toString('hex');
    await this.docRef(token).set({
      storeName,
      ownerName: ownerName || '',
      phone: phone || '',
      referralCode: referralCode || null,
      signupIp: signupIp || null,
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

  async markCompleted(token, ownerTelegramId) {
    await this.docRef(token).update({
      status: 'completed',
      ownerTelegramId: String(ownerTelegramId),
      completedAt: FieldValue.serverTimestamp(),
    });
  }

  async deleteExpiredBefore(date) {
    const snap = await db.collection('pendingRegistrations').where('expiresAt', '<=', date).limit(200).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
    return snap.size;
  }
}

module.exports = new PendingRegistrationRepository();
