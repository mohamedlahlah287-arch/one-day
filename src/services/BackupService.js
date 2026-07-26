const { db, FieldValue } = require('../database/firestore');
const StoreRepository = require('../repositories/StoreRepository');
const logger = require('../utils/logger');

// المجموعات التي تُشمل فـ النسخة الاحتياطية (المتطلب #11). كل مجموعة فرعية تحت
// stores/{storeId}/{collection} - راجع src/repositories/BaseRepository.js.
const BACKUP_COLLECTIONS = ['orders', 'products', 'customers', 'coupons', 'ratings'];

// حد أقصى تقريبي (بالبايت) لحفظ نسخة كاملة داخل مستند واحد فـ Firestore (الحد الفعلي
// لأي مستند هو 1 ميغابايت). فوق هذا الحد، النسخة التلقائية تُسجَّل كـ "فشلت - المتجر كبير
// جدًا" بدل محاولة كتابة مستند سيُرفض من Firestore على أي حال.
// ⚠️ الحل الصحيح لمتاجر كبيرة/طويلة المدى هو ربط Firebase Storage (bucket) وتخزين الملف
// هناك بدل Firestore - الكود أدناه مبني بحيث تبديل الوجهة لاحقًا هو تعديل _persistSnapshot فقط.
const MAX_INLINE_SNAPSHOT_BYTES = 900_000;

class BackupService {
  // يبني نسخة JSON كاملة من بيانات المتجر - يُستعمل للتنزيل المباشر (يدوي) وللمزامنة التلقائية
  async exportStoreData(storeId) {
    const store = await StoreRepository.findByIdOrFail(storeId);
    const collections = {};

    for (const name of BACKUP_COLLECTIONS) {
      // eslint-disable-next-line no-await-in-loop
      const snap = await db.collection('stores').doc(String(storeId)).collection(name).get();
      collections[name] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }

    return {
      exportedAt: new Date().toISOString(),
      storeId: String(storeId),
      storeName: store.storeName,
      store: {
        welcomeMessage: store.welcomeMessage,
        deliveryTime: store.deliveryTime,
        contactPhone: store.contactPhone,
      },
      collections,
    };
  }

  // نسخة يدوية فورية (زر "تنزيل نسخة الآن") - لا تُخزَّن على السيرفر، تُرجع للتاجر مباشرة
  async buildDownloadableBackup(storeId) {
    return this.exportStoreData(storeId);
  }

  // نسخة مجدولة/يدوية "محفوظة" - نحاول تخزينها، وإذا كانت أكبر من حد Firestore للمستند
  // الواحد نرجع فشلًا واضحًا بدل خطأ Firestore غامض (راجع الملاحظة أعلاه بخصوص Storage).
  async createSavedSnapshot(storeId, { triggeredBy = 'manual' } = {}) {
    const data = await this.exportStoreData(storeId);
    const json = JSON.stringify(data);
    const sizeBytes = Buffer.byteLength(json, 'utf8');

    if (sizeBytes > MAX_INLINE_SNAPSHOT_BYTES) {
      logger.warn('فشلت النسخة الاحتياطية التلقائية: حجم البيانات كبير جدًا لتخزينه مباشرة', { storeId, sizeBytes });
      throw new Error(
        'حجم بيانات متجرك كبير جدًا لحفظ نسخة احتياطية تلقائية حاليًا. استعمل "تنزيل نسخة الآن" بدل ذلك، أو تواصل مع الدعم لتفعيل تخزين سحابي مخصص.'
      );
    }

    const ref = db.collection('stores').doc(String(storeId)).collection('backups').doc();
    await ref.set({
      createdAt: FieldValue.serverTimestamp(),
      triggeredBy,
      sizeBytes,
      collectionsCounts: Object.fromEntries(Object.entries(data.collections).map(([k, v]) => [k, v.length])),
      data,
    });
    logger.info('تم إنشاء نسخة احتياطية محفوظة', { storeId, backupId: ref.id, sizeBytes });
    return { id: ref.id, sizeBytes };
  }

  async listSavedSnapshots(storeId, limit = 20) {
    const snap = await db
      .collection('stores').doc(String(storeId)).collection('backups')
      .orderBy('createdAt', 'desc').limit(limit).get();
    // بلا حقل "data" الثقيل - القائمة فقط للعرض
    return snap.docs.map((d) => {
      const { data, ...meta } = d.data();
      return { id: d.id, ...meta };
    });
  }

  // استعادة نسخة احتياطية محفوظة مسبقًا (أو مرفوعة من ملف نزّله التاجر) - عملية حساسة:
  // تستبدل كل مستند بمعرفه الأصلي فـ نفس المجموعة (upsert بدل حذف شامل، تفاديًا لفقدان
  // بيانات أُنشئت بعد النسخة إذا كانت موجودة أصلاً بنفس المعرف بالخطأ).
  async restoreFromExport(storeId, exportedData) {
    if (!exportedData?.collections) throw new Error('ملف النسخة الاحتياطية غير صالح');
    if (String(exportedData.storeId) !== String(storeId)) {
      throw new Error('هذه النسخة الاحتياطية تعود لمتجر آخر، لا يمكن استعادتها هنا');
    }

    let restoredDocs = 0;
    for (const name of BACKUP_COLLECTIONS) {
      const docs = exportedData.collections[name] || [];
      const coll = db.collection('stores').doc(String(storeId)).collection(name);
      // eslint-disable-next-line no-await-in-loop
      await Promise.all(docs.map(({ id, ...fields }) => coll.doc(id).set(fields, { merge: false })));
      restoredDocs += docs.length;
    }

    logger.info('تمت استعادة نسخة احتياطية', { storeId, restoredDocs });
    return { restoredDocs };
  }

  async restoreSavedSnapshot(storeId, backupId) {
    const snap = await db.collection('stores').doc(String(storeId)).collection('backups').doc(backupId).get();
    if (!snap.exists) throw new Error('النسخة الاحتياطية غير موجودة');
    return this.restoreFromExport(storeId, snap.data().data);
  }
}

module.exports = new BackupService();
