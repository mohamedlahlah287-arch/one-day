// ثوابت الـ payloads المستعملة في أزرار Facebook Messenger (postback / quick_reply)
// (اسم الملف بقي customerKeyboards.js لتفادي تغييرات كبيرة، لكن المحتوى الآن خاص بـ Messenger)

const PAYLOADS = {
  GET_STARTED: 'GET_STARTED',
  SHOW_PRODUCTS: 'SHOW_PRODUCTS',
  CONFIRM_ORDER: 'CONFIRM_ORDER',
  CANCEL_ORDER: 'CANCEL_ORDER',
};

function buyPayload(productId) {
  return `BUY_${productId}`;
}

function ratingPayload(stars) {
  return `RATE_${stars}`;
}

function extractRatingFromPayload(payload) {
  const match = payload?.match(/^RATE_([1-5])$/);
  return match ? Number(match[1]) : null;
}

const ratingQuickReplies = [1, 2, 3, 4, 5].map((n) => ({ title: '⭐'.repeat(n), payload: ratingPayload(n) }));

function extractProductIdFromBuyPayload(payload) {
  if (!payload || !payload.startsWith('BUY_')) return null;
  return payload.slice(4);
}

// رابط m.me/الصفحة?ref=... يدعم شكلين:
// - "storeId" فقط: يفتح ترحيب المتجر العام (السلوك القديم)
// - "storeId_productId": يفتح مباشرة بطاقة المنتج (اسم + سعر + وصف) - رابط مشاركة منتج واحد
function buildProductRef(storeId, productId) {
  return `${storeId}_${productId}`;
}

function parseRef(ref) {
  if (!ref) return { storeId: null, productId: null };
  const underscoreIndex = ref.indexOf('_');
  if (underscoreIndex === -1) return { storeId: ref, productId: null };
  return {
    storeId: ref.slice(0, underscoreIndex),
    productId: ref.slice(underscoreIndex + 1),
  };
}

const confirmOrderQuickReplies = [
  { title: '✅ نعم أؤكد', payload: PAYLOADS.CONFIRM_ORDER },
  { title: '❌ إلغاء', payload: PAYLOADS.CANCEL_ORDER },
];

module.exports = {
  PAYLOADS,
  buyPayload,
  extractProductIdFromBuyPayload,
  confirmOrderQuickReplies,
  buildProductRef,
  parseRef,
  ratingQuickReplies,
  extractRatingFromPayload,
};
