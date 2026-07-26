const StoreService = require('../../services/StoreService');
const ProductService = require('../../services/ProductService');
const NotificationService = require('../../services/NotificationService');
const AIMediaService = require('../../services/AIMediaService');
const FacebookMessengerService = require('../../services/FacebookMessengerService');
const engine = require('../../engine/responseEngine');
const catalogController = require('./catalogController');
const logger = require('../../utils/logger');
const { reportError } = require('../../utils/errorReporter');

// رسالة صوتية من الزبون (Facebook يرسل رابط عام مباشرة، بلا حاجة لـ getFileLink مثل تليغرام)
async function handleAudio(psid, storeId, audioUrl) {
  const store = await StoreService.getStore(storeId);
  if (!store) return;

  if (!store.features?.voiceReply) {
    return FacebookMessengerService.sendText(storeId, psid, '🎤 عذرًا، ميزة الرد على الرسائل الصوتية غير متوفرة في باقة هذا المتجر حاليًا.');
  }
  if (!AIMediaService.isEnabled()) {
    await NotificationService.notifyStoreOwner(store.id, '🎤 وصلتك رسالة صوتية من زبون - خدمة تحويل الصوت غير مفعّلة بعد.');
    return FacebookMessengerService.sendText(storeId, psid, '🎤 تم استلام رسالتك الصوتية، سيتواصل معك البائع قريبًا.');
  }

  try {
    const text = await AIMediaService.transcribeVoice(audioUrl);
    if (!text) return FacebookMessengerService.sendText(storeId, psid, '🎤 لم أفهم الرسالة الصوتية بوضوح، حاول كتابتها نصيًا.');
    return catalogController.handleFreeText(psid, storeId, text, { inputType: 'voice' });
  } catch (err) {
    logger.error('فشل معالجة رسالة صوتية (Messenger)', { storeId, error: err.message });
    reportError(err, `بوت الزبائن (فيسبوك) - تحويل صوت لنص (متجر ${storeId})`);
    return FacebookMessengerService.sendText(storeId, psid, '⚠️ تعذر فهم الرسالة الصوتية حاليًا، حاول كتابتها نصيًا.');
  }
}

async function handleImage(psid, storeId, imageUrl, captionText = null) {
  const store = await StoreService.getStore(storeId);
  if (!store) return;

  if (!store.features?.imageRecognition) {
    return FacebookMessengerService.sendText(storeId, psid, '🖼️ عذرًا، ميزة التعرف على الصور غير متوفرة في باقة هذا المتجر حاليًا.');
  }
  if (!AIMediaService.isEnabled()) {
    await NotificationService.notifyStoreOwner(store.id, '🖼️ وصلتك صورة من زبون - خدمة تحليل الصور غير مفعّلة بعد.');
    return FacebookMessengerService.sendText(storeId, psid, '🖼️ تم استلام صورتك، سيتواصل معك البائع للمساعدة قريبًا.');
  }

  try {
    // description هنا نظيف دايمًا (بلا <think> ولا Markdown) - انظر AIMediaService.describeImage
    const imageDescription = await AIMediaService.describeImage(imageUrl);
    // إذا الزبون كتب رسالة مرفقة مع الصورة (مثلاً "عندكم هذا بالأسود؟")، ندمجها مع وصف الصورة
    // باش النية (اللون المطلوب مثلاً) تدخل فـ المطابقة، ماشي بس شكل الصورة.
    const description = captionText ? `${imageDescription}. طلب الزبون بالتحديد: ${captionText}` : imageDescription;
    const products = await ProductService.listAvailableProducts(store.id);

    // 1) مطابقة نصية سريعة بالاسم (إذا وصف AI أو رسالة الزبون ذكرت اسم منتج حرفيًا)
    let matched = engine.findProductByName(captionText || description, products);

    // 2) إذا ما لقيناش، نجرب مطابقة أذكى عبر AI (يفهم اللون/النوع/الشكل، ماشي بس نص حرفي)
    if (!matched) {
      try {
        matched = await AIMediaService.matchProductFromDescription(description, products);
      } catch (err) {
        // فشل نداء المطابقة الذكية - نكمل بلا تطابق (اقتراحات تحت)
      }
    }

    if (matched) {
      // ⚠️ ما نرسلوش وصف AI الخام للزبون أبدًا - غير بطاقة المنتج الرسمية (نفس الشكل فـ كل مكان)
      return catalogController.sendSingleProductCard(storeId, psid, matched);
    }

    // ماكاين حتى تطابق: نخبر الزبون ببساطة ونقترح عليه منتجات قريبة (بلا ما نبين له وصف AI الخام)
    return catalogController.sendUnavailableWithSuggestions(storeId, psid, { description });
  } catch (err) {
    logger.error('فشل معالجة صورة (Messenger)', { storeId, error: err.message });
    reportError(err, `بوت الزبائن (فيسبوك) - تحليل صورة (متجر ${storeId})`);
    return FacebookMessengerService.sendText(storeId, psid, '⚠️ تعذر تحليل الصورة حاليًا، صف ما تبحث عنه نصيًا وسأساعدك.');
  }
}

module.exports = { handleAudio, handleImage };
