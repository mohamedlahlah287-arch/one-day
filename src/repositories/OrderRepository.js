const BaseRepository = require('./BaseRepository');

class OrderRepository extends BaseRepository {
  constructor() {
    super('orders');
  }

  async findByStatus(storeId, status, limit = 50) {
    const snap = await this.collectionRef(storeId)
      .where('status', '==', status)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  // كل الطلبات التي عندها شحنة تابعة لشركة توصيل (لأي حالة). يُستعمل الفلترة على الحالات
  // النهائية (تم التسليم/راجع/ملغى) فـ الخدمة نفسها بدل الاستعلام، تفاديًا لقيد Firestore
  // على استعمال "not-in" مع شرط آخر فـ نفس الاستعلام.
  async findWithShipment(storeId, limit = 500) {
    const snap = await this.collectionRef(storeId)
      .where('shipmentProvider', '!=', null)
      .limit(limit)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  async findPendingOlderThan(storeId, date) {
    const snap = await this.collectionRef(storeId)
      .where('status', '==', 'جديد')
      .where('createdAt', '<=', date)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  async countByStatusAcrossStore(storeId) {
    const all = await this.findAll(storeId, { limit: 1000 });
    return all.reduce((acc, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1;
      return acc;
    }, {});
  }

  // يجمع الطلبات حسب المنتج ليعطي الأكثر مبيعًا (يستثني الطلبات الملغاة)
  async getTopSellingProducts(storeId, limit = 5) {
    const all = await this.findAll(storeId, { limit: 1000 });
    const counts = {};
    for (const order of all) {
      if (order.status === 'ملغى' || !order.productId) continue;
      if (!counts[order.productId]) {
        counts[order.productId] = { productId: order.productId, productName: order.productName, count: 0, revenue: 0 };
      }
      counts[order.productId].count += 1;
      counts[order.productId].revenue += Number(order.total || order.price || 0);
    }
    return Object.values(counts)
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }
}

module.exports = new OrderRepository();
