const StoreRepository = require('../repositories/StoreRepository');
const DeliveryService = require('../services/DeliveryService');
const logger = require('../utils/logger');

// يمر على كل المتاجر النشطة ويسحب آخر حالة لكل شحنة غير منتهية عند شركة التوصيل
// (المتطلب #3: مزامنة حالة الطلب). التغييرات تُطلق SHIPMENT_STATUS_CHANGED تلقائيًا
// من DeliveryService، والذي يُشعر الزبون (src/events/listeners/notificationListeners.js).
async function deliveryStatusSyncJob() {
  const stores = await StoreRepository.findAllActive();
  let totalChecked = 0;
  let totalUpdated = 0;

  for (const store of stores) {
    try {
      const { checked, updated } = await DeliveryService.syncAllActiveShipmentsForStore(store.id);
      totalChecked += checked;
      totalUpdated += updated;
    } catch (err) {
      logger.error('deliveryStatusSyncJob: فشل فحص متجر', { storeId: store.id, error: err.message });
    }
  }

  logger.info('deliveryStatusSyncJob: تم الفحص', { stores: stores.length, totalChecked, totalUpdated });
}

module.exports = deliveryStatusSyncJob;
