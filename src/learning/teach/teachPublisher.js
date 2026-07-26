const NotificationService = require('../../services/NotificationService');
const { teachKeyboard, formatReviewMessage } = require('./teachKeyboard');

// teachPublisher: يُستدعى من بوت الزبائن (Facebook) بعد كل رد اعتمد على AI أو fallback -
// يرسل للتاجر عبر تيليغرام بطاقة مراجعة بزري "✔ ممتاز" / "✏️ تعديل" (البند الرابع فـ المتطلبات).
// لا نرسل مراجعة لكل رد (سيكون مزعجًا) - فقط للردود الأقل موثوقية، وهذا القرار يُتخذ مسبقًا
// فـ ConversationLogRepository.findPendingReviewCandidates ونستدعيه هنا مباشرة عند الحاجة الفورية.
async function publishForReview(storeId, logEntry) {
  const message = formatReviewMessage({
    customerMessage: logEntry.customerMessage,
    botReply: logEntry.botReply,
    intent: logEntry.intent,
  });
  await NotificationService.notifyStoreOwnerInteractive(storeId, message, teachKeyboard(logEntry.id));
}

module.exports = { publishForReview };
