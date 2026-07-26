// تعريف مركزي لكل باقات الاشتراك. أي تعديل على الأسعار/الحدود/المميزات يكون من هنا فقط.
// 5 باقات: مجانية + 4 مدفوعة. الأسعار بالدينار الجزائري (DZD) شهريًا.
// الأسعار مبنية على تقدير "أعلى من متوسط السوق الجزائري لأدوات SaaS الصغيرة بحوالي 10%"،
// وهي نقطة انطلاق يمكنك تعديلها من هنا بعد ما تختبر السوق (لا يوجد مرجع رسمي ثابت).

const PLANS = {
  free: {
    id: 'free',
    name: 'المجانية',
    price: 0, // DZD/شهر
    durationDays: 30,
    messageLimit: 60,
    productLimit: 5,
    features: {
      textReply: true,
      imageRecognition: false,
      voiceReply: false,
      fullAnalytics: false,
      advancedAnalytics: false,
      abandonedCartRecovery: false,
      coupons: false,
      staffAccounts: false,
      merchantVoiceNotes: false, // رسائل صوتية يسجلها التاجر (منتج/تحية...) - راجع src/voiceNotes/README.md
      prioritySupport: false,
      dedicatedSupport: false,
      apiAccess: false,
      advancedPermissions: false,
      deliveryIntegration: false,
      aiAdvisor: false,
      excelExportAdvanced: false,
      broadcast: false,
      backup: false,
    },
    tagline: 'للتجربة والانطلاقة الأولى، بدون أي ميزة مدفوعة',
  },
  // ===== Starter — مناسبة للمتاجر الصغيرة =====
  starter: {
    id: 'starter',
    name: 'Starter',
    price: 2900,
    durationDays: 30,
    messageLimit: 1000,
    productLimit: 50,
    features: {
      textReply: true, // الرد النصي
      imageRecognition: false,
      voiceReply: false,
      fullAnalytics: false,
      advancedAnalytics: false,
      abandonedCartRecovery: false,
      coupons: false,
      staffAccounts: false,
      merchantVoiceNotes: false,
      prioritySupport: false,
      dedicatedSupport: false,
      apiAccess: false,
      advancedPermissions: false,
      basicAI: true, // الذكاء الاصطناعي الأساسي
      facebookConnect: true, // ربط Facebook
      basicReports: true, // تقارير أساسية
      deliveryIntegration: false,
      aiAdvisor: false,
      excelExportAdvanced: false,
      broadcast: false,
      backup: false,
    },
    tagline: 'مناسبة للمتاجر الصغيرة',
  },
  // ===== Growth — للمتاجر النشطة =====
  growth: {
    id: 'growth',
    name: 'Growth',
    price: 5900,
    durationDays: 30,
    messageLimit: 10000,
    productLimit: 500,
    features: {
      textReply: true,
      imageRecognition: true, // تحليل الصور
      voiceReply: true, // الردود الصوتية
      fullAnalytics: false,
      advancedAnalytics: true, // تحليلات متقدمة
      abandonedCartRecovery: true, // سلات متروكة
      coupons: true, // كوبونات
      staffAccounts: false,
      merchantVoiceNotes: false,
      prioritySupport: false,
      dedicatedSupport: false,
      apiAccess: false,
      advancedPermissions: false,
      basicAI: true,
      fullAI: true, // ذكاء اصطناعي كامل
      facebookConnect: true,
      basicReports: true,
      deliveryIntegration: true, // تكامل شركات التوصيل (Yalidine...)
      aiAdvisor: true, // مساعد الذكاء الاصطناعي للتاجر
      excelExportAdvanced: true, // تصدير Excel بفلاتر متقدمة
      broadcast: false,
      backup: false,
    },
    tagline: 'للمتاجر النشطة',
    recommended: true,
  },
  // ===== Pro — للمتاجر الكبيرة =====
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 9900,
    durationDays: 30,
    messageLimit: null, // غير محدود
    productLimit: null, // غير محدود
    features: {
      textReply: true,
      imageRecognition: true,
      voiceReply: true,
      fullAnalytics: true, // جميع التحليلات
      advancedAnalytics: true,
      abandonedCartRecovery: true,
      coupons: true,
      staffAccounts: true, // موظفون متعددون
      merchantVoiceNotes: true, // جميع الرسائل الصوتية
      prioritySupport: true, // دعم أولوية
      dedicatedSupport: false,
      apiAccess: false,
      advancedPermissions: false,
      basicAI: true,
      fullAI: true,
      facebookConnect: true,
      basicReports: true,
      fullReports: true, // جميع التقارير
      deliveryIntegration: true,
      aiAdvisor: true,
      excelExportAdvanced: true,
      broadcast: true, // البث الجماعي
      backup: true, // نسخ احتياطي يدوي + تلقائي
    },
    tagline: 'للمتاجر الكبيرة',
  },
  // ===== Enterprise — للشركات (المعرف الداخلي "business" محفوظ لتوافق البيانات القديمة) =====
  business: {
    id: 'business',
    name: 'Enterprise',
    price: 16900,
    durationDays: 30,
    messageLimit: null, // غير محدود
    productLimit: null, // غير محدود
    features: {
      textReply: true,
      imageRecognition: true,
      voiceReply: true,
      fullAnalytics: true,
      advancedAnalytics: true,
      abandonedCartRecovery: true,
      coupons: true,
      staffAccounts: true,
      merchantVoiceNotes: true,
      prioritySupport: true,
      dedicatedSupport: true, // دعم خاص
      apiAccess: true, // API
      advancedPermissions: true, // صلاحيات متقدمة
      autoFutureFeatures: true, // ميزات مستقبلية تلقائيًا
      basicAI: true,
      fullAI: true,
      facebookConnect: true,
      basicReports: true,
      fullReports: true,
      deliveryIntegration: true,
      aiAdvisor: true,
      excelExportAdvanced: true,
      broadcast: true,
      backup: true,
    },
    tagline: 'للشركات — كل شيء غير محدود',
  },
};

// الترتيب المعروض في الموقع وفي بوت السوبر أدمن
const PLAN_ORDER = ['free', 'starter', 'growth', 'pro', 'business'];

// الباقات المدفوعة المعروضة في صفحة الاشتراك (بلا الباقة المجانية - لا تُباع، تُمنح تلقائيًا للمتاجر الجديدة من الموقع)
const PAID_PLAN_ORDER = ['starter', 'growth', 'pro', 'business'];

// نسبة خصم أول عملية شراء مدفوعة (لا تُطبّق على الباقة المجانية ولا تُطبّق إلا مرة واحدة لكل متجر)
const FIRST_PURCHASE_DISCOUNT_PERCENT = Number(process.env.FIRST_PURCHASE_DISCOUNT_PERCENT || 30);

function getPlan(planId) {
  return PLANS[planId] || null;
}

// يحسب السعر النهائي لباقة معينة، مع تطبيق خصم أول عملية شراء إذا كان الزبون مؤهلاً له
function computePrice(planId, { isFirstPurchase = false } = {}) {
  const plan = getPlan(planId);
  if (!plan) return null;
  const base = plan.price;
  if (base === 0) return { base, discountPercent: 0, final: 0 };
  const discountPercent = isFirstPurchase ? FIRST_PURCHASE_DISCOUNT_PERCENT : 0;
  const final = Math.round(base * (1 - discountPercent / 100));
  return { base, discountPercent, final };
}

// يبني كائن باقة "مخصصة" من مدخلات حرة (السوبر أدمن يحددها بنفسه من بوت التيليغرام الخاص به فقط)
function buildCustomPlan({
  messageLimit,
  productLimit,
  durationDays,
  voiceReply,
  imageRecognition,
  fullAnalytics,
  price,
  merchantVoiceNotes,
}) {
  return {
    id: 'custom',
    name: 'مخصصة',
    price: Number(price) || 0,
    durationDays: durationDays && durationDays > 0 ? durationDays : 30,
    messageLimit: messageLimit === null ? null : Number(messageLimit) || 0,
    productLimit: productLimit === null ? null : Number(productLimit) || 0,
    features: {
      textReply: true,
      imageRecognition: Boolean(imageRecognition),
      voiceReply: Boolean(voiceReply),
      fullAnalytics: Boolean(fullAnalytics),
      abandonedCartRecovery: Boolean(fullAnalytics),
      staffAccounts: Boolean(fullAnalytics),
      merchantVoiceNotes: Boolean(merchantVoiceNotes),
    },
  };
}

module.exports = {
  PLANS,
  PLAN_ORDER,
  PAID_PLAN_ORDER,
  FIRST_PURCHASE_DISCOUNT_PERCENT,
  getPlan,
  computePrice,
  buildCustomPlan,
};
