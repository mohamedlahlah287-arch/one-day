const VoiceNoteRepository = require('./VoiceNoteRepository');
const VoiceBlobRepository = require('./VoiceBlobRepository');
const ProductRepository = require('../repositories/ProductRepository');
const logger = require('../utils/logger');
const { env } = require('../config/env');
const { mergeConditions, NO_PRODUCT_ACTIONS } = require('../engine/voiceConditions');

// نفس مدة التخزين المؤقت المستعملة فـ src/learning (5 دقائق) - رسائل صوتية عامة (تحية،
// توصيل...) تُقرأ فـ كل رسالة زبون محتملة، فلا داعي لقراءة Firestore فـ كل مرة.
const CACHE_TTL_MS = 5 * 60 * 1000;

// VoiceNoteService: نقطة الدخول الوحيدة لكل ما يخص "الرسائل الصوتية" - سواء كانت مرتبطة
// بمنتج معيّن (شرح المنتج وسعره...) أو بنية عامة (تحية، توصيل، ضمان...). ميزة باقة "الأعمال"
// فقط - راجع src/config/plans.js (features.merchantVoiceNotes) و README.md فـ هذا المجلد.
class VoiceNoteService {
  constructor() {
    // كاش موحّد على مستوى الوثيقة الكاملة لكل (متجر، نية) - تحتوي كلا من رابط الصوت
    // (fileId/url/duration) وشروط التشغيل (conditions)، حتى ما نقرأش Firestore مرتين
    // (مرة للصوت ومرة للشروط) فـ كل رسالة زبون محتملة.
    /** @type {Map<string, { doc: object|null, expiresAt: number }>} */
    this._docCache = new Map();
  }

  // يتحقق هل باقة هذا المتجر تسمح بالرسائل الصوتية (باقة الأعمال فقط حاليًا)
  isEnabled(store) {
    return Boolean(store?.features?.merchantVoiceNotes);
  }

  // يحمّل بايتات الملف من رابط تيليغرام المؤقت (لازال صالح فقط لحظة التسجيل) ويخزنها بشكل دائم
  // عبر VoiceBlobRepository، ويرجع رابط دائم على سيرفرنا (/media/voice/:blobId) يشتغل للأبد -
  // بعكس رابط تيليغرام الأصلي اللي ينتهي بعد حوالي ساعة. هذا هو سبب فشل الرسائل الصوتية سابقًا:
  // كان يُخزَّن رابط تيليغرام مباشرة، فيفشل الإرسال لاحقًا (بعد ما ينتهي) بلا أي إشعار واضح.
  async _persistPermanently(blobId, temporaryUrl, duration) {
    const res = await fetch(temporaryUrl);
    if (!res.ok) throw new Error(`تعذر تحميل الملف الصوتي من تيليغرام: ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length > VoiceBlobRepository.MAX_RAW_BYTES) {
      throw new Error('الرسالة الصوتية طويلة جدًا. سجّل رسالة أقصر (أقل من دقيقتين تقريبًا).');
    }
    if (!env.appBaseUrl) {
      throw new Error('لم يتم ضبط رابط الموقع (APP_BASE_URL) بعد - تواصل مع الإدارة قبل استعمال هذه الميزة.');
    }
    await VoiceBlobRepository.save(blobId, {
      base64: buffer.toString('base64'),
      mimeType: 'audio/ogg',
      duration,
    });
    return `${env.appBaseUrl}/media/voice/${blobId}`;
  }

  // يحفظ بايتات ملف صوتي جاء مباشرة (base64) من لوحة تحكم الموقع - بعكس _persistPermanently
  // ما يحتاجش تحميل من رابط تيليغرام مؤقت لأن الملف موجود عندنا أصلاً فـ الطلب.
  async _persistBufferPermanently(blobId, base64, mimeType, duration) {
    const buffer = Buffer.from(base64, 'base64');
    if (buffer.length > VoiceBlobRepository.MAX_RAW_BYTES) {
      throw new Error('الرسالة الصوتية طويلة جدًا. سجّل رسالة أقصر (أقل من دقيقتين تقريبًا).');
    }
    if (!env.appBaseUrl) {
      throw new Error('لم يتم ضبط رابط الموقع (APP_BASE_URL) بعد - تواصل مع الإدارة قبل استعمال هذه الميزة.');
    }
    await VoiceBlobRepository.save(blobId, { base64, mimeType: mimeType || 'audio/ogg', duration });
    return `${env.appBaseUrl}/media/voice/${blobId}`;
  }

  // نسخة الموقع من attachToProduct: يستقبل base64 مباشرة (تسجيل/رفع من المتصفح) بدل رابط تيليغرام.
  async attachToProductFromBase64(storeId, productId, { base64, mimeType, duration = null }) {
    await ProductRepository.findByIdOrFail(storeId, productId, 'المنتج');
    const blobId = `p_${storeId}_${productId}`;
    const permanentUrl = await this._persistBufferPermanently(blobId, base64, mimeType, duration);
    const saved = await ProductRepository.update(storeId, productId, {
      voiceNoteFileId: null,
      voiceNoteUrl: permanentUrl,
      voiceNoteDuration: duration,
    });
    logger.info('تم حفظ رسالة صوتية لمنتج من لوحة التحكم', { storeId, productId });
    return saved;
  }

  // نسخة الموقع من attachToIntent: نفس الفكرة لرسائل النوايا العامة.
  async attachToIntentFromBase64(storeId, intentKey, { base64, mimeType, duration = null }) {
    const blobId = `i_${storeId}_${intentKey}`;
    const permanentUrl = await this._persistBufferPermanently(blobId, base64, mimeType, duration);
    const saved = await VoiceNoteRepository.setForIntent(storeId, intentKey, {
      fileId: null,
      url: permanentUrl,
      duration,
    });
    this._invalidateIntentCache(storeId, intentKey);
    logger.info('تم حفظ رسالة صوتية عامة لنية من لوحة التحكم', { storeId, intentKey });
    return saved;
  }

  // ===== رسائل صوتية خاصة بمنتج =====

  // يحفظ/يستبدل الرسالة الصوتية الخاصة بمنتج معيّن (شرح المنتج + سعره وكل التفاصيل بصوت التاجر)
  // url المُمرَّر هنا هو رابط تيليغرام المؤقت (من getFileLink) - نحوّله فورًا لرابط دائم قبل الحفظ.
  async attachToProduct(storeId, productId, { fileId, url, duration = null }) {
    await ProductRepository.findByIdOrFail(storeId, productId, 'المنتج');
    const blobId = `p_${storeId}_${productId}`;
    const permanentUrl = await this._persistPermanently(blobId, url, duration);
    const saved = await ProductRepository.update(storeId, productId, {
      voiceNoteFileId: fileId,
      voiceNoteUrl: permanentUrl,
      voiceNoteDuration: duration,
    });
    logger.info('تم حفظ رسالة صوتية لمنتج', { storeId, productId });
    return saved;
  }

  async removeFromProduct(storeId, productId) {
    await ProductRepository.findByIdOrFail(storeId, productId, 'المنتج');
    return ProductRepository.update(storeId, productId, {
      voiceNoteFileId: null,
      voiceNoteUrl: null,
      voiceNoteDuration: null,
    });
  }

  // ===== رسائل صوتية عامة (لكل نية: تحية، توصيل، ضمان...) =====

  async attachToIntent(storeId, intentKey, { fileId, url, duration = null }) {
    const blobId = `i_${storeId}_${intentKey}`;
    const permanentUrl = await this._persistPermanently(blobId, url, duration);
    const saved = await VoiceNoteRepository.setForIntent(storeId, intentKey, {
      fileId,
      url: permanentUrl,
      duration,
    });
    this._invalidateIntentCache(storeId, intentKey);
    logger.info('تم حفظ رسالة صوتية عامة لنية', { storeId, intentKey });
    return saved;
  }

  async removeFromIntent(storeId, intentKey) {
    await VoiceNoteRepository.removeForIntent(storeId, intentKey);
    this._invalidateIntentCache(storeId, intentKey);
  }

  // يقرأ الوثيقة الكاملة (صوت + شروط) لـ (متجر، نية) مع تخزين مؤقت 5 دقائق
  async _getCachedDoc(storeId, intentKey) {
    const cacheKey = `${storeId}:${intentKey}`;
    const cached = this._docCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.doc;

    const doc = await VoiceNoteRepository.getForIntent(storeId, intentKey);
    this._docCache.set(cacheKey, { doc, expiresAt: Date.now() + CACHE_TTL_MS });
    return doc;
  }

  // يُستدعى من catalogController/decisionEngine فـ كل رسالة زبون (بعد تحديد النية) -
  // يرجع null إذا ماكانش هناك رابط صوت فعلي (حتى لو الوثيقة موجودة لكن فيها شروط فقط،
  // مثلاً تاجر ضبط "اسأل عن المنتج" بلا ما يسجّل صوتًا بعد).
  async getForIntent(storeId, intentKey) {
    if (!intentKey || intentKey === 'unknown') return null;
    const doc = await this._getCachedDoc(storeId, intentKey);
    return doc && doc.url ? doc : null;
  }

  // ===== شروط التشغيل (Conditions) - البند الثاني/الخامس فـ المتطلبات =====
  // يرجع شروط التشغيل الفعلية لهذه النية فـ هذا المتجر: افتراضيات النظام مدموجة مع أي
  // تخصيص سجّله التاجر (إن وُجد). دائمًا يرجع كائنًا كاملاً (لا يرجع null أبدًا) حتى يبقى
  // استعماله فـ decisionEngine بسيطًا وبلا حاجة لفحوصات إضافية.
  async getConditionsForIntent(storeId, intentKey) {
    if (!intentKey || intentKey === 'unknown') return mergeConditions(intentKey, null);
    const doc = await this._getCachedDoc(storeId, intentKey);
    return mergeConditions(intentKey, doc?.conditions);
  }

  // يحفظ تخصيصًا (جزئيًا أو كاملًا) لشروط التشغيل لنية معينة من لوحة التحكم
  async setConditionsForIntent(storeId, intentKey, partialConditions = {}) {
    const current = await this.getConditionsForIntent(storeId, intentKey);
    const next = {
      requiresProduct:
        typeof partialConditions.requiresProduct === 'boolean'
          ? partialConditions.requiresProduct
          : current.requiresProduct,
      noProductAction: NO_PRODUCT_ACTIONS.includes(partialConditions.noProductAction)
        ? partialConditions.noProductAction
        : current.noProductAction,
      noProductText:
        partialConditions.noProductText !== undefined
          ? partialConditions.noProductText || null
          : current.noProductText,
    };
    await VoiceNoteRepository.setConditions(storeId, intentKey, next);
    this._invalidateIntentCache(storeId, intentKey);
    logger.info('تم تحديث شروط التشغيل لرسالة صوتية عامة', { storeId, intentKey, conditions: next });
    return next;
  }

  async listIntentVoiceNotes(storeId) {
    return VoiceNoteRepository.findAllVoiceNotes(storeId);
  }

  _invalidateIntentCache(storeId, intentKey) {
    this._docCache.delete(`${storeId}:${intentKey}`);
  }
}

module.exports = new VoiceNoteService();
