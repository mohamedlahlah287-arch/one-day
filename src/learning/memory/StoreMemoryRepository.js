const { db, FieldValue } = require('../../database/firestore');

// StoreMemoryRepository: ذاكرة واحدة مركّزة لكل متجر (وليست مجموعة وثائق متعددة) لأن
// محتواها (أسلوب التاجر، عبارات مفضلة، ملخص قرارات) صغير الحجم نسبيًا ويُقرأ ككل فـ كل مرة.
// المسار: stores/{storeId}/learningMemory/profile
//
// هذا يختلف عن BaseRepository (اللي مصمم لمجموعات وثائق متعددة مثل المنتجات) - هنا وثيقة
// واحدة فقط، فكتبنا الوصول لها مباشرة بدل التوريث من BaseRepository.
class StoreMemoryRepository {
  _docRef(storeId) {
    return db.collection('stores').doc(String(storeId)).collection('learningMemory').doc('profile');
  }

  async get(storeId) {
    const snap = await this._docRef(storeId).get();
    return snap.exists ? snap.data() : null;
  }

  async ensureDefaults(storeId) {
    const existing = await this.get(storeId);
    if (existing) return existing;
    const defaults = {
      commonPhrases: [], // عبارات يستعملها التاجر بكثرة فـ ردوده (مثال: "أكيد أخي")
      tone: null, // وصف عام لأسلوب التاجر (رسمي / ودّي / مختصر...) - يُحدَّث يدويًا أو تلقائيًا
      learnedFacts: [], // معلومات حرة تعلمها البوت مع الوقت (نص حر، محدودة العدد)
      editCount: 0, // عدد التعديلات التي أدخلها التاجر (مؤشر على مدى نضج الذاكرة)
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    await this._docRef(storeId).set(defaults);
    return defaults;
  }

  async incrementEditCount(storeId) {
    await this._docRef(storeId).set(
      { editCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
  }

  // يضيف عبارة لقائمة "العبارات الشائعة" تاع التاجر بلا تكرار، ويحافظ على حجم معقول (آخر 30)
  async addCommonPhrase(storeId, phrase) {
    const profile = await this.ensureDefaults(storeId);
    const phrases = new Set(profile.commonPhrases || []);
    phrases.add(phrase);
    const trimmed = Array.from(phrases).slice(-30);
    await this._docRef(storeId).set({ commonPhrases: trimmed, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return trimmed;
  }

  // يضيف "معلومة متعلَّمة" حرة (مثال: "التاجر لا يقبل الدفع عند الاستلام فـ ولاية X")
  async addLearnedFact(storeId, fact) {
    const profile = await this.ensureDefaults(storeId);
    const facts = profile.learnedFacts || [];
    if (facts.includes(fact)) return facts;
    const updated = [...facts, fact].slice(-100); // حد أقصى 100 معلومة لتفادي نمو غير محدود
    await this._docRef(storeId).set({ learnedFacts: updated, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return updated;
  }

  async setTone(storeId, tone) {
    await this._docRef(storeId).set({ tone, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  }
}

module.exports = new StoreMemoryRepository();
