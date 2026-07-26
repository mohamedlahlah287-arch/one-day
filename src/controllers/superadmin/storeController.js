const StoreService = require('../../services/StoreService');
const { toUserMessage } = require('../../middlewares/errorHandler');
const SubscriptionService = require('../../services/SubscriptionService');
const { getPlan } = require('../../config/plans');
const {
  storeListInline,
  storeManageInline,
  formatStoreDetails,
  planChoiceInline,
  confirmDeleteInline,
  mainMenu,
} = require('../../ui/superAdminKeyboards');

async function listStores(ctx) {
  const stores = await StoreService.listAllStores();
  if (stores.length === 0) {
    return ctx.reply('لا توجد متاجر مسجلة بعد. استعمل "➕ إضافة متجر جديد".', mainMenu);
  }
  return ctx.reply(`📋 عدد المتاجر: ${stores.length}\n\nاختر متجرًا لعرض التفاصيل:`, storeListInline(stores));
}

async function listStoresAction(ctx) {
  await ctx.answerCbQuery();
  const stores = await StoreService.listAllStores();
  if (stores.length === 0) {
    return ctx.editMessageText('لا توجد متاجر مسجلة بعد.');
  }
  return ctx.editMessageText(`📋 عدد المتاجر: ${stores.length}\n\nاختر متجرًا لعرض التفاصيل:`, storeListInline(stores));
}

async function manageStoreAction(ctx) {
  await ctx.answerCbQuery();
  const storeId = ctx.match[1];
  const store = await StoreService.getStore(storeId);
  if (!store) return ctx.editMessageText('⚠️ هذا المتجر لم يعد موجودًا.');
  return ctx.editMessageText(formatStoreDetails(store), storeManageInline(storeId, store));
}

async function pauseStoreAction(ctx) {
  await ctx.answerCbQuery('تم الإيقاف');
  const storeId = ctx.match[1];
  await StoreService.pauseStore(storeId);
  const store = await StoreService.getStore(storeId);
  return ctx.editMessageText(formatStoreDetails(store), storeManageInline(storeId, store));
}

async function unpauseStoreAction(ctx) {
  try {
    const storeId = ctx.match[1];
    await StoreService.unpauseStore(storeId);
    await ctx.answerCbQuery('تم التفعيل');
    const store = await StoreService.getStore(storeId);
    return ctx.editMessageText(formatStoreDetails(store), storeManageInline(storeId, store));
  } catch (err) {
    return ctx.answerCbQuery(toUserMessage(err), { show_alert: true });
  }
}

async function renewStoreAction(ctx) {
  const storeId = ctx.match[1];
  const store = await StoreService.getStore(storeId);
  if (!store) return ctx.answerCbQuery('المتجر غير موجود', { show_alert: true });
  const plan = StoreService.buildPlanFromStore(store);
  await SubscriptionService.renew(storeId, plan);
  await ctx.answerCbQuery('تم تجديد الاشتراك ✅');
  const updated = await StoreService.getStore(storeId);
  return ctx.editMessageText(formatStoreDetails(updated), storeManageInline(storeId, updated));
}

async function changePlanPromptAction(ctx) {
  await ctx.answerCbQuery();
  const storeId = ctx.match[1];
  return ctx.editMessageText('📦 اختر الباقة الجديدة:', planChoiceInline(`change_${storeId}`));
}

async function changePlanPresetAction(ctx) {
  await ctx.answerCbQuery();
  const [, storeId, planId] = ctx.match;
  const plan = getPlan(planId);
  await StoreService.changePlan(storeId, plan);
  const store = await StoreService.getStore(storeId);
  return ctx.editMessageText(
    `✅ تم تغيير الباقة إلى "${plan.name}".\n\n${formatStoreDetails(store)}`,
    storeManageInline(storeId, store)
  );
}

async function changePlanCustomAction(ctx) {
  await ctx.answerCbQuery();
  const storeId = ctx.match[1];
  await ctx.editMessageText('⚙️ باقة مخصصة اخترتها لهذا المتجر.');
  return ctx.scene.enter('CUSTOM_PLAN_SCENE', { storeId });
}

async function deletePromptAction(ctx) {
  await ctx.answerCbQuery();
  const storeId = ctx.match[1];
  return ctx.editMessageText('⚠️ هل تريد فعلاً حذف هذا المتجر نهائيًا؟ لا يمكن التراجع عن هذا الإجراء.', confirmDeleteInline(storeId));
}

async function deleteConfirmAction(ctx) {
  const storeId = ctx.match[1];
  await StoreService.deleteStore(storeId);
  await ctx.answerCbQuery('تم الحذف');
  return ctx.editMessageText('🗑 تم حذف المتجر نهائيًا.');
}

module.exports = {
  listStores,
  listStoresAction,
  manageStoreAction,
  pauseStoreAction,
  unpauseStoreAction,
  renewStoreAction,
  changePlanPromptAction,
  changePlanPresetAction,
  changePlanCustomAction,
  deletePromptAction,
  deleteConfirmAction,
};
