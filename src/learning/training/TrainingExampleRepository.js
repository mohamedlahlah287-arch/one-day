const BaseRepository = require('../../repositories/BaseRepository');

// TrainingExampleRepository: كل مثال = لحظة تعلّم واحدة (رسالة زبون + رد الذكاء الاصطناعي
// المبدئي + الرد النهائي الذي اعتمده التاجر + نوع السؤال). هذه الأمثلة هي "وقود" كل من:
// StoreMemoryService (تعلّم الأسلوب)، StoreDictionaryService (تعلّم الكلمات)، والإحصائيات.
// stores/{storeId}/learningTrainingExamples/{exampleId}
class TrainingExampleRepository extends BaseRepository {
  constructor() {
    super('learningTrainingExamples');
  }

  async recordExample(storeId, { customerMessage, aiReply, finalReply, questionType = 'general', wasEdited }) {
    return this.create(storeId, {
      customerMessage,
      aiReply: aiReply || null,
      finalReply,
      questionType,
      wasEdited: Boolean(wasEdited),
    });
  }

  async countSince(storeId, sinceDate) {
    const all = await this.findAll(storeId, { limit: 1000 });
    return all.filter((e) => e.createdAt && e.createdAt.toDate && e.createdAt.toDate() >= sinceDate).length;
  }

  async findRecent(storeId, limit = 200) {
    return this.findAll(storeId, { limit });
  }
}

module.exports = new TrainingExampleRepository();
