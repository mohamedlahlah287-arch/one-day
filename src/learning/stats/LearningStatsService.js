const ConversationLogService = require('../conversationLog/ConversationLogService');
const StoreDictionaryRepository = require('../dictionary/StoreDictionaryRepository');
const DecisionRepository = require('../decisions/DecisionRepository');
const TrainingExampleRepository = require('../training/TrainingExampleRepository');

// LearningStatsService: يبني تقرير أسبوعي مقروء للتاجر (البند الحادي عشر فـ المتطلبات):
// أكثر الأسئلة تكرارًا، أكثر المنتجات المسؤول عنها، عدد الردود المعدَّلة، الكلمات الجديدة
// المتعلَّمة، عدد القرارات الجديدة، واقتراحات بسيطة لتحسين الخدمة.
class LearningStatsService {
  async buildWeeklyReport(storeId) {
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const [logEntries, examples, dictionaryTerms, decisions] = await Promise.all([
      ConversationLogService.findSince(storeId, since),
      TrainingExampleRepository.findRecent(storeId, 500),
      StoreDictionaryRepository.findAllTerms(storeId),
      DecisionRepository.findAllDecisions(storeId),
    ]);

    const recentExamples = examples.filter((e) => e.createdAt?.toDate && e.createdAt.toDate() >= since);
    const editedCount = recentExamples.filter((e) => e.wasEdited).length;

    const newDictionaryTerms = dictionaryTerms.filter(
      (t) => t.createdAt?.toDate && t.createdAt.toDate() >= since
    );
    const newDecisions = decisions.filter((d) => d.createdAt?.toDate && d.createdAt.toDate() >= since);

    const topQuestions = topByFrequency(
      logEntries.map((e) => e.customerMessage).filter(Boolean),
      5
    );
    const topProducts = topByFrequency(
      logEntries.map((e) => e.productId).filter(Boolean),
      5
    );

    const suggestions = buildSuggestions({ editedCount, totalTurns: logEntries.length, newDictionaryTerms });

    return {
      periodDays: 7,
      totalConversations: logEntries.length,
      topQuestions,
      topProducts,
      editedRepliesCount: editedCount,
      newDictionaryTermsCount: newDictionaryTerms.length,
      newDictionaryTerms: newDictionaryTerms.map((t) => t.term),
      newDecisionsCount: newDecisions.length,
      suggestions,
    };
  }

  // نص جاهز للإرسال مباشرة عبر Telegram (NotificationService.notifyStoreOwner)
  formatReportAsText(storeName, report) {
    const lines = [
      `📊 التقرير الأسبوعي للتعلّم - ${storeName}`,
      '',
      `💬 عدد المحادثات: ${report.totalConversations}`,
      `✏️ ردود احتاجت تعديل: ${report.editedRepliesCount}`,
      `📚 كلمات جديدة تعلمها البوت: ${report.newDictionaryTermsCount}${
        report.newDictionaryTerms.length ? ` (${report.newDictionaryTerms.join('، ')})` : ''
      }`,
      `📒 قرارات جديدة سُجّلت: ${report.newDecisionsCount}`,
    ];

    if (report.topQuestions.length) {
      lines.push('', '🔝 أكثر الأسئلة تكرارًا:');
      report.topQuestions.forEach((q, i) => lines.push(`${i + 1}. ${q.value} (${q.count} مرة)`));
    }

    if (report.suggestions.length) {
      lines.push('', '💡 اقتراحات لتحسين خدمة العملاء:');
      report.suggestions.forEach((s) => lines.push(`• ${s}`));
    }

    return lines.join('\n');
  }
}

function topByFrequency(items, limit) {
  const counts = new Map();
  for (const item of items) counts.set(item, (counts.get(item) || 0) + 1);
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

function buildSuggestions({ editedCount, totalTurns, newDictionaryTerms }) {
  const suggestions = [];
  if (totalTurns > 0 && editedCount / totalTurns > 0.3) {
    suggestions.push('نسبة الردود المعدَّلة مرتفعة هذا الأسبوع - قد يفيد إضافة قرارات ثابتة للأسئلة المتكررة عبر دفتر القرارات.');
  }
  if (newDictionaryTerms.length >= 5) {
    suggestions.push('تعلّم البوت عدة كلمات محلية جديدة هذا الأسبوع - القاموس يتحسن باستمرار مع كل تصحيح منك.');
  }
  if (totalTurns === 0) {
    suggestions.push('لا توجد محادثات هذا الأسبوع - تأكد أن رابط المتجر يصل للزبائن بشكل صحيح.');
  }
  return suggestions;
}

module.exports = new LearningStatsService();
