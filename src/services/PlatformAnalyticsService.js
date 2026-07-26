const StoreRepository = require('../repositories/StoreRepository');
const OrderRepository = require('../repositories/OrderRepository');

// إحصائيات عامة عبر كل المتاجر - للسوبر أدمن فقط. تجميع بسيط (loop) مناسب لعدد متاجر
// متوسط (عشرات إلى مئات)؛ إذا كبر عدد المتاجر بزاف فـ المستقبل، يفضل نبنيو جدول تجميعي
// (aggregation collection) نحدثه عند كل طلب بدل الحساب الحي فـ كل مرة.
class PlatformAnalyticsService {
  async getPlatformStats() {
    const stores = await StoreRepository.findAllStores(500);
    const activeStores = stores.filter((s) => s.active).length;
    const trialStores = stores.filter((s) => s.subscriptionStatus === 'trial').length;
    const expiredStores = stores.filter((s) => s.subscriptionStatus === 'expired').length;
    const connectedPages = stores.filter((s) => s.facebookConnected).length;

    let totalOrders = 0;
    let totalRevenue = 0;
    let totalMessages = 0;
    const perStore = [];

    for (const store of stores) {
      const orders = await OrderRepository.findAll(store.id, { limit: 1000 }).catch(() => []);
      const validOrders = orders.filter((o) => o.status !== 'ملغى');
      const revenue = validOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
      totalOrders += validOrders.length;
      totalRevenue += revenue;
      totalMessages += store.messageCount || 0;
      perStore.push({ storeId: store.id, storeName: store.storeName, orders: validOrders.length, revenue });
    }

    const topStores = [...perStore].sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    return {
      totalStores: stores.length,
      activeStores,
      trialStores,
      expiredStores,
      connectedPages,
      totalOrders,
      totalRevenue,
      totalMessages,
      topStores,
    };
  }
}

module.exports = new PlatformAnalyticsService();
