const { env } = require('../config/env');
const logger = require('../utils/logger');
const { reportError } = require('../utils/errorReporter');
const { isRateLimited } = require('../middlewares/rateLimiter');
const StoreService = require('../services/StoreService');
const MessageQuotaService = require('../services/MessageQuotaService');
const FacebookSessionRepository = require('../repositories/FacebookSessionRepository');
const FacebookMessengerService = require('../services/FacebookMessengerService');

const catalogController = require('../controllers/customer/catalogController');
const orderController = require('../controllers/customer/orderController');
const mediaController = require('../controllers/customer/mediaController');
const RatingService = require('../services/RatingService');
const ProductService = require('../services/ProductService');
const engine = require('../engine/responseEngine');
const { PAYLOADS, extractProductIdFromBuyPayload, parseRef, extractRatingFromPayload } = require('../ui/customerKeyboards');

function getPayload(event) {
  return event.postback?.payload || event.message?.quick_reply?.payload || null;
}

function getReferralRef(event) {
  return event.referral?.ref || event.postback?.referral?.ref || null;
}

// يعالج حدث واحد قادم من فيسبوك (رسالة أو ضغطة زر) لزبون واحد
// pageId: معرف صفحة فيسبوك اللي استقبلت الحدث (entry.id) - نستعمله لتحديد المتجر مباشرة
// إذا كانت صفحة خاصة مربوطة بمتجر معين (بدل الاعتماد فقط على ref).
async function processEvent(event, pageId) {
  const psid = event.sender?.id;
  if (!psid) return;

  if (isRateLimited(psid)) return; // نتجاهل بصمت، بلا رسالة خطأ مزعجة للزبون

  let session = (await FacebookSessionRepository.get(psid)) || {};

  // 0) إذا هذه الصفحة مربوطة كصفحة خاصة بمتجر معين، هذا المتجر هو السياق دائمًا
  // (بلا حاجة لرابط ref أصلاً - كل زبون يراسل هذه الصفحة يدخل مباشرة لهذا المتجر)
  const dedicatedStore = await StoreService.getStoreByFacebookPageId(pageId).catch(() => null);

  // 1) رابط دخول لمتجر معيّن (m.me/الصفحة?ref=storeId أو storeId_productId) - أول مرة،
  // أو حتى لو زبون قديم دخل من رابط منتج جديد (نعيد فتح بطاقة المنتج الجديد)
  const rawRef = getReferralRef(event);
  const { storeId: refStoreId, productId: refProductId } = parseRef(rawRef);
  const effectiveStoreId = dedicatedStore ? dedicatedStore.id : refStoreId;

  const isNewContext = effectiveStoreId && (effectiveStoreId !== session.storeId || refProductId);
  if (isNewContext) {
    try {
      const profile = await FacebookMessengerService.getUserProfile(effectiveStoreId, psid);
      await catalogController.startForStore(
        psid,
        effectiveStoreId,
        { firstName: profile.first_name, lastName: profile.last_name },
        refProductId
      );
    } catch (err) {
      logger.error('فشل بدء جلسة متجر جديد (Messenger)', { psid, ref: rawRef, error: err.message });
      await reportError(err, `بوت الزبائن (فيسبوك) - بدء جلسة متجر ${effectiveStoreId}`);
      await FacebookMessengerService.sendText(
        effectiveStoreId,
        psid,
        '⚠️ تعذر فتح هذا المتجر حاليًا، تأكد من الرابط أو حاول لاحقًا.'
      );
    }
    return; // حدث الترحيب لا يحتاج معالجة إضافية
  }

  const storeId = dedicatedStore ? dedicatedStore.id : session.storeId;
  if (!storeId) {
    // زبون بلا سياق متجر (دخل للصفحة مباشرة بلا رابط خاص بمتجر)
    if (event.message?.text || event.postback) {
      await FacebookMessengerService.sendText(
        null,
        psid,
        'مرحبًا! من فضلك استعمل رابط المتجر الذي حصلت عليه من البائع للبدء.'
      );
    }
    return;
  }

  // 2) فحص نشاط المتجر وحصة الرسائل (يعادل quotaGuard تاع تليغرام)
  const store = dedicatedStore || (await StoreService.getStore(storeId));
  if (!store) return;
  if (!store.active) {
    return FacebookMessengerService.sendText(storeId, psid, '⚠️ عذرًا، هذا المتجر متوقف حاليًا. تواصل مع البائع مباشرة.');
  }
  const quota = MessageQuotaService.canConsume(store);
  if (!quota.allowed) {
    return FacebookMessengerService.sendText(
      storeId,
      psid,
      '⚠️ عذرًا، وصل هذا المتجر للحد الأقصى من الرسائل المسموح بها هذا الشهر. سيتم تجديد الرصيد قريبًا.'
    );
  }
  if (!quota.unlimited) await MessageQuotaService.consume(storeId);

  // 3) توزيع الحدث على المعالج المناسب
  const payload = getPayload(event);
  const productIdFromBuy = extractProductIdFromBuyPayload(payload);
  const ratingStars = extractRatingFromPayload(payload);

  if (ratingStars && session.pendingRatingOrderId) {
    try {
      await RatingService.addRating(storeId, { orderId: session.pendingRatingOrderId, psid, stars: ratingStars });
      await FacebookSessionRepository.set(psid, { pendingRatingOrderId: null });
      await FacebookMessengerService.sendText(storeId, psid, '🙏 شكرًا لك على تقييمك! رأيك يهمنا كثيرًا.');
    } catch (err) {
      logger.error('فشل حفظ تقييم الزبون', { psid, error: err.message });
    }
    return;
  }

  if (payload === PAYLOADS.GET_STARTED) return; // تم التعامل معه أعلاه عبر referral عادةً
  if (payload === PAYLOADS.SHOW_PRODUCTS) return catalogController.sendProductList(psid, storeId);
  if (productIdFromBuy) return orderController.startOrderFromProduct(psid, storeId, productIdFromBuy);
  if (payload === PAYLOADS.CONFIRM_ORDER) return orderController.confirmOrder(psid, storeId, session);
  if (payload === PAYLOADS.CANCEL_ORDER) return orderController.cancelOrder(psid, storeId);

  if (event.message?.attachments?.length) {
    // الزبون قد يبعث صورة مع تعليق فـ نفس الرسالة (مثلاً "عندكم هذا بالأسود؟" + صورة) -
    // فيسبوك أحيانًا يبعثهم فـ نفس الحدث. لازم ما نضيعش النص.
    const captionText = event.message.text || null;
    let handledAny = false;
    for (const att of event.message.attachments) {
      if (att.type === 'image') {
        await mediaController.handleImage(psid, storeId, att.payload?.url, captionText);
        handledAny = true;
      } else if (att.type === 'audio') {
        await mediaController.handleAudio(psid, storeId, att.payload?.url);
        handledAny = true;
      } else {
        // رابط ملصوق (مثلاً رابط ريلز منتج) يوصل من فيسبوك كـ attachment (template/fallback)
        // وليس كنص عادي - لهذا كان البوت "يصمت" سابقًا. نحاول استخراج الرابط ومطابقته بمنتج.
        const linkUrl = att.payload?.url || att.url || null;
        const handled = await handleLinkAttachment(psid, storeId, linkUrl, captionText);
        handledAny = handledAny || handled;
      }
    }
    if (!handledAny) {
      // ماكانش نوع مدعوم ولا رابط قابل للمطابقة - نرد بدل ما نصمت
      await FacebookMessengerService.sendText(storeId, psid, engine.fallbackReply());
    }
    return;
  }

  if (event.message?.text) {
    const text = event.message.text;
    // زبون يرسل رابط منتج مباشر كنص عادي (بدل الضغط عليه كرابط) - نتعرف عليه ونرد بالتفاصيل
    const pastedRef = extractRefFromPastedLink(text);
    if (pastedRef?.productId) {
      try {
        return await catalogController.startForStore(psid, storeId, {}, pastedRef.productId);
      } catch (err) {
        // نتجاهل ونكمل بالمعالجة العادية إذا فشل
      }
    }
    if (session.orderState) return orderController.handleOrderStep(psid, storeId, session, text);
    return catalogController.handleFreeText(psid, storeId, text);
  }
}

// يعالج رابط يصل كـ attachment (مثلاً رابط ريلز Instagram - فيسبوك يحوّله لمعاينة/attachment
// بدل نص عادي، ولهذا كان البوت يتجاهله سابقًا). يحاول مطابقته بمنتج عبر reelsUrl، وإذا لم
// يجد تطابقًا يمرر captionText (إن وجد) للمعالجة النصية العادية بدل ما يصمت.
// يرجع true إذا تم إرسال رد للزبون، false إذا لم يُعالج شيء.
async function handleLinkAttachment(psid, storeId, linkUrl, captionText) {
  const products = await ProductService.listProducts(storeId);
  const matched = linkUrl ? engine.findProductByUrl(linkUrl, products) : null;
  if (matched) {
    await catalogController.sendSingleProductCard(storeId, psid, matched);
    return true;
  }
  if (captionText && captionText.trim()) {
    await catalogController.handleFreeText(psid, storeId, captionText);
    return true;
  }
  return false;
}

// يتعرف على رابط m.me/صفحة?ref=storeId_productId ملصوق كنص عادي فـ الرسالة (وليس referral حقيقي)
function extractRefFromPastedLink(text) {
  const match = text?.match(/m\.me\/[^/?]+\?ref=([\w-]+)/i);
  if (!match) return null;
  return parseRef(match[1]);
}

function registerCustomerRoutes(app) {
  // التحقق من الـ webhook (خطوة إعداد لمرة واحدة من لوحة تحكم تطبيق فيسبوك)
  app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === env.facebook.verifyToken) {
      logger.info('✅ تم التحقق من webhook فيسبوك بنجاح');
      return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
  });

  // استقبال الأحداث الفعلية (رسائل/أزرار)
  app.post('/webhook', async (req, res) => {
    const signature = req.get('X-Hub-Signature-256');
    if (!FacebookMessengerService.verifySignature(req.rawBody, signature)) {
      logger.warn('توقيع webhook غير صالح - تم رفض الطلب');
      return res.sendStatus(403);
    }

    // نرد فورًا بـ 200 (فيسبوك يحتاج رد سريع)، والمعالجة الفعلية تكمل بشكل غير متزامن
    res.sendStatus(200);

    try {
      const body = req.body;
      if (body.object !== 'page') return;
      for (const entry of body.entry || []) {
        const pageId = entry.id; // معرف الصفحة اللي استقبلت الحدث (يفرّق المتاجر أصحاب الصفحات الخاصة)
        for (const event of entry.messaging || []) {
          await processEvent(event, pageId).catch((err) => {
            logger.error('فشل معالجة حدث Messenger', { error: err.message });
            reportError(err, 'بوت الزبائن (فيسبوك) - processEvent');
          });
        }
      }
    } catch (err) {
      logger.error('فشل عام في معالجة webhook فيسبوك', { error: err.message });
      reportError(err, 'بوت الزبائن (فيسبوك) - webhook عام');
    }
  });

  // فحص صحة بسيط (مفيد لمراقبة Railway)
  app.get('/health', (req, res) => res.status(200).send('OK'));
}

module.exports = registerCustomerRoutes;
