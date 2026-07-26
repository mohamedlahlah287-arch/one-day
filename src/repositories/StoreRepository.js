const { db, FieldValue } = require('../database/firestore');
const NotFoundError = require('../errors/NotFoundError');
const logger = require('../utils/logger');

// StoreRepository خاص بوثيقة المتجر نفسها (stores/{storeId})، ماشي مجموعة فرعية،
// لهذا ما يرثش من BaseRepository.
class StoreRepository {
  docRef(storeId) {
    return db.collection('stores').doc(String(storeId));
  }

  async findById(storeId) {
    const snap = await this.docRef(storeId).get();
    return snap.exists ? { id: snap.id, ...snap.data() } : null;
  }

  async findByIdOrFail(storeId) {
    const store = await this.findById(storeId);
    if (!store) throw new NotFoundError('المتجر', { storeId });
    return store;
  }

  // ينشئ متجرًا جديدًا مع باقة محددة. يُستدعى من السوبر أدمن (StoreService.adminCreateStore) أو من
  // التسجيل الذاتي عبر الموقع (StoreService.selfRegisterStore).
  // plan: { id, name, durationDays, messageLimit, productLimit, features }
  // referral (اختياري): { code, referredByStoreId, referredByCode, signupIp, flagged } - راجع
  // ReferralService لمعرفة كيف تُحسب هذه الحقول (برنامج الإحالة/العمولات).
  async create(storeId, { storeName, plan, ownerName = '', contactPhone = '', referral = {} }) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + plan.durationDays);

    const payload = {
      ownerTelegramId: storeId,
      ownerName,
      storeName,
      welcomeMessage: `👋 أهلاً بك في متجر ${storeName}`,
      contactPhone,
      deliveryTime: '',
      // إذا false (الافتراضي): الطلب يظهر مباشرة والتاجر يجهزه بدون "تأكيد" ولا إشعار للزبون.
      // إذا true: زر "تم التأكيد" يبقى ظاهرًا، وعند الضغط عليه يوصل الزبون رسالة أن طلبه تأكد.
      orderConfirmationEnabled: false,
      active: true,
      manuallyPaused: false,
      subscriptionStatus: plan.id === 'trial' ? 'trial' : 'active', // trial | active | expired
      subscriptionExpiresAt: expiresAt,
      planId: plan.id,
      planName: plan.name,
      planDurationDays: plan.durationDays,
      messageLimit: plan.messageLimit, // null = غير محدود
      productLimit: plan.productLimit, // null = غير محدود
      features: plan.features,
      messageCount: 0,
      // ===== برنامج الإحالة (كود دعوة لكل تاجر + رصيد عمولات) =====
      referralCode: referral.code || null, // كود الدعوة الخاص بهذا المتجر (يشاركه مع الآخرين)
      referredByStoreId: referral.referredByStoreId || null, // معرف المتجر "الداعي" إن وُجد
      referredByCode: referral.referredByCode || null,
      referralFlaggedSelfReferral: Boolean(referral.flagged), // اشتباه غش (نفس IP...) - عمولة لا تُحتسب
      referralSignupIp: referral.signupIp || null,
      referralPaymentCount: 0, // عدد الدفعات المدفوعة من هذا المتجر (يُستعمل لتحديد نسبة العمولة)
      walletBalance: 0, // رصيد العمولات المتاح (دج) - قابل للاستعمال فـ الاشتراك أو السحب كاش
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    await this.docRef(storeId).set(payload);
    logger.info('تم إنشاء متجر جديد عبر السوبر أدمن', { storeId, storeName, planId: plan.id });
    return { id: String(storeId), ...payload };
  }

  async update(storeId, fields) {
    await this.docRef(storeId).update({ ...fields, updatedAt: FieldValue.serverTimestamp() });
    return this.findById(storeId);
  }

  // ===== شركات التوصيل (src/services/DeliveryService.js) =====
  // تُحفظ كل شركة تحت store.deliveryProviders.{providerId} حتى لا يؤثر ربط/حذف شركة على البقية
  // (بفضل dot-notation فـ Firestore .update()، لا يتم استبدال كل الحقل deliveryProviders كاملًا).
  async saveDeliveryProvider(storeId, providerId, providerData) {
    await this.docRef(storeId).update({
      [`deliveryProviders.${providerId}`]: providerData,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return this.findById(storeId);
  }

  async removeDeliveryProvider(storeId, providerId) {
    await this.docRef(storeId).update({
      [`deliveryProviders.${providerId}`]: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return this.findById(storeId);
  }

  // ===== إعدادات مساعد الذكاء الاصطناعي (src/config/aiSettings.js) - المتطلب #16 =====
  async saveAISettings(storeId, fullSettings) {
    await this.docRef(storeId).update({ aiSettings: fullSettings, updatedAt: FieldValue.serverTimestamp() });
    return this.findById(storeId);
  }

  async incrementMessageCount(storeId, amount = 1) {
    await this.docRef(storeId).update({
      messageCount: FieldValue.increment(amount),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  async delete(storeId) {
    await this.docRef(storeId).delete();
    logger.info('تم حذف المتجر نهائيًا', { storeId });
    return true;
  }

  async findAllActive() {
    const snap = await db.collection('stores').where('active', '==', true).get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  // كل المتاجر (تُستعمل من بوت السوبر أدمن لعرض القائمة الكاملة)
  async findAllStores(limit = 200) {
    const snap = await db.collection('stores').orderBy('createdAt', 'desc').limit(limit).get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  async findExpiringSubscriptions(beforeDate) {
    const snap = await db
      .collection('stores')
      .where('subscriptionStatus', '==', 'active')
      .where('subscriptionExpiresAt', '<=', beforeDate)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  // متاجر استعملت كود عرض مؤقت وانتهت مدته (تُستعمل من promoCodeExpirationJob لإرجاعها لباقتها الأصلية)
  async findStoresWithExpiredPromoTrial(beforeDate) {
    const snap = await db.collection('stores').where('promoTrialExpiresAt', '<=', beforeDate).get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  // ===== صفحة فيسبوك خاصة بكل متجر =====

  async connectFacebookPage(storeId, { pageId, pageAccessToken, pageName }) {
    await this.docRef(storeId).update({
      facebookPageId: pageId,
      facebookPageAccessToken: pageAccessToken,
      facebookPageName: pageName || null,
      facebookConnected: true,
      facebookConnectedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return this.findById(storeId);
  }

  async disconnectFacebookPage(storeId) {
    await this.docRef(storeId).update({
      facebookPageId: FieldValue.delete(),
      facebookPageAccessToken: FieldValue.delete(),
      facebookPageName: FieldValue.delete(),
      facebookConnectedAt: FieldValue.delete(),
      facebookConnected: false,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return this.findById(storeId);
  }

  // يبحث عن المتجر عبر معرف صفحة فيسبوك المرتبطة به (يُستعمل من webhook لتوزيع الأحداث)
  async findByFacebookPageId(pageId) {
    if (!pageId) return null;
    const snap = await db.collection('stores').where('facebookPageId', '==', pageId).limit(1).get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() };
  }

  // ===== برنامج الإحالة: رصيد المحفظة وعدد الدفعات =====

  // amount موجب = إضافة رصيد (عمولة جديدة)، سالب = خصم (استعمال فـ الاشتراك أو سحب/رفض سحب)
  async incrementWallet(storeId, amount) {
    await this.docRef(storeId).update({
      walletBalance: FieldValue.increment(amount),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return this.findById(storeId);
  }

  async incrementReferralPaymentCount(storeId) {
    await this.docRef(storeId).update({
      referralPaymentCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  // كل المتاجر اللي دعاها متجر معين (لعرضها فـ لوحة التاجر: "عدد الأشخاص اللي دعاهم")
  async findReferredStores(referrerStoreId, limit = 200) {
    const snap = await db
      .collection('stores')
      .where('referredByStoreId', '==', String(referrerStoreId))
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  async countReferredStores(referrerStoreId) {
    const snap = await db
      .collection('stores')
      .where('referredByStoreId', '==', String(referrerStoreId))
      .count()
      .get();
    return snap.data().count;
  }

  // يبحث عن متجر برقم هاتف تواصل معيّن (يُستعمل لمنع تكرار نفس الرقم بين متجرين مختلفين).
  // ينسّق الرقم بإزالة المسافات/الشرطات قبل المقارنة حتى ما يفوتش تكرار بصيغة كتابة مختلفة.
  async findByContactPhone(contactPhone, excludeStoreId = null) {
    const normalized = String(contactPhone || '').replace(/[\s-]/g, '');
    if (!normalized) return null;
    const snap = await db.collection('stores').where('contactPhone', '==', normalized).limit(2).get();
    if (snap.empty) return null;
    const match = snap.docs.find((doc) => String(doc.id) !== String(excludeStoreId));
    return match ? { id: match.id, ...match.data() } : null;
  }

  // ===== فريق العمل (موظفين إضافيين بصلاحيات محدودة) =====
  // staff مخزّن كـ map داخل وثيقة المتجر: { staff: { [telegramId]: { name, permissions, addedAt } } }
  // + نسخة فهرسة سريعة فـ مجموعة منفصلة staffIndex/{telegramId} للبحث المباشر من authGuard.

  staffIndexRef(telegramId) {
    return db.collection('staffIndex').doc(String(telegramId));
  }

  async addStaff(storeId, telegramId, { name, permissions }) {
    const key = String(telegramId);
    const entry = { name: name || '', permissions, addedAt: FieldValue.serverTimestamp() };
    await this.docRef(storeId).update({
      [`staff.${key}`]: entry,
      updatedAt: FieldValue.serverTimestamp(),
    });
    await this.staffIndexRef(key).set({ storeId: String(storeId), permissions, name: name || '' });
    return this.findById(storeId);
  }

  async updateStaffPermissions(storeId, telegramId, permissions) {
    const key = String(telegramId);
    await this.docRef(storeId).update({
      [`staff.${key}.permissions`]: permissions,
      updatedAt: FieldValue.serverTimestamp(),
    });
    await this.staffIndexRef(key).set({ storeId: String(storeId), permissions }, { merge: true });
    return this.findById(storeId);
  }

  async removeStaff(storeId, telegramId) {
    const key = String(telegramId);
    await this.docRef(storeId).update({
      [`staff.${key}`]: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    await this.staffIndexRef(key).delete().catch(() => {});
    return this.findById(storeId);
  }

  // يُستعمل من authGuard: يعرف بسرعة إذا كان هذا التليغرام آيدي عضو فريق فـ أي متجر
  async findStaffIndex(telegramId) {
    const snap = await this.staffIndexRef(telegramId).get();
    return snap.exists ? snap.data() : null;
  }
}

module.exports = new StoreRepository();
