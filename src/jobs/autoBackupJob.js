const StoreRepository = require('../repositories/StoreRepository');
const BackupService = require('../services/BackupService');
const logger = require('../utils/logger');

// نسخة احتياطية تلقائية أسبوعية (المتطلب #11) - فقط للمتاجر اللي باقتها تدعم `backup`
// (راجع src/config/plans.js). المتاجر الكبيرة جدًا التي يفشل حفظها تلقائيًا (حد Firestore
// للمستند الواحد) تُسجَّل كتحذير بدل توقف باقي المتاجر - راجع BackupService لتفاصيل القيد.
async function autoBackupJob() {
  const stores = await StoreRepository.findAllActive();
  const eligible = stores.filter((s) => s.features?.backup);
  let created = 0;

  for (const store of eligible) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await BackupService.createSavedSnapshot(store.id, { triggeredBy: 'auto_weekly' });
      created += 1;
    } catch (err) {
      logger.warn('autoBackupJob: فشلت نسخة احتياطية تلقائية لمتجر', { storeId: store.id, error: err.message });
    }
  }

  logger.info('autoBackupJob: انتهت الجولة الأسبوعية', { eligible: eligible.length, created });
}

module.exports = autoBackupJob;
