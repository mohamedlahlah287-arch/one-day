const DecisionRepository = require('./DecisionRepository');
const logger = require('../../utils/logger');

const CACHE_TTL_MS = 5 * 60 * 1000;
// حد أدنى لنسبة تشابه الكلمات (Jaccard) حتى نعتبر سؤالًا جديدًا "مشابهًا بما يكفي" لقرار محفوظ.
// رقم متحفظ نسبيًا لتفادي تطبيق قرار خاطئ على سؤال مختلف فـ الحقيقة.
const SIMILARITY_THRESHOLD = 0.5;

// DecisionService: يبحث هل سؤال الزبون الحالي يشبه سؤالًا سبق للتاجر أن اتخذ فيه قرارًا،
// وإن كان كذلك، يرجع نفس القرار مباشرة بلا الحاجة لإزعاج التاجر أو انتظار AI.
class DecisionService {
  constructor() {
    this._cache = new Map();
  }

  async _getCachedDecisions(storeId) {
    const key = String(storeId);
    const cached = this._cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.decisions;
    const decisions = await DecisionRepository.findAllDecisions(storeId);
    this._cache.set(key, { decisions, expiresAt: Date.now() + CACHE_TTL_MS });
    return decisions;
  }

  invalidate(storeId) {
    this._cache.delete(String(storeId));
  }

  // تشابه Jaccard بسيط بين مجموعتي كلمات - سريع وكافٍ لجمل قصيرة (أسئلة زبائن عادة قصيرة)
  static wordSimilarity(a, b) {
    const setA = new Set(a.split(/\s+/).filter((w) => w.length >= 2));
    const setB = new Set(b.split(/\s+/).filter((w) => w.length >= 2));
    if (!setA.size || !setB.size) return 0;
    let intersection = 0;
    for (const w of setA) if (setB.has(w)) intersection += 1;
    const union = new Set([...setA, ...setB]).size;
    return intersection / union;
  }

  // @param normalizedMessage - رسالة الزبون بعد التطبيع (من textNormalizer)
  // @returns القرار الأقرب إذا تجاوز حد التشابه، وإلا null
  async findMatchingDecision(storeId, normalizedMessage) {
    if (!normalizedMessage) return null;
    const decisions = await this._getCachedDecisions(storeId);
    if (!decisions.length) return null;

    let best = null;
    let bestScore = 0;
    for (const decision of decisions) {
      const score = DecisionService.wordSimilarity(normalizedMessage, decision.normalizedQuestion || '');
      if (score > bestScore) {
        bestScore = score;
        best = decision;
      }
    }
    if (best && bestScore >= SIMILARITY_THRESHOLD) {
      DecisionRepository.incrementUsage(storeId, best.id).catch(() => {}); // لا نوقف الرد بسبب فشل تحديث العداد
      return best;
    }
    return null;
  }

  async recordDecision(storeId, { question, normalizedQuestion, decisionText, questionType }) {
    const saved = await DecisionRepository.recordDecision(storeId, {
      question,
      normalizedQuestion,
      decisionText,
      questionType,
    });
    this.invalidate(storeId);
    logger.info('تم تسجيل قرار جديد فـ دفتر قرارات التاجر', { storeId, question });
    return saved;
  }

  async listDecisions(storeId) {
    return DecisionRepository.findAllDecisions(storeId);
  }
}

module.exports = new DecisionService();
