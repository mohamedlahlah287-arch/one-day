const StoreRepository = require('../repositories/StoreRepository');
const OrderService = require('../services/OrderService');
const NotificationService = require('../services/NotificationService');
const logger = require('../utils/logger');

// كل يوم، يبعت لكل تاجر ملخص بسيط عن نشاط متجره
async function dailyReportJob() {
  const stores = await StoreRepository.findAllActive();
  for (const store of stores) {
    const stats = await OrderService.getStats(store.id);
    await NotificationService.notifyStoreOwner(
      store.id,
      `📊 تقرير يومي - ${store.storeName}\n\nإجمالي الطلبات: ${stats.totalOrders}\nالملغاة: ${stats.cancelledOrders}`
    );
  }
  logger.info('dailyReportJob: تم الإرسال', { storesCount: stores.length });
}

module.exports = dailyReportJob;
