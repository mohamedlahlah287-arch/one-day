// decisionEngine.js
// -----------------------------------------------------------------------------------
// محرك اتخاذ القرار لنظام الردود الصوتية الذكي (البند السادس فـ المتطلبات). قبل إرسال
// أي رسالة صوتية عامة (مرتبطة بنية، وليست خاصة بمنتج معيّن)، يمرّ القرار بهذا التسلسل:
//
//   ١- تحليل الرسالة (النية + المنتج المذكور فيها إن وُجد) -> يتم قبل استدعاء هذا المحرك
//      (راجع catalogController: مطابقة اسم/رابط المنتج أولًا، ثم learning.intentResolver)
//   ٢- استخراج Intent                    -> resolution.intent
//   ٣- استخراج المنتج (من الرسالة أو من سياق المحادثة/آخر منتج شافه الزبون)
//   ٤- استخراج أي معلومات إضافية        -> (مطابقة اسم منتج تُعالَج قبل الوصول هنا)
//   ٥- البحث عن الرسالة المناسبة        -> VoiceNoteService.getForIntent
//   ٦- التحقق من شروط التشغيل           -> VoiceNoteService.getConditionsForIntent
//
// إذا تحقق الشرط (لا يحتاج منتج، أو المنتج معروف): يشغّل الصوت إن وُجد.
// إذا لم يتحقق (يحتاج منتج ولم يُعرف): يشغّل الفعل البديل المضبوط من التاجر (سؤال
// توضيحي/رسالة نصية/تجاهل) - هذا بالضبط ما يمنع الخلل الأصلي: تشغيل صوت سعر منتج
// عشوائي على سؤال عام مثل "بكم؟" بلا أي منتج مذكور.
// -----------------------------------------------------------------------------------

const VoiceNoteService = require('../voiceNotes/VoiceNoteService');
const { GENERIC_ASK_TEXT } = require('./voiceConditions');

/**
 * @param {string|number} storeId
 * @param {string} intentKey
 * @param {{ hasProduct: boolean }} ctx - هل المنتج معروف (من الرسالة أو من سياق المحادثة)
 * @returns {Promise<
 *   { action: 'voice', url: string } |
 *   { action: 'text'|'ask', text: string } |
 *   { action: 'none' }
 * >}
 */
async function decide(storeId, intentKey, { hasProduct = false } = {}) {
  if (!intentKey || intentKey === 'unknown') return { action: 'none' };

  const conditions = await VoiceNoteService.getConditionsForIntent(storeId, intentKey);

  // الشرط الأساسي: هل هذه النية تتطلب معرفة منتج محدد؟
  if (!conditions.requiresProduct || hasProduct) {
    const voiceNote = await VoiceNoteService.getForIntent(storeId, intentKey);
    return voiceNote ? { action: 'voice', url: voiceNote.url } : { action: 'none' };
  }

  // تحتاج منتج ولم يُعرف -> لا تشغيل صوت إطلاقًا، فقط الفعل البديل المضبوط
  switch (conditions.noProductAction) {
    case 'text':
      return { action: 'text', text: conditions.noProductText || GENERIC_ASK_TEXT };
    case 'none':
      return { action: 'none' };
    case 'ask':
    default:
      return { action: 'ask', text: conditions.noProductText || GENERIC_ASK_TEXT };
  }
}

module.exports = { decide };
