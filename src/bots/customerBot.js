// بوت الزبائن: أصبح على Facebook Messenger (وليس Telegram) - صفحة واحدة تخدم كل المتاجر
// عبر روابط m.me/الصفحة?ref=معرف_المتجر. يشتغل كسيرفر HTTP يستقبل webhook من فيسبوك
// (بعكس بوتي التاجر والسوبر أدمن اللي يشتغلو بـ long polling عادي).

const { validateEnv } = require('../config/env');
validateEnv();

const express = require('express');
const { env } = require('../config/env');
const logger = require('../utils/logger');
const { installGlobalErrorHandlers } = require('../utils/errorReporter');
const registerCustomerRoutes = require('../routes/customer.routes');
const registerFacebookConnectRoutes = require('../routes/facebookConnect.routes');
const registerRegistrationRoutes = require('../routes/registration.routes');
const registerWebsiteRoutes = require('../routes/website.routes');
const { registerChargilyWebhook } = require('../routes/website.routes');
const registerAuthRoutes = require('../routes/auth.routes');
const registerDashboardRoutes = require('../routes/dashboard.routes');
const registerMediaRoutes = require('../routes/media.routes');
const registerAllListeners = require('../events/listeners');
const FacebookMessengerService = require('../services/FacebookMessengerService');
const path = require('path');

installGlobalErrorHandlers();

const app = express();

// معظم منصات الاستضافة (Railway، Render، إلخ) تضع السيرفر خلف Reverse Proxy يستقبل HTTPS من
// المستخدم لكن يحوّل الطلب لسيرفرنا عبر HTTP عادي داخليًا. بدون هذا السطر، Express يظن أن كل
// طلب HTTP (req.secure === false) حتى لو كان المستخدم فعليًا على HTTPS - وهذا كان يكسر كوكي
// تسجيل الدخول (rb_session) لأن قرار "Secure" كان يعتمد فقط على NODE_ENV بدل البروتوكول
// الحقيقي، فيؤدي أحيانًا لتضارب يمنع المتصفح من حفظ الكوكي أصلاً. راجع websiteAuthGuard.js.
app.set('trust proxy', 1);

// ⚠️ يجب تسجيل webhook الدفع قبل express.json() العام لأنه يحتاج الـ body الخام (raw bytes)
// للتحقق من توقيع Chargily (HMAC). لا تنقل هذا السطر لتحت.
registerChargilyWebhook(app);

// نحتاج الـ body الخام (rawBody) للتحقق من توقيع فيسبوك (X-Hub-Signature-256)
app.use(
  express.json({
    // 2mb (بدل الافتراضي 100kb): لوحة تحكم الموقع تبعث رسائل صوتية (base64) لقسم "الرسائل
    // الصوتية" - أكبر ملف مسموح به VoiceBlobRepository.MAX_RAW_BYTES (~600kb خام) يصير حوالي
    // 820kb بعد base64 + بيانات الطلب الإضافية، فنخلي هامش أمان مريح.
    limit: '2mb',
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
// فورم التسجيل الذاتي (/register) يبعث بيانات بصيغة application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));

// الموقع العام (الصفحة الرئيسية + صفحة الأسعار + الدفع) - كل الملفات الثابتة في مجلد public/
app.use(express.static(path.join(__dirname, '../../public')));

registerCustomerRoutes(app);
registerFacebookConnectRoutes(app);
registerRegistrationRoutes(app);
registerWebsiteRoutes(app);
registerAuthRoutes(app);
registerDashboardRoutes(app);
registerMediaRoutes(app);
registerAllListeners(); // تفعيل الاستماع للأحداث (إشعارات + تحليلات)

app.listen(env.facebook.port, () => {
  logger.info(`🤖 RedonBot (Customer/Facebook Messenger) يعمل الآن على المنفذ ${env.facebook.port}`);
});

// يضبط زر "Get Started" على الصفحة (عملية آمنة التكرار - تُعاد فقط عند إعادة تشغيل البوت)
FacebookMessengerService.setupMessengerProfile();
