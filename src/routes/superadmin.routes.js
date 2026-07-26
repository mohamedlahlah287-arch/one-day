const { asyncHandler } = require('../middlewares/errorHandler');
const { mainMenu, globalPlansInline } = require('../ui/superAdminKeyboards');
const storeController = require('../controllers/superadmin/storeController');
const analyticsController = require('../controllers/superadmin/analyticsController');
const withdrawalController = require('../controllers/superadmin/withdrawalController');
const PlanService = require('../services/PlanService');

function registerSuperAdminRoutes(bot) {
  bot.start(
    asyncHandler(async (ctx) => {
      await ctx.reply('👑 أهلاً بك في لوحة تحكم السوبر أدمن.', mainMenu);
    })
  );

  bot.hears('❌ إلغاء', asyncHandler(async (ctx) => {
    if (ctx.scene?.current) await ctx.scene.leave();
    await ctx.reply('تم الإلغاء.', mainMenu);
  }));

  bot.hears('➕ إضافة متجر جديد', asyncHandler((ctx) => ctx.scene.enter('ADD_STORE_SCENE')));
  bot.hears('📋 كل المتاجر', asyncHandler(storeController.listStores));
  bot.hears('📊 إحصائيات المنصة', asyncHandler(analyticsController.showPlatformStats));

  bot.action('store_list', asyncHandler(storeController.listStoresAction));
  bot.action(/store_manage_(\d+)/, asyncHandler(storeController.manageStoreAction));
  bot.action(/store_pause_(\d+)/, asyncHandler(storeController.pauseStoreAction));
  bot.action(/store_unpause_(\d+)/, asyncHandler(storeController.unpauseStoreAction));
  bot.action(/store_renew_(\d+)/, asyncHandler(storeController.renewStoreAction));
  bot.action(/store_changeplan_(\d+)/, asyncHandler(storeController.changePlanPromptAction));
  bot.action(/store_delete_(\d+)/, asyncHandler(storeController.deletePromptAction));
  bot.action(/store_delete_confirm_(\d+)/, asyncHandler(storeController.deleteConfirmAction));

  bot.action(/plan_change_(\d+)_(starter|pro|business)/, asyncHandler(storeController.changePlanPresetAction));
  bot.action(/plan_change_(\d+)_custom/, asyncHandler(storeController.changePlanCustomAction));

  // تعديل الخطط العامة (السعر/الحدود/المميزات) المطبّقة على كل التجار الجدد
  bot.hears(
    '💳 تعديل الخطط العامة',
    asyncHandler(async (ctx) => {
      const plans = await PlanService.getAllEffectivePlans();
      await ctx.reply('اختر الباقة اللي تريد تعديلها:', globalPlansInline(plans));
    })
  );

  bot.action(
    /editplan_(free|starter|growth|pro|business)/,
    asyncHandler(async (ctx) => {
      await ctx.answerCbQuery();
      const planId = ctx.match[1];
      await ctx.scene.enter('EDIT_GLOBAL_PLAN_SCENE', { planId });
    })
  );

  bot.hears('🎟️ إنشاء كود عرض', asyncHandler((ctx) => ctx.scene.enter('CREATE_PROMO_CODE_SCENE')));

  // ===== طلبات السحب (برنامج الإحالة) =====
  bot.hears('💸 طلبات السحب (الإحالة)', asyncHandler(withdrawalController.listPending));
  bot.action('wd_list', asyncHandler(withdrawalController.listPendingAction));
  bot.action(/wd_view_(.+)/, asyncHandler(withdrawalController.viewAction));
  bot.action(/wd_approve_(.+)/, asyncHandler(withdrawalController.approveAction));
  bot.action(/wd_reject_(.+)/, asyncHandler(withdrawalController.rejectAction));
}

module.exports = registerSuperAdminRoutes;
