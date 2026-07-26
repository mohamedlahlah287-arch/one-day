const { db, FieldValue } = require('../database/firestore');

// حسابات الموقع الإلكتروني (تسجيل دخول/تسجيل عبر Google) - منفصلة عن "المتجر" نفسه.
// حساب واحد يمكن أن يرتبط لاحقًا بمتجر واحد (linkedStoreId) بعد ربطه ببوت التاجر على تيليغرام.
class WebUserRepository {
  collection() {
    return db.collection('websiteUsers');
  }

  async findByEmail(email) {
    const snap = await this.collection().where('email', '==', email.toLowerCase()).limit(1).get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() };
  }

  async findById(id) {
    const snap = await this.collection().doc(id).get();
    return snap.exists ? { id: snap.id, ...snap.data() } : null;
  }

  async create({ email, googleId, fullName, phone, birthDate, avatarUrl }) {
    const ref = this.collection().doc();
    const payload = {
      email: email.toLowerCase(),
      emailVerified: true, // تحقق Google هو مصدر التحقق - لا حاجة لإيميل تأكيد إضافي
      googleId,
      fullName: fullName || '',
      phone: phone || '',
      birthDate: birthDate || null,
      avatarUrl: avatarUrl || null,
      linkedStoreId: null,
      status: 'pending_review', // pending_review | reviewed
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      lastLoginAt: FieldValue.serverTimestamp(),
    };
    await ref.set(payload);
    return { id: ref.id, ...payload };
  }

  async touchLogin(id) {
    await this.collection().doc(id).update({ lastLoginAt: FieldValue.serverTimestamp() });
  }

  async linkStore(id, storeId) {
    await this.collection().doc(id).update({ linkedStoreId: String(storeId), updatedAt: FieldValue.serverTimestamp() });
  }

  async update(id, fields) {
    await this.collection().doc(id).update({ ...fields, updatedAt: FieldValue.serverTimestamp() });
    return this.findById(id);
  }
}

module.exports = new WebUserRepository();
