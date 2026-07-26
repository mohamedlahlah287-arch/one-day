const BaseRepository = require('../../repositories/BaseRepository');

// ConversationLogRepository: سجل كل "دورة" (رسالة زبون + رد البوت) مع مصدر الرد (قاموس /
// قرار / كلمة مفتاحية / AI / fallback) وحالة المراجعة من التاجر. هذا السجل هو ما يغذي:
// - قائمة "علمني" (الردود المرشحة لمراجعة التاجر)
// - الإحصائيات الأسبوعية
// stores/{storeId}/learningConversationLog/{logId}
class ConversationLogRepository extends BaseRepository {
  constructor() {
    super('learningConversationLog');
  }

  async logTurn(storeId, { psid, customerMessage, botReply, intent, source, productId = null }) {
    return this.create(storeId, {
      psid,
      customerMessage,
      botReply,
      intent: intent || 'unknown',
      source, // 'dictionary' | 'decision' | 'keyword' | 'ai' | 'fallback'
      productId,
      reviewStatus: 'pending', // 'pending' | 'approved' | 'edited'
      finalReply: null,
    });
  }

  async markApproved(storeId, logId) {
    return this.update(storeId, logId, { reviewStatus: 'approved' });
  }

  async markEdited(storeId, logId, finalReply) {
    return this.update(storeId, logId, { reviewStatus: 'edited', finalReply });
  }

  // آخر عناصر تحتاج مراجعة تاجر - نُرجع فقط الردود الأقل موثوقية (AI أو fallback) لأنها
  // الأكثر عرضة لخطأ يستحق تصحيحًا، بدل إغراق التاجر بمراجعة كل تحية "سلام".
  async findPendingReviewCandidates(storeId, { limit = 20 } = {}) {
    const recent = await this.findAll(storeId, { limit: 200 });
    return recent
      .filter((entry) => entry.reviewStatus === 'pending' && (entry.source === 'ai' || entry.source === 'fallback'))
      .slice(0, limit);
  }

  async findSince(storeId, sinceDate, limit = 2000) {
    const all = await this.findAll(storeId, { limit });
    return all.filter((e) => e.createdAt?.toDate && e.createdAt.toDate() >= sinceDate);
  }
}

module.exports = new ConversationLogRepository();
