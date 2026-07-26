const OrderService = require('../../services/OrderService');
const { orderStatusInline } = require('../../ui/adminKeyboards');

async function listOrders(ctx) {
  const storeId = ctx.state.store.id;
  const orders = await OrderService.listOrders(storeId);
  if (orders.length === 0) {
    await ctx.reply('لا توجد طلبات بعد.');
    return;
  }
  const showConfirm = Boolean(ctx.state.store.orderConfirmationEnabled);
  for (const o of orders) {
    const text = `🛒 طلب #${o.id.slice(0, 6)}\n\n👤 ${o.name}\n📱 ${o.phone}\n📍 ${o.wilaya}, ${o.commune}\n🏠 ${o.address}\n📦 ${o.productName}\n💰 ${o.total} دج\n📌 الحالة: ${o.status}`;
    await ctx.reply(text, orderStatusInline(o.id, showConfirm));
  }
}

const STATUS_MAP = {
  confirm: 'تم التأكيد',
  shipped: 'تم الشحن',
  delivered: 'تم التسليم',
  cancel: 'ملغى',
};

async function updateOrderStatusAction(ctx) {
  const [, action, orderId] = ctx.match;
  const storeId = ctx.state.store.id;
  const actor = { id: ctx.from?.id, name: [ctx.from?.first_name, ctx.from?.last_name].filter(Boolean).join(' ') || ctx.from?.username };
  await OrderService.updateStatus(storeId, orderId, STATUS_MAP[action], actor);
  await ctx.answerCbQuery('تم التحديث ✅');
  await ctx.editMessageReplyMarkup(null);
}

module.exports = { listOrders, updateOrderStatusAction };
