const BaseRepository = require('../../repositories/BaseRepository');

// DecisionRepository: "دفتر قرارات" التاجر - كل وثيقة تربط سؤالًا نموذجيًا (مثال: "هل يوجد
// استبدال؟") بقرار ثابت اتخذه التاجر مرة (مثال: "الاستبدال خلال ثلاثة أيام فقط") حتى يُستعمل
// تلقائيًا فـ أي سؤال مشابه لاحقًا، بلا الحاجة لإزعاج التاجر بنفس السؤال مرة أخرى.
// stores/{storeId}/learningDecisions/{decisionId}
class DecisionRepository extends BaseRepository {
  constructor() {
    super('learningDecisions');
  }

  // question: نص السؤال الأصلي (كما كتبه أول زبون) - يُخزَّن للعرض فقط
  // normalizedQuestion: النسخة المطبَّعة (لأغراض المطابقة)
  // decisionText: القرار النهائي الذي حدده التاجر
  async recordDecision(storeId, { question, normalizedQuestion, decisionText, questionType = 'general' }) {
    return this.create(storeId, { question, normalizedQuestion, decisionText, questionType, timesUsed: 0 });
  }

  async findAllDecisions(storeId) {
    return this.findAll(storeId, { orderByField: 'createdAt', direction: 'desc', limit: 500 });
  }

  async incrementUsage(storeId, decisionId) {
    const doc = await this.findById(storeId, decisionId);
    if (!doc) return null;
    return this.update(storeId, decisionId, { timesUsed: (doc.timesUsed || 0) + 1 });
  }
}

module.exports = new DecisionRepository();
