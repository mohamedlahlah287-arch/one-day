// ملاحظة: هذا الملف هو "بوت التاجر" (صاحب المتجر يدير منتجاته وطلباته من هنا).
// اسم الملف بقي adminBot.js لتفادي تغييرات كبيرة، لكنه ليس بوت السوبر أدمن.
// بوت السوبر أدمن الحقيقي (إضافة/حذف/تجديد المتاجر) موجود في src/bots/superAdminBot.js

const { validateEnv } = require('../config/env');
validateEnv(); // يوقف البرنامج فورًا لو ناقص متغير بيئة مهم، بلاصة يفشل بشكل غامض بعدين

const { Telegraf, Scenes, session } = require('telegraf');
const { env } = require('../config/env');
const logger = require('../utils/logger');
const { installGlobalErrorHandlers } = require('../utils/errorReporter');
const { globalErrorHandler } = require('../middlewares/errorHandler');
const registerAllListeners = require('../events/listeners');

installGlobalErrorHandlers();

const addProductScene = require('./adminScenes/addProductScene');
const manageStaffScene = require('./adminScenes/manageStaffScene');
const attachProductVoiceScene = require('./adminScenes/attachProductVoiceScene');
const { attachIntentVoiceScene } = require('./adminScenes/attachIntentVoiceScene');
const registerAdminRoutes = require('../routes/admin.routes');

// نظام التعلّم والذاكرة (src/learning): زر "علمني" يحتاج معالجات (bot.action) + سيناريو
// (Scene) لالتقاط نص الرد المعدَّل - كلاهما يُسجَّل هنا فقط، بلا أي تغيير فـ باقي البوت.
const { registerTeachHandlers, teachEditScene } = require('../learning/teach/teachHandlers');

const bot = new Telegraf(env.telegram.merchantBotToken);
const stage = new Scenes.Stage([addProductScene, manageStaffScene, teachEditScene, attachProductVoiceScene, attachIntentVoiceScene]);

bot.use(session());
bot.use(stage.middleware());

registerAdminRoutes(bot);
registerTeachHandlers(bot);

bot.catch(globalErrorHandler);

registerAllListeners(); // تفعيل الاستماع للأحداث (إشعارات + تحليلات)

bot.launch().then(() => {
  logger.info('🤖 RedonBot (Merchant/التاجر) يعمل الآن');
});

// ملاحظة: المجدول (cron jobs) انتقل الآن لبوت السوبر أدمن (superAdminBot.js)
// حتى ما يتكررش نفس المهام لو شغلنا أكثر من عملية.

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
