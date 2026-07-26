const PlatformAnalyticsService = require('../../services/PlatformAnalyticsService');

async function showPlatformStats(ctx) {
  const stats = await PlatformAnalyticsService.getPlatformStats();

  const topStoresText = stats.topStores.length
    ? stats.topStores
        .map((s, i) => `${i + 1}. ${s.storeName} — ${s.orders} طلب — ${s.revenue.toLocaleString('ar-DZ')} دج`)
        .join('\n')
    : 'لا توجد طلبات بعد.';

  await ctx.reply(
    `📊 إحصائيات المنصة الكاملة:\n\n` +
      `🏪 عدد المتاجر: ${stats.totalStores} (🟢 ${stats.activeStores} نشط، 🧪 ${stats.trialStores} تجريبي، 🔴 ${stats.expiredStores} منتهي)\n` +
      `📘 متاجر ربطت صفحتهم الخاصة: ${stats.connectedPages}\n` +
      `📦 إجمالي الطلبات (غير الملغاة): ${stats.totalOrders}\n` +
      `💰 إجمالي الإيرادات: ${stats.totalRevenue.toLocaleString('ar-DZ')} دج\n` +
      `💬 إجمالي الرسائل هذا الشهر: ${stats.totalMessages}\n\n` +
      `🏆 أفضل 5 متاجر (حسب الإيرادات):\n${topStoresText}`
  );
}

module.exports = { showPlatformStats };
