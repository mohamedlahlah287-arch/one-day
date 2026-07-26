const OrderService = require('../../services/OrderService');
const ProductService = require('../../services/ProductService');
const StoreService = require('../../services/StoreService');
const RatingService = require('../../services/RatingService');

async function showStats(ctx) {
  const storeId = ctx.state.store.id;
  const [orderStats, products, store, rating] = await Promise.all([
    OrderService.getStats(storeId),
    ProductService.listProducts(storeId),
    StoreService.getStore(storeId),
    RatingService.getAverage(storeId),
  ]);

  const ratingLine = rating.count > 0 ? `⭐ تقييم متجرك: ${rating.average}/5 (${rating.count} تقييم)` : '⭐ لا يوجد تقييمات بعد';

  let message = `📊 إحصائيات متجرك:\n\n📦 عدد المنتجات: ${products.length}\n🛒 إجمالي الطلبات: ${orderStats.totalOrders}\n❌ الطلبات الملغاة: ${orderStats.cancelledOrders}\n${ratingLine}`;

  if (store?.features?.fullAnalytics) {
    const topProducts = await OrderService.getTopProducts(storeId, 5);
    if (topProducts.length > 0) {
      const list = topProducts
        .map((p, i) => `${i + 1}. ${p.productName} - ${p.count} مبيعة (${p.revenue} دج)`)
        .join('\n');
      message += `\n\n🏆 الأكثر مبيعًا:\n${list}`;
    }
  } else {
    message += '\n\n🔒 الإحصائيات الكاملة (الأكثر مبيعًا) متوفرة في باقة "الأعمال". تواصل مع الإدارة للترقية.';
  }

  await ctx.reply(message);
}

module.exports = { showStats };
