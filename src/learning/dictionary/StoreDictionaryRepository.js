const BaseRepository = require('../../repositories/BaseRepository');
const { FieldValue } = require('../../database/firestore');

// StoreDictionaryRepository: قاموس خاص بكل متجر - كلمات محلية/عامية يستعملها عملاء هذا المتجر
// بالذات ("بقداش" = كم السعر، "لافريزون" = التوصيل...). كل وثيقة = مصطلح واحد.
// stores/{storeId}/learningDictionary/{term}
//
// نستعمل term نفسه (بعد تطبيع) كمعرف الوثيقة (doc id) بدل id عشوائي، حتى تكون عملية
// "تعلّم مصطلح جديد أو تحديث عدد مرات استعماله" عملية واحدة ذرية (upsert) بلا الحاجة
// للبحث أولاً عن الوثيقة.
class StoreDictionaryRepository extends BaseRepository {
  constructor() {
    super('learningDictionary');
  }

  // معرف وثيقة آمن (Firestore ما يقبلش / فـ id) - نستبدلها بمسافة
  static safeId(term) {
    return encodeURIComponent(term).slice(0, 300);
  }

  async upsertTerm(storeId, term, { meaning, intent = null, source = 'merchant_correction' } = {}) {
    const docId = StoreDictionaryRepository.safeId(term);
    const ref = this.collectionRef(storeId).doc(docId);
    const existing = await ref.get();
    await ref.set(
      {
        term,
        meaning,
        intent,
        source,
        usageCount: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
        ...(existing.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
      },
      { merge: true }
    );
    return { id: docId, term, meaning, intent };
  }

  // كل قاموس المتجر (تُستعمل فـ التخزين المؤقت داخل StoreDictionaryService، وليس فـ كل رسالة)
  async findAllTerms(storeId) {
    return this.findAll(storeId, { orderByField: 'usageCount', direction: 'desc', limit: 1000 });
  }
}

module.exports = new StoreDictionaryRepository();
