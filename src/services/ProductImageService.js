const ImageBlobRepository = require('../media/ImageBlobRepository');
const AIMediaService = require('./AIMediaService');
const { env } = require('../config/env');
const { ValidationError } = require('../errors');

// ProductImageService: يُستعمل من لوحة تحكم الموقع فقط (منتجات) - نفس فكرة تجربة تيليغرام
// (أرسل صورة → تحفظ وتتحول تلقائيًا) لكن عبر الموقع: التاجر يرفع صورة أو صورتين للمنتج،
// نخزّنهم بشكل دائم (رابط يشتغل للأبد، يصلح لبطاقة منتج فيسبوك ماسنجر)، ونستعمل نموذج رؤية
// Groq (نفس المستعمل فـ AIMediaService.describeImage للتعرف على صور الزبائن) لتوليد وصف
// مبدئي للمنتج من الصورة - التاجر يقدر يعدّله قبل الحفظ.
class ProductImageService {
  // يخزّن صورة واحدة بشكل دائم ويرجع رابطها العام
  async persistImage(storeId, slot, { base64, mimeType = 'image/jpeg' }) {
    if (!base64) throw new ValidationError('لا توجد صورة');
    const buffer = Buffer.from(base64, 'base64');
    if (buffer.length > ImageBlobRepository.MAX_RAW_BYTES) {
      throw new ValidationError('الصورة كبيرة جدًا. جرّب صورة أصغر (أقل من 900 كيلوبايت تقريبًا).');
    }
    if (!env.appBaseUrl) {
      throw new ValidationError('لم يتم ضبط رابط الموقع (APP_BASE_URL) بعد - تواصل مع الإدارة قبل رفع صور المنتجات.');
    }
    // blobId حتمي (storeId + slot ثابت 1 أو 2) - رفع صورة جديدة لنفس الخانة يستبدل القديمة
    // بدل ما يراكم وثائق قديمة بلا فائدة فـ Firestore.
    const blobId = `p_${storeId}_${slot}_${Date.now()}`;
    await ImageBlobRepository.save(blobId, { base64, mimeType });
    return `${env.appBaseUrl}/media/image/${blobId}`;
  }

  // يولّد وصف مبدئي للمنتج من صورته - يعتمد على AIMediaService (Groq vision)، نفس الخدمة
  // المستعملة للتعرف على صور الزبائن فـ البوت. يرجع نص فارغ بهدوء إذا الخدمة غير مفعّلة
  // (بلا GROQ_API_KEY) بدل ما يرمي خطأ يوقف رفع الصورة كاملة.
  async describeFromImageUrl(imageUrl) {
    if (!AIMediaService.isEnabled()) return '';
    try {
      const description = await AIMediaService.describeImage(imageUrl);
      return description || '';
    } catch (err) {
      return '';
    }
  }
}

module.exports = new ProductImageService();
