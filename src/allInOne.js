// نقطة تشغيل واحدة تجمع البوتات الثلاثة في نفس العملية (process) ونفس السيرفر.
// مفيد إذا حبيت تشغل كل شيء على خدمة Railway واحدة بدل 3 خدمات منفصلة (توفير في التكلفة).
//
// ⚠️ المقايضة (Trade-off) المهمة: هنا الثلاثة يشتركون في نفس العملية.
// لو صار خطأ غير متوقع (uncaught exception) ما تلقطوش try/catch، Node.js قد يوقف العملية كاملة،
// يعني البوتات الثلاثة تتوقف مع بعض، بعكس التشغيل المنفصل (3 خدمات) وين مشكل فـ وحدة
// ما يأثرش على الباقي. إذا كان عندك ميزانية Railway تسمح، التشغيل المنفصل (docs/DEPLOYMENT.md)
// يبقى أضمن للإنتاج. هذا الملف خيار عملي وسهل للبداية أو لتوفير التكلفة.
//
// أي خطأ غير متوقع (حتى لو أوقف العملية) يُبعث فورًا كإشعار مفصّل لبوت السوبر أدمن
// (اسم الملف + رسالة الخطأ) قبل التوقف - راجع src/utils/errorReporter.js

const { installGlobalErrorHandlers } = require('./utils/errorReporter');
const logger = require('./utils/logger');

installGlobalErrorHandlers();

logger.info('🚀 تشغيل البوتات الثلاثة في نفس العملية...');

require('./bots/adminBot'); // بوت التاجر (Telegram)
require('./bots/superAdminBot'); // بوت السوبر أدمن (Telegram) + المجدول (cron)
require('./bots/customerBot'); // بوت الزبائن (Facebook Messenger - سيرفر Express)
