const cron = require('node-cron');
const logger = require('../utils/logger');
const { reportError } = require('../utils/errorReporter');
const subscriptionExpirationJob = require('./subscriptionExpirationJob');
const dailyReportJob = require('./dailyReportJob');
const cleanupJob = require('./cleanupJob');
const abandonedCartJob = require('./abandonedCartJob');
const promoCodeExpirationJob = require('./promoCodeExpirationJob');
const weeklyLearningStatsJob = require('./weeklyLearningStatsJob');
const deliveryStatusSyncJob = require('./deliveryStatusSyncJob');
const autoBackupJob = require('./autoBackupJob');

/**
 * المجدول المركزي لكل المهام الدورية. يُستدعى مرة واحدة فقط، من بوت السوبر أدمن
 * (ماشي من بوت التاجر أو الزبائن، باش ما تتكررش نفس المهمة مرتين لو شغلنا أكثر من عملية).
 * أي مهمة تفشل: تُسجَّل فـ اللوقات + إشعار فوري لبوت السوبر أدمن (بدل ما يبقى الفشل مخفي).
 *
 * ملاحظة: تذكير الطلبات المعلقة كل ساعة (reminderJob) أُلغي بطلب من التاجر - الطلب يظهر مباشرة
 * وما يحتاجش "تأكيد" من البوت، التاجر يجهزه مباشرة.
 */
function startScheduler() {
  // كل يوم الساعة 20:00: تقرير يومي
  cron.schedule('0 20 * * *', () =>
    dailyReportJob().catch((err) => reportError(err, 'المجدول - dailyReportJob'))
  );

  // كل يوم الساعة 03:00: فحص الاشتراكات المنتهية
  cron.schedule('0 3 * * *', () =>
    subscriptionExpirationJob().catch((err) => reportError(err, 'المجدول - subscriptionExpirationJob'))
  );

  // كل يوم الساعة 04:00: تنظيف
  cron.schedule('0 4 * * *', () => cleanupJob().catch((err) => reportError(err, 'المجدول - cleanupJob')));

  // كل 15 دقيقة: متابعة الزبائن اللي بداو طلب وما كملوهش (سلة متروكة)
  cron.schedule('*/15 * * * *', () =>
    abandonedCartJob().catch((err) => reportError(err, 'المجدول - abandonedCartJob'))
  );

  // كل 15 دقيقة: إرجاع المتاجر اللي انتهت مدة كود العرض المؤقت تاعها لباقتها الأصلية
  cron.schedule('*/15 * * * *', () =>
    promoCodeExpirationJob().catch((err) => reportError(err, 'المجدول - promoCodeExpirationJob'))
  );

  // كل يوم الاثنين الساعة 09:00: تقرير أسبوعي لنظام التعلّم والذاكرة (src/learning)
  cron.schedule('0 9 * * 1', () =>
    weeklyLearningStatsJob().catch((err) => reportError(err, 'المجدول - weeklyLearningStatsJob'))
  );

  // كل 10 دقائق: مزامنة حالات الشحنات مع شركات التوصيل (Yalidine وغيرها لاحقًا)
  cron.schedule('*/10 * * * *', () =>
    deliveryStatusSyncJob().catch((err) => reportError(err, 'المجدول - deliveryStatusSyncJob'))
  );

  // كل جمعة الساعة 3 صباحًا: نسخة احتياطية تلقائية للمتاجر المؤهلة (باقة Pro/Enterprise)
  cron.schedule('0 3 * * 5', () =>
    autoBackupJob().catch((err) => reportError(err, 'المجدول - autoBackupJob'))
  );

  logger.info('✅ المجدول (Scheduler) بدأ العمل - 8 مهام مجدولة');
}

module.exports = startScheduler;
