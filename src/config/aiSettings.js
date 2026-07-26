// إعدادات "مساعد الذكاء الاصطناعي" الافتراضية لكل متجر (المتطلبات #7 #8 #14 #15 #16).
// تُحفظ فعليًا تحت store.aiSettings (StoreRepository.updateAISettings) وتُدمج مع هذا الكائن
// الافتراضي عند القراءة، حتى لا تحتاج كل المتاجر القديمة إلى migration فوري.

const REPLY_MODE = {
  SMART: 'smart', // نص للنص، صوت للصوت
  ALWAYS_TEXT: 'always_text', // نص دائمًا مهما كان نوع رسالة الزبون
  ALWAYS_VOICE: 'always_voice', // صوت دائمًا مهما كان نوع رسالة الزبون
  CUSTOM: 'custom', // التاجر يحدد لكل حالة (نص/صوت) شكل الرد (نص و/أو صوت)
};

const VOICE_GENDER = { MALE: 'male', FEMALE: 'female' };

const AI_TONE = { FRIENDLY: 'friendly', FORMAL: 'formal', PROFESSIONAL: 'professional', CONCISE: 'concise' };

const DEFAULT_AI_SETTINGS = {
  enabled: true,
  language: 'ar', // العربية/الدارجة الجزائرية
  tone: AI_TONE.FRIENDLY,
  replyMode: REPLY_MODE.SMART,
  // تُستعمل فقط إذا replyMode === CUSTOM: لكل نوع رسالة واردة (نص/صوت)، أي أشكال رد نرسل
  customReplyMap: {
    textIn: { text: true, voice: false },
    voiceIn: { text: false, voice: true },
  },
  voiceGender: VOICE_GENDER.MALE,
  maxReplyLength: 400, // عدد الأحرف التقريبي الأقصى للرد
  speed: 1.0, // سرعة الصوت المولّد (0.5 - 2.0)
  imageAnalysisEnabled: true,
  voiceUnderstandingEnabled: true,
  learnFromStoreData: true,
  autoSuggestProducts: true,
};

function mergeWithDefaults(saved = {}) {
  return {
    ...DEFAULT_AI_SETTINGS,
    ...saved,
    customReplyMap: {
      textIn: { ...DEFAULT_AI_SETTINGS.customReplyMap.textIn, ...(saved.customReplyMap?.textIn || {}) },
      voiceIn: { ...DEFAULT_AI_SETTINGS.customReplyMap.voiceIn, ...(saved.customReplyMap?.voiceIn || {}) },
    },
  };
}

module.exports = { REPLY_MODE, VOICE_GENDER, AI_TONE, DEFAULT_AI_SETTINGS, mergeWithDefaults };
