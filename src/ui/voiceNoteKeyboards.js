const { Markup } = require('telegraf');
const { INTENT_KEYS } = require('../engine/responseEngine');

// تسميات عربية مقروءة لكل نية (مفاتيح engine.INTENTS) - تُستعمل فـ لوحة اختيار "أي رسالة
// صوتية تحب تسجّل؟" وفـ عرض قائمة الرسائل الصوتية المسجَّلة مسبقًا.
const INTENT_LABELS_AR = {
  greeting: '👋 التحية',
  price: '💰 السعر',
  buy: '🛒 الشراء/الطلب',
  delivery: '🚚 التوصيل',
  warranty: '🛡️ الضمان',
  colors: '🎨 الألوان',
  compare: '⚖️ المقارنة بين المنتجات',
};

// لوحة أزرار Inline لاختيار نية واحدة - callback_data بصيغة voice_intent:<key>
function voiceIntentKeyboard() {
  const buttons = INTENT_KEYS.map((key) => [
    Markup.button.callback(INTENT_LABELS_AR[key] || key, `voice_intent:${key}`),
  ]);
  return Markup.inlineKeyboard(buttons);
}

// لوحة أزرار Inline لاختيار "شروط التشغيل" (الفعل البديل إذا لم يُعرف المنتج) - تظهر بعد
// حفظ/حذف رسالة صوتية لنية تتطلب معرفة منتج (سعر، ضمان، ألوان، مقارنة...). callback_data
// بصيغة voice_cond:<intentKey>:<ask|text|none>
function voiceConditionKeyboard(intentKey) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('❓ اسأل عن المنتج', `voice_cond:${intentKey}:ask`)],
    [Markup.button.callback('✏️ رسالة نصية', `voice_cond:${intentKey}:text`)],
    [Markup.button.callback('🚫 لا ترسل شيئًا', `voice_cond:${intentKey}:none`)],
  ]);
}

module.exports = { voiceIntentKeyboard, voiceConditionKeyboard, INTENT_LABELS_AR };
