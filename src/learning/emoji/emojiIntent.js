// emojiIntent: يفهم الإيموجيات كإشارة نية بحد ذاتها، حتى لو الزبون ما كتبش أي كلمة.
// مثال: زبون يكتب فقط "🚚❓" -> نفهم أنه يسأل عن التوصيل بلا أي نص.
//
// وحدة مستقلة تمامًا (لا تعرف شيئًا عن Firestore ولا عن باقي النظام) حتى يسهل إضافة
// إيموجيات جديدة أو تعديل معانيها بلا خطر على أي وحدة أخرى.

// كل إيموجي مربوط بـ: معنى مقروء للبشر (يُستعمل فـ الإحصائيات/اللوقات) + نية (Intent) مقابلة
// إذا وُجدت فـ نظام النوايا (intentResolver). بعض الإيموجيات (مثل 😡 أو 😍) ماعندهاش نية
// تقنية بل مؤشر عاطفي (Sentiment) يُستعمل لاحقًا (مثلاً لتنبيه التاجر أن الزبون غاضب).
const EMOJI_MAP = {
  '💰': { meaning: 'السعر', intent: 'price' },
  '💵': { meaning: 'السعر', intent: 'price' },
  '🚚': { meaning: 'التوصيل', intent: 'delivery' },
  '📦': { meaning: 'الطلب', intent: 'buy' },
  '📍': { meaning: 'العنوان', intent: null },
  '📞': { meaning: 'رقم الهاتف', intent: null },
  '⏰': { meaning: 'الوقت', intent: 'delivery' },
  '❌': { meaning: 'رفض', intent: null, sentiment: 'negative' },
  '✅': { meaning: 'موافقة', intent: null, sentiment: 'positive' },
  '🤔': { meaning: 'تردد', intent: null, sentiment: 'hesitant' },
  '😡': { meaning: 'عميل غاضب', intent: null, sentiment: 'angry' },
  '🤬': { meaning: 'عميل غاضب', intent: null, sentiment: 'angry' },
  '😍': { meaning: 'أعجبه المنتج', intent: null, sentiment: 'positive' },
  '❤️': { meaning: 'أعجبه المنتج', intent: null, sentiment: 'positive' },
  '🙂': { meaning: 'ترحيب أو رضا', intent: 'greeting', sentiment: 'positive' },
  '😊': { meaning: 'ترحيب أو رضا', intent: 'greeting', sentiment: 'positive' },
  '👋': { meaning: 'ترحيب', intent: 'greeting' },
  '❓': { meaning: 'سؤال', intent: null },
  '❔': { meaning: 'سؤال', intent: null },
};

// يفصل رموز الإيموجي عن باقي النص (اعتمادًا على مدى Unicode الخاص بالرموز التعبيرية)
const EMOJI_REGEX = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u2753\u2754]/gu;

function extractEmojis(text) {
  if (!text) return [];
  return text.match(EMOJI_REGEX) || [];
}

/**
 * يحلل الإيموجيات الموجودة فـ رسالة ويرجع أفضل نية مقترحة (إن وُجدت) + قائمة المعاني.
 * @param {string} text
 * @returns {{ intent: string|null, sentiment: string|null, meanings: string[], emojis: string[] }}
 */
function analyzeEmojis(text) {
  const emojis = extractEmojis(text);
  if (!emojis.length) return { intent: null, sentiment: null, meanings: [], emojis: [] };

  const meanings = [];
  let intent = null;
  let sentiment = null;

  for (const emoji of emojis) {
    const info = EMOJI_MAP[emoji];
    if (!info) continue;
    meanings.push(info.meaning);
    if (!intent && info.intent) intent = info.intent;
    if (!sentiment && info.sentiment) sentiment = info.sentiment;
  }

  return { intent, sentiment, meanings: [...new Set(meanings)], emojis };
}

// يزيل الإيموجيات من النص (مفيد لو حبينا نمرر النص "الصافي" لباقي مراحل التحليل)
function stripEmojis(text) {
  return (text || '').replace(EMOJI_REGEX, '').trim();
}

module.exports = { analyzeEmojis, extractEmojis, stripEmojis, EMOJI_MAP };
