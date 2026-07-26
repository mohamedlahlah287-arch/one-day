require('dotenv').config();

// كل الإعدادات تمر من هنا فقط. ما كايناش قيم مكتوبة يدويًا (hardcoded) في باقي الكود.
const requiredVars = [
  'TELEGRAM_MERCHANT_BOT_TOKEN',
  'TELEGRAM_SUPERADMIN_BOT_TOKEN',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
  'SUPER_ADMIN_TELEGRAM_ID',
  'FB_PAGE_ACCESS_TOKEN',
  'FB_VERIFY_TOKEN',
];

function validateEnv() {
  const missing = requiredVars.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    // ملاحظة: نرمي خطأ عادي هنا (ماشي عبر logger) لأن هذا يحدث قبل ما يتهيأ logger
    throw new Error(`❌ متغيرات بيئة ناقصة: ${missing.join(', ')}. تحقق من ملف .env`);
  }
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',

  telegram: {
    // بوت التاجر: يستعمله صاحب المتجر لإدارة منتجاته وطلباته
    merchantBotToken: process.env.TELEGRAM_MERCHANT_BOT_TOKEN,
    // بوت السوبر أدمن: خاص بك أنت فقط - إضافة/تعديل/إيقاف/حذف المتاجر والباقات
    superAdminBotToken: process.env.TELEGRAM_SUPERADMIN_BOT_TOKEN,
  },

  // بوت الزبائن أصبح على Facebook Messenger (وليس Telegram).
  // صفحة فيسبوك واحدة تخدم كل المتاجر، والتمييز بين متجر وآخر يكون عبر رابط m.me/الصفحة?ref=معرف_المتجر
  facebook: {
    pageAccessToken: process.env.FB_PAGE_ACCESS_TOKEN,
    verifyToken: process.env.FB_VERIFY_TOKEN,
    // اختياري لكن يُنصح به بشدة: يفعّل التحقق من توقيع الطلبات القادمة من فيسبوك (أمان)
    appSecret: process.env.FB_APP_SECRET || null,
    // اسم مستخدم الصفحة (بدون @) - يُستعمل فقط لعرض روابط m.me جاهزة في بوت التاجر
    pageUsername: process.env.FB_PAGE_USERNAME || null,
    // App ID تاع تطبيق فيسبوك (Meta for Developers > Settings > Basic) - يفعّل "الربط بضغطة واحدة".
    // بدونه، التجار يقدرو يربطو صفحتهم فقط بالطريقة اليدوية (Page ID + Access Token).
    appId: process.env.FB_APP_ID || null,
    port: Number(process.env.PORT || 3000),
  },

  // الرابط العام لسيرفرك (مثلاً https://your-app.up.railway.app) - ضروري لميزة "الربط بضغطة واحدة"
  // فقط (Facebook OAuth redirect_uri). خليه فارغ إذا ماعندكش دومين عام بعد.
  appBaseUrl: (process.env.APP_BASE_URL || '').replace(/\/$/, '') || null,

  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    // اختياري: إذا أنشأت قاعدة بيانات Firestore باسم مخصص (ماشي الافتراضية "(default)")،
    // حط هنا نفس المعرف بالضبط كيما يبان فـ Firebase Console (القائمة فوق صفحة Database).
    databaseId: process.env.FIREBASE_DATABASE_ID || null,
  },

  // معرف Telegram الخاص بك (السوبر أدمن) - فقط هذا الحساب يقدر يستعمل بوت السوبر أدمن
  superAdminTelegramId: process.env.SUPER_ADMIN_TELEGRAM_ID || null,

  // اختياري: مفتاح Groq API لتفعيل تحويل الرسائل الصوتية لنص وتحليل الصور (باقات معينة فقط).
  // إذا تركته فارغًا، البوت يشتغل عادي لكن بدون هذه الميزات (يرسل رسالة بديلة وينبّه التاجر).
  groq: {
    apiKey: process.env.GROQ_API_KEY || null,
    whisperModel: process.env.GROQ_WHISPER_MODEL || 'whisper-large-v3',
    // ملاحظة: llama-3.2-11b-vision-preview تم إيقافه من طرف Groq (Decommissioned).
    // البديل الحالي (يوليو 2026) هو qwen/qwen3.6-27b (نموذج multimodal يدعم الصور).
    // تحذير: meta-llama/llama-4-scout-17b-16e-instruct (البديل المؤقت السابق) سيتوقف أيضًا بتاريخ 17/07/2026.
    visionModel: process.env.GROQ_VISION_MODEL || 'qwen/qwen3.6-27b',
    // موديل نصي خفيف وسريع لمهام بسيطة (فهم نية الزبون، مطابقة منتج) - أرخص وأسرع
    // من موديل الرؤية، ما يحتاجش يشوف صور.
    textModel: process.env.GROQ_TEXT_MODEL || 'openai/gpt-oss-20b',
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    dir: process.env.LOG_DIR || 'logs',
  },

  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 10_000), // 10 ثواني
    maxRequests: Number(process.env.RATE_LIMIT_MAX || 15), // 15 رسالة كل نافذة
  },

  queue: {
    // جاهز لـ Redis/BullMQ لاحقًا. حاليًا فارغ = يستعمل الطابور الداخلي (in-memory)
    redisUrl: process.env.REDIS_URL || null,
  },

  // إعدادات الدفع الإلكتروني عبر Chargily Pay (إدهابية Algérie Poste + بطاقة CIB).
  // خذ المفتاح من لوحة Chargily: https://pay.chargily.com/app/api-keys
  // اتركه فارغًا إن لم تربط الدفع بعد؛ الموقع سيعرض رسالة توضح أن الدفع التلقائي غير مفعّل بعد.
  chargily: {
    secretKey: process.env.CHARGILY_SECRET_KEY || null,
    publicKey: process.env.CHARGILY_PUBLIC_KEY || null,
    // true = وضع الاختبار (بطاقات وهمية، بدون خصم فعلي). حوّلها إلى false عند الانطلاق الفعلي.
    testMode: (process.env.CHARGILY_TEST_MODE || 'true').toLowerCase() !== 'false',
  },

  // روابط صفحات التواصل الاجتماعي التي تظهر في القائمة الجانبية للموقع ("تابعنا")
  social: {
    facebook: process.env.SOCIAL_FACEBOOK_URL || null,
    instagram: process.env.SOCIAL_INSTAGRAM_URL || null,
    tiktok: process.env.SOCIAL_TIKTOK_URL || null,
    whatsapp: process.env.SOCIAL_WHATSAPP_URL || null,
  },

  // تسجيل الدخول/التسجيل عبر حساب Google (Google Identity Services) من الموقع.
  // خذ الـ Client ID من https://console.cloud.google.com/apis/credentials (نوع "Web application").
  // بدونه، صفحات /login.html و /signup.html تعرض رسالة توضح أن الميزة غير مفعّلة بعد.
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || null,
  },

  // إرسال الإيميلات (تأكيد، إشعارات) عبر Resend: https://resend.com/api-keys
  // اختياري حاليًا - إذا تُرك فارغًا، النظام يشتغل عادي بدون إرسال إيميلات.
  resend: {
    apiKey: process.env.RESEND_API_KEY || null,
    fromEmail: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
  },

  // مفتاح توقيع جلسات الموقع (websiteUsers) - غيّره لقيمة عشوائية طويلة في .env للإنتاج.
  webSessionSecret: process.env.WEB_SESSION_SECRET || 'dev-only-insecure-secret-change-me',
};

module.exports = { env, validateEnv };
