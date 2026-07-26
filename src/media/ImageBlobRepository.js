const { db, FieldValue } = require('../database/firestore');
const logger = require('../utils/logger');

// نفس منطق VoiceBlobRepository (راجع src/voiceNotes/VoiceBlobRepository.js) لكن للصور:
// تخزين دائم لبايتات صور المنتجات كـ base64 داخل Firestore، تُخدم عبر /media/image/:blobId.
// الصور تُصغَّر من طرف المتصفح (canvas) قبل الرفع، فهامش 900 كيلوبايت خام كافٍ جدًا لصورة
// منتج بجودة معقولة (Firestore محدود بـ 1 ميغابايت للوثيقة، وbase64 يزيد الحجم ~37%).
const MAX_RAW_BYTES = 900 * 1000;

class ImageBlobRepository {
  collection() {
    return db.collection('imageBlobs');
  }

  static get MAX_RAW_BYTES() {
    return MAX_RAW_BYTES;
  }

  async save(blobId, { base64, mimeType = 'image/jpeg' }) {
    await this.collection()
      .doc(blobId)
      .set({
        base64,
        mimeType,
        updatedAt: FieldValue.serverTimestamp(),
      });
    logger.info('تم حفظ صورة دائمة', { blobId, sizeApprox: base64.length });
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

module.exports = new ImageBlobRepository();
