const ConversationLogRepository = require('./ConversationLogRepository');
const logger = require('../../utils/logger');

// ConversationLogService: تسجيل "بلا حجب" (fire-and-forget) - لا يجب أبدًا أن يبطّئ رد
// البوت للزبون أو يوقفه بسبب فشل فـ التسجيل (مثال: Firestore بطيء لحظيًا).
class ConversationLogService {
  logTurn(storeId, payload) {
    ConversationLogRepository.logTurn(storeId, payload).catch((err) => {
      logger.error('فشل تسجيل دورة محادثة فـ سجل التعلّم', { storeId, error: err.message });
    });
  }

  async getPendingReviewCandidates(storeId, options) {
    return ConversationLogRepository.findPendingReviewCandidates(storeId, options);
  }

  async markApproved(storeId, logId) {
    return ConversationLogRepository.markApproved(storeId, logId);
  }

  async markEdited(storeId, logId, finalReply) {
    return ConversationLogRepository.markEdited(storeId, logId, finalReply);
  }

  async findSince(storeId, sinceDate) {
    return ConversationLogRepository.findSince(storeId, sinceDate);
  }
}

module.exports = new ConversationLogService();
