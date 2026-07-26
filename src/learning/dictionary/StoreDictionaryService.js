const StoreDictionaryRepository = require('./StoreDictionaryRepository');
const { isFuzzyMatch } = require('../normalization/textNormalizer');
const logger = require('../../utils/logger');

// TTL بسيط للتخزين المؤقت (بالميلي ثانية) - قاموس المتجر ما يتغيرش كل ثانية، فـ 5 دقائق
// كافية لتفادي قراءة Firestore فـ كل رسالة زبون (يبقي التعرف سريعًا كما هو مطلوب فـ المتطلبات).
const CACHE_TTL_MS = 5 * 60 * 1000;

// StoreDictionaryService: طبقة منطق فوق StoreDictionaryRepository.
// - تحتفظ بذاكرة تخزين مؤقت (in-process cache) لكل متجر حتى يكون البحث فوريًا.
// - توفر lookup تقريبي (fuzzy) لكلمات قريبة من كلمات القاموس (خطأ إملائي بسيط من الزبون).
class StoreDictionaryService {
  constructor() {
    /** @type {Map<string, { terms: Array, expiresAt: number }>} */
    this._cache = new Map();
  }

  async _getCachedTerms(storeId) {
    const key = String(storeId);
    const cached = this._cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.terms;

    const terms = await StoreDictionaryRepository.findAllTerms(storeId);
    this._cache.set(key, { terms, expiresAt: Date.now() + CACHE_TTL_MS });
    return terms;
  }

  invalidate(storeId) {
    this._cache.delete(String(storeId));
  }

  // يبحث عن كلمة (أو أكثر من كلمة داخل الرسالة) داخل قاموس المتجر، بمطابقة تامة أولًا
  // ثم تقريبية (fuzzy) كخط دفاع ثانٍ لأخطاء الكتابة البسيطة.
  // @returns {{ term: string, meaning: string, intent: string|null }|null}
  async lookup(storeId, normalizedMessage) {
    if (!normalizedMessage) return null;
    const terms = await this._getCachedTerms(storeId);
    if (!terms.length) return null;

    const words = normalizedMessage.split(/\s+/);

    // 1) مطابقة تامة: الكلمة المخزنة موجودة كنص فرعي فـ الرسالة
    for (const entry of terms) {
      if (entry.term && normalizedMessage.includes(entry.term)) {
        return { term: entry.term, meaning: entry.meaning, intent: entry.intent || null };
      }
    }

    // 2) مطابقة تقريبية على مستوى الكلمة الواحدة (تحمي من خطأ إملائي بحرف أو حرفين)
    for (const word of words) {
      for (const entry of terms) {
        if (entry.term && isFuzzyMatch(word, entry.term)) {
          return { term: entry.term, meaning: entry.meaning, intent: entry.intent || null };
        }
      }
    }

    return null;
  }

  // يتعلم مصطلحًا جديدًا (أو يزيد عدد استخدامه) - يُستدعى عندما التاجر يصحح كلمة الزبون
  // بالتفسير الصحيح (مثلاً: الزبون كتب "لافريزون"، والتاجر ردّ بكلام يخص "التوصيل").
  async learnTerm(storeId, term, { meaning, intent = null, source } = {}) {
    if (!term || !meaning) return null;
    const saved = await StoreDictionaryRepository.upsertTerm(storeId, term.trim(), { meaning, intent, source });
    this.invalidate(storeId);
    logger.info('تم تعلّم مصطلح جديد فـ قاموس المتجر', { storeId, term, meaning });
    return saved;
  }

  async listTerms(storeId) {
    return StoreDictionaryRepository.findAllTerms(storeId);
  }
}

module.exports = new StoreDictionaryService();
