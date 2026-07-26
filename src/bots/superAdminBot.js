// بوت السوبر أدمن: خاص بك أنت فقط (Mohamed). يسمح بإضافة/تعديل/إيقاف/حذف المتاجر وباقاتها.
// أي شخص آخر غير SUPER_ADMIN_TELEGRAM_ID يتم تجاهله بصمت (superAdminGuard).

const { validateEnv } = require('../config/env');
validateEnv();

const { Telegraf, Scenes, session } = require('telegraf');
const { env } = require('../config/env');
const logger = require('../utils/logger');
const { installGlobalErrorHandlers } = require('../utils/errorReporter');
const { globalErrorHandler } = require('../middlewares/errorHandler');
const superAdminGuard = require('../middlewares/superAdminGuard');
const startScheduler = require('../jobs/scheduler');

installGlobalErrorHandlers();

const addStoreScene = require('./superAdminScenes/addStoreScene');
const customPlanScene = require('./superAdminScenes/customPlanScene');
const editGlobalPlanScene = require('./superAdminScenes/editGlobalPlanScene');
const createPromoCodeScene = require('./superAdminScenes/createPromoCodeScene');
const registerSuperAdminRoutes = require('../routes/superadmin.routes');

const bot = new Telegraf(env.telegram.superAdminBotToken);
const stage = new Scenes.Stage([addStoreScene, customPlanScene, editGlobalPlanScene, createPromoCodeScene]);

bot.use(superAdminGuard);
bot.use(session());
bot.use(stage.middleware());

registerSuperAdminRoutes(bot);

bot.catch(globalErrorHandler);

bot.launch().then(() => {
  logger.info('👑 RedonBot (Super Admin) يعمل الآن');
});

// المجدول المركزي (فحص الاشتراكات المنتهية، التذكيرات، التقارير اليومية، التنظيف) يعمل من هنا فقط
startScheduler();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
