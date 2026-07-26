// textNormalizer: أول محطة تمر منها أي رسالة زبون قبل أي تحليل آخر (نية، قاموس، AI...).
// الهدف: تحويل الرسالة لشكل "قياسي" بلا ما نغيّر معناها، حتى تصير المطابقة (كلمات مفتاحية،
// قاموس المتجر، الحوادث المحفوظة) أدق بكثير - زبون كتب "هلاااا" أو "هلا" لازم يُفهما بنفس الطريقة.
//
// هذا الملف مستقل بذاته (وحدة واحدة مسؤولة عن شيء واحد) حتى يسهل تحسينه لاحقًا
// (مثلاً ربطه بمكتبة تصحيح إملائي حقيقية) بلا التأثير على باقي نظام التعلّم.

// خرائط توحيد الحروف العربية المتشابهة شكلاً - النطق مختلف قليلاً أحيانًا لكن القصد نفسه
// فـ لهجة الدردشة (سرعة الكتابة على الهاتف تخلي الناس يخلطو بينها كثيرًا).
const LETTER_UNIFICATION = [
  [/[أإآا]/g, 'ا'],
  [/ة/g, 'ه'],
  [/[يى]/g, 'ي'],
  [/ؤ/g, 'و'],
  [/ئ/g, 'ي'],
  [/[ًٌٍَُِّْـ]/g, ''], // التشكيل + التطويل (kashida)
];

// إزالة تكرار الأحرف: "هلاااا" -> "هلا"، "مررررحبا" -> "مرحبا".
// نبقي حرفين متتاليين كحد أقصى لأن بعض الكلمات العربية الصحيحة فيها تكرار طبيعي (مثال: "درر"،
// "ممكن" فيها ميمين) - تقليصها لحرف واحد فقط يكسر كلمات صحيحة. تقليصها لحرفين أأمن وكافٍ
// لتوحيد "هلاااا" (٥ ألفات) مع "هلا" (ألف واحد) بعد خطوة إضافية أدناه.
function collapseRepeatedChars(text) {
  // أولاً: أي حرف مكرر أكثر من مرتين -> يُختصر لمرتين (حماية من كسر كلمات مضاعفة صحيحة)
  let collapsed = text.replace(/(.)\1{2,}/g, '$1$1');
  // ثانياً: إذا تكرر الحرف مرتين تحديدًا وهو ليس من الحروف اللي تتكرر طبيعيًا فـ العربية
  // (مثل الحروف المضاعفة بشدّة)، نختصره لمرة وحدة - هذا يغطي أغلب حالات المبالغة فـ الكتابة.
  collapsed = collapsed.replace(/([اوهيرحبمنتشكعقصضطظغخذزفلجدثذؤئء])\1/g, '$1');
  return collapsed;
}

// إزالة المسافات الزائدة (بداية/نهاية/متعددة فـ الوسط) وتوحيد أسطر متعددة لمسافة واحدة
function collapseWhitespace(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function unifyArabicLetters(text) {
  return LETTER_UNIFICATION.reduce((acc, [pattern, replacement]) => acc.replace(pattern, replacement), text);
}

// قاموس تصحيحات إملائية شائعة جدًا (أخطاء متكررة بكثرة عند الزبائن) - يُستعمل كخط دفاع بسيط
// بلا الحاجة لمكتبة تصحيح إملائي كاملة. القاموس قابل للتوسع بسهولة (مصفوفة [خطأ, صحيح]).
const COMMON_TYPOS = [
  [/^شلام/, 'سلام'],
  [/الشلام/g, 'السلام'],
  [/عندكمم+/g, 'عندكم'],
  [/الووو+/g, 'الو'],
];

function fixCommonTypos(text) {
  return COMMON_TYPOS.reduce((acc, [pattern, replacement]) => acc.replace(pattern, replacement), text);
}

/**
 * ينظّف وينظّم رسالة زبون خام، بالترتيب:
 * 1) trim + توحيد المسافات
 * 2) تصغير الأحرف اللاتينية (لو موجودة، مثال "OK" -> "ok")
 * 3) اختصار تكرار الأحرف
 * 4) توحيد الحروف العربية المتشابهة
 * 5) تصحيح أخطاء إملائية شائعة معروفة
 *
 * @param {string} rawText - نص الرسالة كما وصل من الزبون
 * @returns {{ normalized: string, original: string }}
 */
function normalizeMessage(rawText) {
  const original = rawText || '';
  let text = original.trim().toLowerCase();
  text = collapseWhitespace(text);
  text = collapseRepeatedChars(text);
  text = unifyArabicLetters(text);
  text = fixCommonTypos(text);
  text = collapseWhitespace(text);
  return { normalized: text, original };
}

// مسافة ليفنشتاين (Levenshtein distance) - بلا مكتبات خارجية، تُستعمل لفهم كلمات مكتوبة
// بشكل خاطئ بحرف أو حرفين (مثال: "لااام" قريبة من "سلام" لو حذفنا فرقًا بسيطًا).
function levenshteinDistance(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const prevRow = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const currRow = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currRow[j] = Math.min(
        currRow[j - 1] + 1, // إدراج
        prevRow[j] + 1, // حذف
        prevRow[j - 1] + cost // استبدال
      );
    }
    prevRow.splice(0, prevRow.length, ...currRow);
  }
  return prevRow[b.length];
}

// يتحقق إذا كانت كلمتان "قريبتان بما يكفي" (خطأ إملائي محتمل بحرف أو حرفين) بدل خطأ حقيقي
// فـ المعنى. الحد الأقصى للمسافة يتناسب مع طول الكلمة (كلمة قصيرة تحتمل خطأ أقل).
function isFuzzyMatch(wordA, wordB, { maxDistanceRatio = 0.34 } = {}) {
  if (!wordA || !wordB) return false;
  const maxLen = Math.max(wordA.length, wordB.length);
  if (maxLen < 3) return wordA === wordB; // كلمات قصيرة جدًا: نطابق حرفيًا فقط لتفادي إيجابيات خاطئة
  const allowedDistance = Math.max(1, Math.floor(maxLen * maxDistanceRatio));
  return levenshteinDistance(wordA, wordB) <= allowedDistance;
}

module.exports = {
  normalizeMessage,
  collapseRepeatedChars,
  unifyArabicLetters,
  levenshteinDistance,
  isFuzzyMatch,
};
