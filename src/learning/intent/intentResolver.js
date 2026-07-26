// intentResolver: "المرحلة الوسطى" الكاملة بين رسالة الزبون الخام واستدعاء الذكاء الاصطناعي.
// يطبّق بالضبط المراحل المطلوبة (البند الثاني عشر فـ المتطلبات):
//   1) تنظيف الرسالة              -> textNormalizer
//   2) تصحيح أخطاء بسيطة          -> textNormalizer (typos) + fuzzy matching هنا
//   3) تحليل الإيموجيات           -> emojiIntent
//   4) تحويل الرسالة لِ Intent    -> fuzzy keyword matching (يبني فوق engine.INTENTS)
//   5) ذاكرة المتجر               -> (تُستهلك لاحقًا كسياق أسلوب، وليس كمصدر رد مباشر)
//   6) قاموس المتجر               -> StoreDictionaryService
//   7) قرارات التاجر              -> DecisionService
//   8) الردود السابقة             -> findSimilarPastReply (أدناه)
//   9) إن لم يُحسم شيء            -> الاستدعاء يرجع resolved:false ليقرر المستدعي اللجوء لـ AI
//
// هذا الملف "منسّق" (orchestrator) فقط - كل خطوة فعلية تعيش فـ وحدتها الخاصة، تمامًا
// كما طُلب (Modular)، حتى يمكن تعديل أي خطوة لوحدها بلا التأثير على البقية.

const { normalizeMessage, isFuzzyMatch } = require('../normalization/textNormalizer');
const { analyzeEmojis, stripEmojis } = require('../emoji/emojiIntent');
const StoreDictionaryService = require('../dictionary/StoreDictionaryService');
const DecisionService = require('../decisions/DecisionService');
const TrainingExampleRepository = require('../training/TrainingExampleRepository');
const engine = require('../../engine/responseEngine');

// حد أدنى للتشابه حتى نستعمل ردًا سابقًا معدَّلًا من التاجر لسؤال جديد شبه مطابق
const PREVIOUS_REPLY_SIMILARITY_THRESHOLD = 0.72;

// يبحث عن نية مطابقة تقريبيًا (fuzzy) بين كلمات الرسالة وكلمات engine.INTENTS - يغطي حالات
// مثل "الشلام عليكم" أو "لااام" (بعد التطبيع) القريبة من "سلام" بحرف أو حرفين اختلاف.
function detectFuzzyIntent(normalizedMessage) {
  const words = normalizedMessage.split(/\s+/);
  for (const [intentKey, keywords] of Object.entries(engine.INTENTS)) {
    for (const keyword of keywords) {
      const normalizedKeyword = normalizeMessage(keyword).normalized;
      if (!normalizedKeyword) continue;
      // مطابقة الكلمة المفتاحية كاملة (قد تكون أكثر من كلمة) كنص فرعي تقريبي
      if (normalizedKeyword.includes(' ')) continue; // العبارات المركبة تُترك لـ engine.detectIntent (مطابقة تامة أدق)
      for (const word of words) {
        if (isFuzzyMatch(word, normalizedKeyword)) return intentKey;
      }
    }
  }
  return 'unknown';
}

// يبحث فـ أمثلة التدريب المحفوظة (تعديلات التاجر السابقة) عن سؤال شبيه جدًا بالسؤال الحالي.
// إن وُجد، نعيد استعمال نفس الرد النهائي الذي اعتمده التاجر - هذا بالضبط ما يجعل "البوت
// يكتب بنفس أسلوب التاجر" بعد تكرار كافٍ لنفس السؤال (البند الثاني فـ المتطلبات).
async function findSimilarPastReply(storeId, normalizedMessage) {
  const examples = await TrainingExampleRepository.findRecent(storeId, 200);
  const edited = examples.filter((e) => e.wasEdited && e.finalReply);
  if (!edited.length) return null;

  let best = null;
  let bestScore = 0;
  for (const example of edited) {
    const { normalized } = normalizeMessage(example.customerMessage || '');
    const score = DecisionService.constructor.wordSimilarity(normalizedMessage, normalized);
    if (score > bestScore) {
      bestScore = score;
      best = example;
    }
  }
  if (best && bestScore >= PREVIOUS_REPLY_SIMILARITY_THRESHOLD) return best;
  return null;
}

/**
 * يحلل رسالة زبون خام عبر كامل خط أنابيب التعلّم قبل اللجوء للذكاء الاصطناعي.
 * @param {string|number} storeId
 * @param {string} rawMessage
 * @returns {Promise<{
 *   normalized: string,
 *   emoji: { intent: string|null, sentiment: string|null, meanings: string[] },
 *   intent: string,
 *   resolved: boolean,
 *   reply: string|null,
 *   source: 'decision'|'previous_reply'|'dictionary'|'keyword'|'emoji'|null,
 *   meta: object
 * }>}
 */
async function resolve(storeId, rawMessage) {
  // 1) تنظيف + 2) تصحيح أخطاء بسيطة
  const { normalized } = normalizeMessage(stripEmojis(rawMessage));

  // 3) تحليل الإيموجيات (على النص الأصلي، قبل حذفها)
  const emoji = analyzeEmojis(rawMessage);

  // 7) قرارات التاجر - أولوية عالية لأنها "حقيقة ثابتة" حددها التاجر بنفسه لسؤال مطابق تقريبًا
  const decision = await DecisionService.findMatchingDecision(storeId, normalized);
  if (decision) {
    return {
      normalized,
      emoji,
      intent: decision.questionType || 'unknown',
      resolved: true,
      reply: decision.decisionText,
      source: 'decision',
      meta: { decisionId: decision.id },
    };
  }

  // 8) ردود سابقة عدّلها التاجر لسؤال شبيه جدًا
  const pastReply = await findSimilarPastReply(storeId, normalized);
  if (pastReply) {
    return {
      normalized,
      emoji,
      intent: pastReply.questionType || 'unknown',
      resolved: true,
      reply: pastReply.finalReply,
      source: 'previous_reply',
      meta: { exampleId: pastReply.id },
    };
  }

  // 4) نية عبر كلمات مفتاحية (تامة ثم تقريبية) - بلا رد جاهز، فقط تصنيف يُستعمل من المستدعي
  let intent = engine.detectIntent(normalized);
  let source = intent !== 'unknown' ? 'keyword' : null;

  if (intent === 'unknown') {
    intent = detectFuzzyIntent(normalized);
    if (intent !== 'unknown') source = 'keyword_fuzzy';
  }

  // 6) قاموس المتجر - كلمات محلية خاصة بعملاء هذا المتجر
  if (intent === 'unknown') {
    const dictionaryMatch = await StoreDictionaryService.lookup(storeId, normalized);
    if (dictionaryMatch?.intent) {
      intent = dictionaryMatch.intent;
      source = 'dictionary';
    }
  }

  // إشارة الإيموجي كخط دفاع أخير قبل تسليم الأمر لـ AI (زبون بعث إيموجي بلا كلمات)
  if (intent === 'unknown' && emoji.intent) {
    intent = emoji.intent;
    source = 'emoji';
  }

  // 9) لا حسم كامل (بلا رد جاهز) - نرجع النية المكتشفة (قد تكون unknown) ليقرر المستدعي:
  // إما يبني ردًا من قالب جاهز (switch حسب intent)، أو يستدعي AI كخط دفاع أخير.
  return { normalized, emoji, intent, resolved: false, reply: null, source, meta: {} };
}

module.exports = { resolve, detectFuzzyIntent, findSimilarPastReply };
