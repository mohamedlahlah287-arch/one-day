// محرك بسيط لفهم نية الزبون بناءً على كلمات مفتاحية (بلا AI خارجي، سريع ومجاني)

const INTENTS = {
  // "بشحال" و"شحال" و"قداش" وتفرعاتها هي أكثر طريقة يسقسي بيها الجزائري على السعر
  price: [
    'بشحال',
    'شحال',
    'قداش',
    'بقداش',
    'قداه',
    'بقداه',
    'بكم',
    'السومة',
    'الثمن',
    'ثمنه',
    'تمنه',
    'يسوى',
    'يسوا',
    'سعر',
    'ثمن',
    'price',
  ],
  buy: [
    'نشري',
    'نطلب',
    'اطلب',
    'اطلبها',
    'اطلبه',
    'الطلب',
    'طلبية',
    'شراء',
    'اشتري',
    'اشريها',
    'نحب نشري',
    'نبغي',
    'نبغيها',
    'بغيت',
    'بغيتها',
    'نجيب',
    'حاب نشري',
    'حابة نشري',
    'حاب ندي',
    'حابة ندي',
    'نديه',
    'نديها',
    'نحوس نشري',
    'خذها',
    'ناخذها',
    'ناخد',
    'نحجزها',
    'حجز',
    'اريد',
    'نريد',
    'نتاعها',
    'كيفاش نطلب',
    'كيفاش نشري',
    'واش ندير باش نطلب',
    'كموند',
    'كوموند',
    'نكموندي',
    'نكوموندي',
    'راني باغي نكموندي',
    'نحب نكموندي',
    'buy',
    'order',
  ],
  delivery: ['توصيل', 'مدة التوصيل', 'كم يوصل', 'وقتاش يوصل', 'وقتاش توصل', 'شحن', 'delivery'],
  warranty: ['ضمان', 'warranty'],
  colors: ['لون', 'ألوان', 'الوان', 'color'],
  compare: ['فرق', 'مقارنة', 'ولا', 'أحسن من'],
  greeting: [
    'سلام',
    'salam',
    'bonjour',
    'hello',
    'هلو',
    'هاي',
    'hi',
    'halo',
    'مرحبا',
    'مرحباا',
    'أهلا',
    'اهلا',
    'صباح الخير',
    'مساء الخير',
    'واش راك',
    'كيفاش راك',
    'ازيك',
    'كيفك',
  ],
};

// كلمات تأكيد/إلغاء الطلب كتابةً - مهمة لأن أزرار quick_reply ما تتصيّرش دايمًا فـ
// Facebook Lite (تطبيق خفيف يستعملوه بزاف زبائن الجزائر)، فالزبون يكتب "نعم" أو "لا" يدويًا.
const CONFIRM_WORDS = [
  'نعم',
  'اي',
  'ايه',
  'ايوا',
  'اوك',
  'ok',
  'واه',
  'صحيح',
  'موافق',
  'نأكد',
  'أؤكد',
  'yes',
  'confirm',
  'تمام',
  'نتاع',
  'ماشي مشكل',
];
const CANCEL_WORDS = ['لا', 'الغاء', 'إلغاء', 'كنسل', 'cancel', 'no', 'ماشي', 'ما نحبش', 'ماحبيتش', 'تراجعت'];

// يتحقق إذا كان النص المكتوب يعادل "نعم" أو "لا" (تأكيد/إلغاء) لدعم الزبائن اللي ما تبانلهم
// أزرار Messenger (مثلاً Facebook Lite). يرجع 'confirm' أو 'cancel' أو null.
function detectYesNo(message) {
  const text = normalize(message);
  if (!text) return null;
  // مطابقة كلمة كاملة (وليس substring) لتفادي مطابقات خاطئة
  const words = text.split(/\s+/);
  if (CANCEL_WORDS.some((w) => words.includes(normalize(w)) || text === normalize(w))) return 'cancel';
  if (CONFIRM_WORDS.some((w) => words.includes(normalize(w)) || text === normalize(w))) return 'confirm';
  return null;
}

function normalize(text) {
  return (text || '')
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[ًٌٍَُِّْ]/g, ''); // إزالة التشكيل
}

function detectIntent(message) {
  const text = normalize(message);
  for (const [intent, keywords] of Object.entries(INTENTS)) {
    if (keywords.some((k) => text.includes(normalize(k)))) {
      return intent;
    }
  }
  return 'unknown';
}

// يحاول إيجاد منتج بالاسم داخل قائمة منتجات المتجر (مطابقة تقريبية)
function findProductByName(message, products) {
  const text = normalize(message);
  return products.find((p) => text.includes(normalize(p.name)) || normalize(p.name).includes(text));
}

// ينظّف رابط (reels أو أي رابط) للمقارنة: يحذف البروتوكول و www و القيم بعد ? و الـ / الأخير
// (روابط Instagram/Facebook غالبًا توصل بنفس المسار لكن بمعرّفات تتبع مختلفة بعد ?، مثل ?igsh=...)
function normalizeUrl(url) {
  if (!url) return '';
  return url
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('?')[0]
    .replace(/\/+$/, '');
}

// يستخرج أول رابط من نص حر (رسالة الزبون قد تحتوي رابط + كلام آخر)
function extractUrl(text) {
  const match = (text || '').match(/https?:\/\/[^\s]+/i);
  return match ? match[0] : null;
}

// يحاول إيجاد منتج عبر رابط الريلز الخاص به (reelsUrl) بمقارنة الرابط المُرسل من الزبون
// (سواء وصل كنص عادي أو كرابط داخل attachment من فيسبوك) بروابط منتجات المتجر.
function findProductByUrl(urlOrText, products) {
  const url = extractUrl(urlOrText) || urlOrText;
  const normalizedIncoming = normalizeUrl(url);
  if (!normalizedIncoming) return null;
  return products.find((p) => {
    const normalizedProduct = normalizeUrl(p.reelsUrl);
    if (!normalizedProduct) return false;
    return normalizedIncoming === normalizedProduct || normalizedIncoming.includes(normalizedProduct) || normalizedProduct.includes(normalizedIncoming);
  });
}

function buildProductReply(product) {
  const lines = [
    `📦 ${product.name}`,
    `💰 ${product.price} دج`,
    product.description ? `📝 ${product.description}` : null,
    product.features ? `⭐ ${product.features}` : null,
    product.warranty ? `🛡️ ${product.warranty}` : null,
    product.deliveryTime ? `🚚 ${product.deliveryTime}` : null,
    product.reelsUrl ? `🎥 ${product.reelsUrl}` : null,
  ].filter(Boolean);
  return lines.join('\n');
}

function fallbackReply() {
  return '😄 عذرًا، أنا مخصص فقط لمساعدتك في منتجات المتجر والطلبات. اكتب اسم منتج أو "المنتجات" لعرض القائمة.';
}

// يقترح منتجات مشابهة بناءً على تشابه الكلمات بين وصف (مثلاً وصف صورة من AI) ومنتجات المتجر.
// نسخة بسيطة (بلا AI خارجي) تستعمل كخط دفاع أول أو fallback إذا AI مش مفعّل.
function findSimilarProducts(description, products, limit = 3) {
  const descWords = new Set(normalize(description).split(/\s+/).filter((w) => w.length >= 3));
  if (descWords.size === 0) return [];
  const scored = products
    .map((p) => {
      const productText = normalize(`${p.name} ${p.description || ''} ${p.features || ''} ${p.visualDescription || ''}`);
      const productWords = productText.split(/\s+/);
      const score = productWords.filter((w) => descWords.has(w)).length;
      return { product: p, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.product);
}

module.exports = {
  INTENTS, // (يُصدَّر أيضًا) خرائط الكلمات المفتاحية الخام - يستعملها src/learning/intent/intentResolver.js
  detectIntent,
  findProductByName,
  findProductByUrl,
  extractUrl,
  findSimilarProducts,
  buildProductReply,
  fallbackReply,
  normalize,
  detectYesNo,
  INTENT_KEYS: Object.keys(INTENTS),
};
