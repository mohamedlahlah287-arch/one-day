const { db, FieldValue } = require('../database/firestore');
const logger = require('../utils/logger');

// حد أقصى لحجم الملف الصوتي الخام (بايتات) قبل التحويل لـ base64. وثيقة Firestore محدودة
// بـ 1 ميغابايت إجمالاً، وbase64 يزيد الحجم بحوالي 37%، فنخلي هامش أمان مريح.
// 600 كيلوبايت خام تكفي لدقائق من رسالة صوتية بجودة تيليغرام العادية (Opus ~16-24kbps).
const MAX_RAW_BYTES = 600 * 1000;

// VoiceBlobRepository: تخزين دائم لبايتات الرسائل الصوتية (بديل عن الاعتماد على روابط
// تيليغرام المؤقتة اللي تنتهي صلاحيتها). نخزن الملف كـ base64 داخل Firestore مباشرة
// (بلا حاجة لإعداد Firebase Storage إضافي) ونخدمه عبر مسار /media/voice/:blobId.
// المجموعة: voiceBlobs/{blobId} - blobId معرف حتمي (deterministic) مبني من storeId + الهدف
// (منتج معين أو نية عامة)، حتى إعادة التسجيل تستبدل نفس الوثيقة بدل ما تراكم وثائق قديمة.
class VoiceBlobRepository {
  collection() {
    return db.collection('voiceBlobs');
  }

  static get MAX_RAW_BYTES() {
    return MAX_RAW_BYTES;
  }

  async save(blobId, { base64, mimeType = 'audio/ogg', duration = null }) {
    await this.collection()
      .doc(blobId)
      .set({
        base64,
        mimeType,
        duration,
        updatedAt: FieldValue.serverTimestamp(),
      });
    logger.info('تم حفظ ملف صوتي دائم', { blobId, sizeApprox: base64.length });
    return blobId;
  }

  async get(blobId) {
    const snap = await this.collection().doc(blobId).get();
    if (!snap.exists) return null;
    return snap.data();
  }

  async delete(blobId) {
    await this.collection().doc(blobId).delete();
  }
}

module.exports = new VoiceBlobRepository();
