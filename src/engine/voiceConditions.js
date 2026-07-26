// voiceConditions.js
// -----------------------------------------------------------------------------------
// "شروط التشغيل" الافتراضية لكل نية (Intent) - جزء من نظام الردود الصوتية الذكي:
// هل الرسالة الصوتية العامة لهذه النية تحتاج معرفة منتج محدد قبل ما تنطلق؟ وإذا احتاجت
// ولم يُعرف المنتج، شنو الفعل البديل الافتراضي (سؤال توضيحي / رسالة نصية / تجاهل)؟
//
// التاجر يقدر يبدّل هذي الإعدادات لكل نية من لوحة التحكم (تُخزَّن فوق هذي الافتراضيات
// فـ حقل conditions بوثيقة stores/{id}/voiceNotes/{intentKey} - راجع VoiceNoteRepository
// و VoiceNoteService.getConditionsForIntent/setConditionsForIntent).
//
// قابلية التوسع (البند التاسع فـ المتطلبات): لإضافة نية مستقبلية (دفع، استبدال، إرجاع،
// مدة التوصيل، عروض، تخفيضات، مخزون، هدايا، كوبونات، طرق دفع، سياسة المتجر...) يكفي:
//   1) إضافة كلماتها المفتاحية فـ src/engine/responseEngine.js (INTENTS)
//   2) إضافة تسميتها العربية فـ src/ui/voiceNoteKeyboards.js (INTENT_LABELS_AR)
//   3) إضافة سطر افتراضي هنا (اختياري - إن لم تُضَف تُعامَل كنية لا تحتاج منتج)
// بلا أي تعديل فـ محرك اتخاذ القرار (decisionEngine.js) نفسه ولا فـ catalogController.
// -----------------------------------------------------------------------------------

// الأفعال المسموحة عندما تحتاج النية منتجًا ولم يُعرف
const NO_PRODUCT_ACTIONS = ['ask', 'text', 'none'];

// افتراضيات كل نية معروفة حاليًا فـ engine.INTENTS
const DEFAULT_CONDITIONS = {
  // نوايا تحتاج معرفة منتج محدد قبل تشغيل صوت (وإلا سؤال توضيحي افتراضيًا)
  price: { requiresProduct: true, noProductAction: 'ask', noProductText: null },
  warranty: { requiresProduct: true, noProductAction: 'ask', noProductText: null },
  colors: { requiresProduct: true, noProductAction: 'ask', noProductText: null },
  compare: { requiresProduct: true, noProductAction: 'ask', noProductText: null },

  // نوايا عامة لا تحتاج منتج محدد
  buy: { requiresProduct: false, noProductAction: 'none', noProductText: null },
  delivery: { requiresProduct: false, noProductAction: 'none', noProductText: null },
  greeting: { requiresProduct: false, noProductAction: 'none', noProductText: null },
};

// أي نية غير مدرجة أعلاه (مستقبلية) تُعامَل كنية عامة لا تحتاج منتج، إلى أن يضيف
// التاجر/المطوّر افتراضًا صريحًا لها هنا أو يبدّل الإعداد من لوحة التحكم.
const FALLBACK_DEFAULT = { requiresProduct: false, noProductAction: 'none', noProductText: null };

function defaultConditionsFor(intentKey) {
  return { ...(DEFAULT_CONDITIONS[intentKey] || FALLBACK_DEFAULT) };
}

// يدمج شروطًا مخزَّنة (قد تكون جزئية) فوق الافتراضيات - يُستعمل عند القراءة من Firestore
function mergeConditions(intentKey, stored) {
  return { ...defaultConditionsFor(intentKey), ...(stored || {}) };
}

// نص السؤال التوضيحي الافتراضي (البند الثالث فـ المتطلبات) عندما النية تحتاج منتج ولم يُعرف
const GENERIC_ASK_TEXT = 'أي منتج تقصد بالضبط؟ اكتب اسمه حتى نقدر نعاونك 🙏';

module.exports = {
  DEFAULT_CONDITIONS,
  NO_PRODUCT_ACTIONS,
  FALLBACK_DEFAULT,
  GENERIC_ASK_TEXT,
  defaultConditionsFor,
  mergeConditions,
};
