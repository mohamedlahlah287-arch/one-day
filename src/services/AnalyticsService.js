const BaseRepository = require('../repositories/BaseRepository');
const logger = require('../utils/logger');

const analyticsRepo = new BaseRepository('analyticsEvents');

/**
 * AnalyticsService: تسجيل الأحداث المهمة للتحليل لاحقًا (بلا ما يبطئ العملية الأساسية).
 */
class AnalyticsService {
  async track(storeId, eventName, data = {}) {
    try {
      await analyticsRepo.create(storeId, { eventName, data });
    } catch (err) {
      // التحليلات ما يخصهاش توقف العملية الأساسية إذا فشلت
      logger.warn('فشل تسجيل حدث تحليلي', { storeId, eventName, error: err.message });
    }
  }
}

module.exports = new AnalyticsService();
