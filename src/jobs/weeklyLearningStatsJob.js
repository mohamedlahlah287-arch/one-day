const StoreRepository = require('../repositories/StoreRepository');
const NotificationService = require('../services/NotificationService');
const LearningStatsService = require('../learning/stats/LearningStatsService');
const logger = require('../utils/logger');

// كل أسبوع، يبني ويرسل لكل تاجر تقرير نظام التعلّم (البند الحادي عشر فـ المتطلبات):
// أكثر الأسئلة تكرارًا، الردود التي احتاجت تعديل، الكلمات والقرارات الجديدة، واقتراحات.
async function weeklyLearningStatsJob() {
  const stores = await StoreRepository.findAllActive();
  for (const store of stores) {
    try {
      const report = await LearningStatsService.buildWeeklyReport(store.id);
      if (report.totalConversations === 0) continue; // لا داعي لإزعاج متجر بلا نشاط
      const text = LearningStatsService.formatReportAsText(store.storeName, report);
      await NotificationService.notifyStoreOwner(store.id, text);
    } catch (err) {
      logger.error('فشل بناء/إرسال تقرير التعلّم الأسبوعي لمتجر', { storeId: store.id, error: err.message });
    }
  }
  logger.info('weeklyLearningStatsJob: تم الإرسال', { storesCount: stores.length });
}

module.exports = weeklyLearningStatsJob;
