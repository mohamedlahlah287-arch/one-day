const ProductService = require('../../services/ProductService');
const StoreService = require('../../services/StoreService');
const CustomerService = require('../../services/CustomerService');
const FacebookSessionRepository = require('../../repositories/FacebookSessionRepository');
const FacebookMessengerService = require('../../services/FacebookMessengerService');
const AIMediaService = require('../../services/AIMediaService');
const engine = require('../../engine/responseEngine');
const { buyPayload, PAYLOADS } = require('../../ui/customerKeyboards');
const { NotFoundError } = require('../../errors');
// orderController ما يعتمدش على catalogController، فـ ماكاين مشكل استيراد دائري هنا
const orderController = require('./orderController');

// نظام التعلّم والذاكرة (src/learning) - راجع src/learning/README.md للنظرة الشاملة على
// كل وحداته. نستورد من الملف الرئيسي (index.js) + ملفين محددين نحتاجهما مباشرة (سجل
// المحادثة بشكله المحجوب لحالة المراجعة، وناشر بطاقات "علمني").
const learning = require('../../learning');
const ConversationLogRepository = require('../../learning/conversationLog/ConversationLogRepository');
const { publishForReview } = require('../../learning/teach/teachPublisher');

// نظام الرسائل الصوتية (src/voiceNotes) - باقة "الأعمال" فقط. راجع src/voiceNotes/README.md
const VoiceNoteService = require('../../voiceNotes/VoiceNoteService');
// محرك اتخاذ القرار: يقرر تشغيل صوت النية العامة أو الفعل البديل بناءً على "شروط التشغيل"
// (هل النية تحتاج معرفة منتج محدد؟) - راجع src/engine/decisionEngine.js و voiceConditions.js
const decisionEngine = require('../../engine/decisionEngine');
// إرسال الردود "الديناميكية" (تعلّم/AI/fallback) بالشكل المناسب حسب طريقة الرد المضبوطة
// من التاجر (نص/صوت/ذكي/مخصص) - المتطلبات #14 #15. لا علاقة له بالرسائل الصوتية المسجّلة
// يدويًا من التاجر (تلك تبقى عبر decisionEngine.sendAudio كما هي بلا أي تغيير).
const AIReplyDeliveryService = require('../../services/ai/AIReplyDeliveryService');

// إرسال بطاقة منتج واحد (تُستعمل من عدة أماكن: القائمة، البحث بالاسم، ورابط المنتج المباشر)
// نسجل lastProductId فـ الجلسة فـ كل مرة باش إذا الزبون قال بعدها "نحب نطلب" بلا ما يسمي
// المنتج، نعرفو على واش يهدر ونبدأو الطلب مباشرة بلا ما نعاود نوريه نفس البطاقة (كان هذا
// بالضبط السبب اللي خلى البوت يكرر البطاقة بدل ما يبدأ الطلب).
async function sendSingleProductCard(storeId, psid, product) {
  await FacebookSessionRepository.set(psid, { lastProductId: product.id });
  await FacebookMessengerService.sendProductCard(storeId, psid, {
    title: product.name,
    // subtitle: سطر قصير للبطاقة البصرية فقط (السعر) - التفاصيل الكاملة تُرسل عبر fullText
    subtitle: `${product.price} دج`,
    imageUrl: product.imageUrl || undefined,
    buyPayload: buyPayload(product.id),
    // fullText: التفاصيل الكاملة كرسالة نصية عادية - مضمونة تبان عند كل الزبائن (بما فيهم
    // مستعملي Facebook Lite اللي البطاقة البصرية عندهم أحيانًا ما تتصيّرش)
    fullText: engine.buildProductReply(product),
  });

  // 🎙️ إذا سجّل التاجر رسالة صوتية لهذا المنتج (شرح + سعر بصوته - ميزة باقة الأعمال)، نرسلها
  // كرسالة إضافية بعد البطاقة مباشرة. ملاحظة: نرسلها هنا (نقطة مركزية واحدة) حتى تشتغل تلقائيًا
  // فـ كل مكان يُستدعى منه sendSingleProductCard (القائمة الكاملة، البحث بالاسم، الرابط المباشر).
  if (product.voiceNoteUrl) {
    await FacebookMessengerService.sendAudio(storeId, psid, product.voiceNoteUrl);
  }
}

// أول تفاعل للزبون مع الصفحة عبر رابط m.me/الصفحة?ref=storeId (أو ضغط "Get Started" بعد نفس الرابط)
// productId اختياري: إذا كان الرابط رابط منتج مباشر (storeId_productId)، نرسل بطاقة المنتج مباشرة.
async function startForStore(psid, storeId, profile = {}, productId = null) {
  if (!storeId) {
    return FacebookMessengerService.sendText(
      null,
      psid,
      'مرحبًا! هذا الرابط يحتاج معرف متجر صحيح. تواصل مع البائع للحصول على الرابط الصحيح.'
    );
  }
  const store = await StoreService.getStore(storeId);
  if (!store) throw new NotFoundError('المتجر');

  await FacebookSessionRepository.set(psid, { storeId });
  await CustomerService.findOrRegister(storeId, psid, profile);

  if (productId) {
    try {
      const product = await ProductService.getProduct(storeId, productId);
      await FacebookMessengerService.sendText(storeId, psid, `👋 ${store.welcomeMessage}`);
      return sendSingleProductCard(storeId, psid, product);
    } catch (err) {
      // المنتج ماعادش موجود (تحذف مثلاً) - نكمل بالترحيب العادي بدل ما نوقف
    }
  }

  await FacebookMessengerService.sendQuickReplies(
    storeId,
    psid,
    `${store.welcomeMessage}\n\nيمكنني مساعدتك في: المنتجات، الأسعار، التوصيل، الطلبات.`,
    [{ title: '🛍️ عرض المنتجات', payload: PAYLOADS.SHOW_PRODUCTS }]
  );
}

async function sendProductList(psid, storeId, { excludeId } = {}) {
  if (!storeId) return FacebookMessengerService.sendText(storeId, psid, 'من فضلك ابدأ من رابط المتجر الصحيح.');
  let products = await ProductService.listAvailableProducts(storeId);
  if (excludeId) products = products.filter((p) => p.id !== excludeId);
  if (products.length === 0) return FacebookMessengerService.sendText(storeId, psid, 'لا توجد منتجات متاحة حاليًا.');

  for (const p of products) {
    await sendSingleProductCard(storeId, psid, p);
  }
}

// الزبون طلب الشراء بلا ما يسمي منتج بوضوح ("نحب نطلب"، "اوك اود الطلب"...) - نبدأ الطلب
// مباشرة على آخر منتج شافه (lastProductId)، وإلا نوريه القائمة باش يختار.
async function startBuyFlow(psid, storeId, session) {
  if (session?.lastProductId) {
    try {
      await ProductService.getProduct(storeId, session.lastProductId); // نتأكد ماشي محذوف
      return orderController.startOrderFromProduct(psid, storeId, session.lastProductId);
    } catch (err) {
      // المنتج ماعادش موجود - نكمل بعرض القائمة تحت
    }
  }
  return sendProductList(psid, storeId);
}

// عندما ما نلقاوش تطابق (لا بالاسم، لا عبر AI) - بدل رسالة عامة "أنا مخصص فقط لـ..." اللي
// تحس الزبون بلي البوت ما فهمش، نقترح عليه منتجات قريبة إذا كاينة، أو نوجهو بوضوح للقائمة.
async function sendUnavailableWithSuggestions(storeId, psid, { description, excludeId } = {}) {
  const products = await ProductService.listAvailableProducts(storeId);
  const pool = excludeId ? products.filter((p) => p.id !== excludeId) : products;
  const similar = description ? engine.findSimilarProducts(description, pool, 3) : [];

  if (similar.length) {
    await FacebookMessengerService.sendText(storeId, psid, '😔 هذا المنتج بالضبط مش متوفر عندنا، لكن عندنا هذوما قريبين منه:');
    for (const p of similar) await sendSingleProductCard(storeId, psid, p);
    return;
  }
  return FacebookMessengerService.sendText(
    storeId,
    psid,
    '😔 عذرًا، هذا المنتج غير متوفر عندنا حاليًا. اكتب "المنتجات" لعرض كل ما هو متوفر.'
  );
}

async function handleFreeText(psid, storeId, message, { inputType = 'text' } = {}) {
  if (!storeId) return FacebookMessengerService.sendText(storeId, psid, 'من فضلك ابدأ من رابط المتجر الصحيح.');

  const [allProducts, store, session] = await Promise.all([
    ProductService.listProducts(storeId),
    StoreService.getStore(storeId),
    FacebookSessionRepository.get(psid),
  ]);

  const matchedProduct = engine.findProductByUrl(message, allProducts) || engine.findProductByName(message, allProducts);
  if (matchedProduct) {
    const outOfStock = matchedProduct.quantity !== null && matchedProduct.quantity !== undefined && matchedProduct.quantity <= 0;
    if (outOfStock) {
      await FacebookMessengerService.sendText(storeId, psid, `😔 عذرًا، "${matchedProduct.name}" نفدت كميته حاليًا.`);
      return sendUnavailableWithSuggestions(storeId, psid, {
        description: `${matchedProduct.name} ${matchedProduct.description || ''}`,
        excludeId: matchedProduct.id,
      });
    }
    return sendSingleProductCard(storeId, psid, matchedProduct);
  }

  // 0) خط أنابيب التعلّم الكامل قبل أي شيء آخر: تنظيف الرسالة -> تحليل الإيموجي -> نية
  //    (كلمات مفتاحية تامة ثم تقريبية/fuzzy) -> قاموس المتجر -> قرارات التاجر -> ردود سابقة
  //    عدّلها التاجر لسؤال شبيه. راجع src/learning/intent/intentResolver.js لتفاصيل كل مرحلة.
  const resolution = await learning.intentResolver.resolve(storeId, message);

  // 0-أ) قرار ثابت أو رد سابق مطابق تقريبًا - نملك ردًا جاهزًا كاملاً، بلا حاجة لقوالب أو AI
  if (resolution.resolved && resolution.reply) {
    await AIReplyDeliveryService.sendSmartReply(storeId, psid, resolution.reply, { inputType });
    return logTurn(storeId, psid, message, resolution.reply, resolution.intent, resolution.source);
  }

  let intent = resolution.intent;
  let source = resolution.source;

  // 0-ب) إذا بقيت النية غير معروفة، ونداء AI مفعّل، نجرب نفهم النية بالذكاء الاصطناعي (يفهم
  //    أي صياغة جزائرية حتى لو ماكانتش فـ الكلمات المفتاحية الثابتة ولا فـ قاموس المتجر بعد)
  if (intent === 'unknown' && AIMediaService.isEnabled()) {
    try {
      const aiIntent = await AIMediaService.classifyIntent(message, engine.INTENT_KEYS);
      if (aiIntent) {
        intent = aiIntent;
        source = 'ai';
      }
    } catch (err) {
      // فشل نداء AI (شبكة، حصة، ...) - نكمل بالسلوك الافتراضي بلا ما نوقف الزبون
    }
  }

  // "المنتج المعروف من سياق المحادثة" - آخر منتج شاف الزبون بطاقته (session.lastProductId).
  // ملاحظة: مطابقة اسم/رابط منتج مذكور مباشرة فـ الرسالة نفسها تمت أعلاه ورجعت فورًا لو
  // وُجدت، فكل ما يصل لهذا المستوى هو رسائل بلا اسم منتج صريح (مثل "بكم؟" بلا تفاصيل).
  let lastProduct = null;
  if (session?.lastProductId) {
    try {
      lastProduct = await ProductService.getProduct(storeId, session.lastProductId);
    } catch (err) {
      // المنتج ماعادش موجود - نعامله كمنتج غير معروف
    }
  }

  // نوايا لها تدفّق خاص (رد أساسي ماشي مجرد نص: ترحيب المتجر/بدء الطلب/مدة التوصيل)
  // لا تحتاج معرفة منتج محدد أصلاً - نمرّ عبر محرك القرار فقط لتحديد هل نشغّل صوتًا.
  if (intent === 'greeting') {
    const decision = await decisionEngine.decide(storeId, intent, { hasProduct: true });
    if (decision.action === 'voice') {
      await FacebookMessengerService.sendAudio(storeId, psid, decision.url);
      return logTurn(storeId, psid, message, '(رسالة صوتية)', intent, source);
    }
    await AIReplyDeliveryService.sendSmartReply(storeId, psid, store.welcomeMessage, { inputType });
    return logTurn(storeId, psid, message, store.welcomeMessage, intent, source);
  }

  if (intent === 'buy') {
    // هنا الرد الأساسي بطاقة منتج/قائمة (ماشي نص واحد)، فنرسل الصوت كمقدمة إضافية بدل استبداله
    const decision = await decisionEngine.decide(storeId, intent, { hasProduct: true });
    if (decision.action === 'voice') await FacebookMessengerService.sendAudio(storeId, psid, decision.url);
    await startBuyFlow(psid, storeId, session);
    return logTurn(storeId, psid, message, '(بطاقة منتج/بدء طلب)', intent, source);
  }

  if (intent === 'delivery') {
    const decision = await decisionEngine.decide(storeId, intent, { hasProduct: true });
    if (decision.action === 'voice') {
      await FacebookMessengerService.sendAudio(storeId, psid, decision.url);
      return logTurn(storeId, psid, message, '(رسالة صوتية)', intent, source);
    }
    const reply = `🚚 مدة التوصيل: ${store.deliveryTime || 'تختلف حسب المنتج، تفقد تفاصيل المنتج.'}`;
    await AIReplyDeliveryService.sendSmartReply(storeId, psid, reply, { inputType });
    return logTurn(storeId, psid, message, reply, intent, source);
  }

  // ✅ بقية النوايا (سعر/ضمان/ألوان/مقارنة... وأي نية مستقبلية تُضاف لاحقًا بلا تعديل هنا):
  // "شروط التشغيل" هي الفيصل الآن، وليس فقط وجود كلمة مفتاحية. إذا كانت النية تحتاج منتجًا
  // محددًا ولم يُعرف (لا مذكور فـ الرسالة ولا آخر منتج شافه الزبون)، لا نشغّل أي صوت إطلاقًا
  // - هذا بالضبط ما يمنع الخلل الأصلي: صوت سعر منتج عشوائي على سؤال عام مثل "بكم؟" بلا منتج.
  // بدلاً من ذلك نطبّق الفعل البديل المضبوط من التاجر (سؤال توضيحي/رسالة نصية/تجاهل).
  const conditions = await VoiceNoteService.getConditionsForIntent(storeId, intent);
  const decision = await decisionEngine.decide(storeId, intent, { hasProduct: Boolean(lastProduct) });

  if (decision.action === 'voice') {
    await FacebookMessengerService.sendAudio(storeId, psid, decision.url);
    // النية تحتاج منتجًا وهو معروف من السياق - نُتبع الصوت ببطاقته الكاملة (كل التفاصيل)
    if (conditions.requiresProduct && lastProduct) {
      await sendSingleProductCard(storeId, psid, lastProduct);
      return logTurn(storeId, psid, message, '(رسالة صوتية + بطاقة آخر منتج)', intent, source);
    }
    return logTurn(storeId, psid, message, '(رسالة صوتية)', intent, source);
  }

  if (decision.action === 'none') {
    // ماكاين صوت مسجَّل، لكن النية تحتاج منتجًا وهو معروف من السياق - بطاقته كافية كرد
    if (conditions.requiresProduct && lastProduct) {
      await sendSingleProductCard(storeId, psid, lastProduct);
      return logTurn(storeId, psid, message, '(بطاقة آخر منتج)', intent, source);
    }
    // لا صوت، لا منتج معروف، والنية غير مرتبطة بمنتج (أو غير معروفة أصلاً) - الرد الافتراضي
    const reply = engine.fallbackReply();
    await AIReplyDeliveryService.sendSmartReply(storeId, psid, reply, { inputType });
    return logTurn(storeId, psid, message, reply, intent, 'fallback');
  }

  // decision.action === 'text' | 'ask' -> النية تحتاج منتجًا ولم يُعرف: سؤال توضيحي أو
  // رسالة نصية بديلة مضبوطة من التاجر (البند الثالث فـ المتطلبات) - يمر أيضًا عبر طريقة الرد.
  await AIReplyDeliveryService.sendSmartReply(storeId, psid, decision.text, { inputType });
  return logTurn(storeId, psid, message, decision.text, intent, source);
}

// يسجّل دورة محادثة واحدة (رسالة زبون + رد بوت) فـ سجل التعلّم، وإذا كان مصدر الرد أقل
// موثوقية (AI أو fallback) يرسل للتاجر بطاقة "علمني" (✔ ممتاز / ✏️ تعديل - البند الرابع فـ
// المتطلبات). التسجيل العادي fire-and-forget حتى لا يبطّئ رد الزبون؛ حالة المراجعة فقط
// تنتظر كتابة السجل لأنها تحتاج معرف الوثيقة (logId) الحقيقي لبناء أزرار Telegram.
async function logTurn(storeId, psid, customerMessage, botReply, intent, source) {
  const needsReview = source === 'ai' || source === 'fallback';

  if (!needsReview) {
    learning.ConversationLogService.logTurn(storeId, { psid, customerMessage, botReply, intent, source });
    return;
  }

  try {
    const logId = await ConversationLogRepository.logTurn(storeId, { psid, customerMessage, botReply, intent, source });
    await publishForReview(storeId, { id: logId, customerMessage, botReply, intent });
  } catch (err) {
    // فشل إرسال/تسجيل بطاقة المراجعة لا يجب أن يؤثر على تجربة الزبون بأي شكل
  }
}

module.exports = { startForStore, sendProductList, sendSingleProductCard, sendUnavailableWithSuggestions, handleFreeText };
