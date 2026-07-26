const StoreMemoryRepository = require('./StoreMemoryRepository');

// StoreMemoryService: واجهة عليا لذاكرة المتجر. باقي الوحدات (intentResolver، teach، stats)
// تتعامل مع هذا الملف فقط، ولا تعرف تفاصيل Firestore.
class StoreMemoryService {
  async getProfile(storeId) {
    return StoreMemoryRepository.ensureDefaults(storeId);
  }

  // يُستدعى بعد كل تعديل يقوم به التاجر لرد الذكاء الاصطناعي: يسجل عبارته + يزيد عداد التعديلات.
  // نستخرج "عبارات" بسيطة (جمل قصيرة متكررة) بدل حفظ كل رد بأكمله لتفادي ذاكرة ضخمة بلا فائدة.
  async learnFromMerchantEdit(storeId, finalReply) {
    await StoreMemoryRepository.incrementEditCount(storeId);
    const openingPhrase = extractOpeningPhrase(finalReply);
    if (openingPhrase) await StoreMemoryRepository.addCommonPhrase(storeId, openingPhrase);
  }

  async addLearnedFact(storeId, fact) {
    return StoreMemoryRepository.addLearnedFact(storeId, fact);
  }

  async setTone(storeId, tone) {
    return StoreMemoryRepository.setTone(storeId, tone);
  }

  // يبني "بادئة أسلوب" يمكن دمجها فـ رد AI مستقبلي (مثال: تُمرَّر كسياق لـ AIMediaService)
  async buildStyleHint(storeId) {
    const profile = await this.getProfile(storeId);
    if (!profile.commonPhrases?.length && !profile.tone) return null;
    const phrases = (profile.commonPhrases || []).slice(-5).join('، ');
    const parts = [];
    if (profile.tone) parts.push(`أسلوب التاجر: ${profile.tone}`);
    if (phrases) parts.push(`عبارات يستعملها غالبًا: ${phrases}`);
    return parts.join(' | ');
  }
}

// يستخرج أول جملة قصيرة (حتى 6 كلمات) من رد التاجر - غالبًا هذا "افتتاحية" أسلوبه المميزة
// (مثال: "أكيد أخي" من "أكيد أخي، المنتج متوفر ويمكن شحنه اليوم").
function extractOpeningPhrase(text) {
  if (!text) return null;
  const firstSegment = text.split(/[،,.!؟?\n]/)[0]?.trim();
  if (!firstSegment) return null;
  const words = firstSegment.split(/\s+/);
  if (words.length === 0 || words.length > 6) return null;
  return firstSegment;
}

module.exports = new StoreMemoryService();
