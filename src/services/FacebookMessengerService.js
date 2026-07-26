const crypto = require('crypto');
const { env } = require('../config/env');
const logger = require('../utils/logger');
const StoreRepository = require('../repositories/StoreRepository');

const GRAPH_BASE = 'https://graph.facebook.com/v19.0';

// قطع نص لحد أقصى من الحروف بأمان: يستعمل Array.from (يقرأ code points) بدل .slice()
// (اللي يقرأ UTF-16 code units) باش ما يقطعش فـ نص إيموجي (surrogate pair) ويخلي حرف
// مكسور فـ آخر النص - هذا كان سبب ظهور بطاقات منتجات فارغة/مشوّهة عند بعض الزبائن.
// نأخذ أيضًا أول سطر فقط، لأن subtitle الـ generic template ما يدعمش أسطر متعددة بشكل موثوق.
function truncateSafe(text, maxChars) {
  if (!text) return '';
  const firstLine = String(text).split('\n')[0].trim();
  const chars = Array.from(firstLine);
  if (chars.length <= maxChars) return firstLine;
  return chars.slice(0, maxChars).join('').trim() + '…';
}

// كاش صغير فـ الذاكرة (60 ثانية) لتوكن كل متجر، باش ما نديرو query لـ Firestore فـ كل رسالة.
const TOKEN_CACHE_TTL_MS = 60_000;
const tokenCache = new Map(); // storeId -> { token, expiresAt }

/**
 * FacebookMessengerService: كل التواصل الخام مع Messenger Platform (Graph API) يمر من هنا فقط.
 * باقي الكود (controllers) ما يعرفش شكل طلبات Graph API، فقط ينادي methods واضحة.
 *
 * دعم تعدد الصفحات: كل متجر يقدر يربط صفحة فيسبوك خاصة بيه (facebookPageAccessToken).
 * إذا ما ربطش صفحة خاصة، نستعمل الصفحة المشتركة (env.facebook.pageAccessToken) كـ fallback.
 * لهذا كل دالة إرسال تاخذ storeId كأول باراميتر (يقدر يكون null إذا ماكاينش سياق متجر بعد).
 */
class FacebookMessengerService {
  async resolveToken(storeId) {
    if (!storeId) return env.facebook.pageAccessToken;
    const cached = tokenCache.get(String(storeId));
    if (cached && cached.expiresAt > Date.now()) return cached.token;

    const store = await StoreRepository.findById(storeId).catch(() => null);
    const token = store?.facebookPageAccessToken || env.facebook.pageAccessToken;
    tokenCache.set(String(storeId), { token, expiresAt: Date.now() + TOKEN_CACHE_TTL_MS });
    return token;
  }

  invalidateTokenCache(storeId) {
    tokenCache.delete(String(storeId));
  }

  async callSendAPI(storeId, payload) {
    const token = await this.resolveToken(storeId);
    const res = await fetch(`${GRAPH_BASE}/me/messages?access_token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      logger.error('فشل إرسال رسالة عبر Messenger', { status: res.status, errText, storeId });
      throw new Error('Facebook Send API failed');
    }
    return res.json();
  }

  async sendText(storeId, psid, text) {
    return this.callSendAPI(storeId, {
      messaging_type: 'RESPONSE',
      recipient: { id: psid },
      message: { text },
    });
  }

  // رسالة صوتية (نظام الرسائل الصوتية للتاجر - src/voiceNotes) - audioUrl يجب أن يكون رابطًا
  // عامًا يقدر Facebook يجيب منه الملف (حاليًا رابط تليغرام المباشر لملف الصوت، نفس أسلوب
  // صور المنتجات الحالي - راجع src/voiceNotes/README.md للتفاصيل والقيود).
  // is_reusable:true يخلي فيسبوك يخزّن نسخة داخلية بعد أول إرسال، فالإرسالات التالية لنفس
  // الملف تكون أسرع وأقل اعتمادًا على بقاء رابط تليغرام الأصلي متاحًا.
  async sendAudio(storeId, psid, audioUrl) {
    if (!audioUrl) return null;
    try {
      return await this.callSendAPI(storeId, {
        messaging_type: 'RESPONSE',
        recipient: { id: psid },
        message: {
          attachment: { type: 'audio', payload: { url: audioUrl, is_reusable: true } },
        },
      });
    } catch (err) {
      // فشل إرسال الصوت لا يجب أن يوقف باقي الرد (نص المنتج/البطاقة سبق إرساله عادة)
      logger.warn('فشل إرسال رسالة صوتية عبر Messenger', { storeId, psid, error: err.message });
      return null;
    }
  }

  // quickReplies: [{ title: 'نعم', payload: 'CONFIRM_ORDER' }, ...]
  // إرسال صورة (تُستعمل حاليًا من BroadcastService للرسائل الجماعية بصورة)
  async sendImage(storeId, psid, imageUrl, { messagingType = 'RESPONSE', tag } = {}) {
    if (!imageUrl) return null;
    const payload = {
      messaging_type: messagingType,
      recipient: { id: psid },
      message: { attachment: { type: 'image', payload: { url: imageUrl, is_reusable: true } } },
    };
    if (messagingType === 'MESSAGE_TAG' && tag) payload.tag = tag;
    return this.callSendAPI(storeId, payload);
  }

  // نفس sendText لكن بخيار messaging_type/tag - يُستعمل من BroadcastService للرسائل خارج
  // نافذة الـ24 ساعة (Meta تفرض messaging_type: MESSAGE_TAG مع وسم مناسب فـ هذه الحالة).
  // ⚠️ تحقّق من سياسة Meta الحالية لوسوم الرسائل قبل استعمال هذا لحملات تسويقية حقيقية -
  // الوسوم المسموحة وشروطها قد تتغيّر من طرف Meta.
  async sendTextTagged(storeId, psid, text, { messagingType = 'RESPONSE', tag } = {}) {
    const payload = { messaging_type: messagingType, recipient: { id: psid }, message: { text } };
    if (messagingType === 'MESSAGE_TAG' && tag) payload.tag = tag;
    return this.callSendAPI(storeId, payload);
  }

  async sendQuickReplies(storeId, psid, text, quickReplies) {
    return this.callSendAPI(storeId, {
      messaging_type: 'RESPONSE',
      recipient: { id: psid },
      message: {
        text,
        quick_replies: quickReplies.map((q) => ({
          content_type: 'text',
          title: q.title,
          payload: q.payload,
        })),
      },
    });
  }

  // منتج واحد كبطاقة (صورة + عنوان + وصف + زر شراء) - يشبه ctx.replyWithPhoto في تليغرام
  //
  // ⚠️ ملاحظتين مهمتين اكتشفناهم بالتجربة:
  // 1) subtitle template الـ generic محدود بـ 80 حرف. كنا نقطعوه بـ .slice(0, 80) على النص
  //    الكامل (سطور متعددة)، وهذا كيقطع أحيانًا فـ نص إيموجي (surrogate pair) فيبان النص
  //    فارغ أو مشوّه عند بعض الزبائن. الحل: نبني subtitle قصير وآمن (سطر وحد) بلا قطع فـ
  //    نص حرف، ونرسل التفاصيل الكاملة كرسالة نصية عادية دايمًا (مضمونة تبان).
  // 2) قوالب template العامة (generic template) ما تتصيّرش دايمًا بشكل صحيح فـ Facebook Lite
  //    (تطبيق خفيف يستعملوه بزاف زبائن الجزائر بسبب ضعف الأنترنت). لهذا الرسالة النصية
  //    الكاملة تُرسل قبل البطاقة دايمًا - باش الزبون يشوف المعلومة حتى لو البطاقة ما بانتش.
  async sendProductCard(storeId, psid, { title, subtitle, imageUrl, buyPayload, fullText }) {
    // 1) نرسل التفاصيل الكاملة كنص عادي أولاً (يبان فـ كل الأجهزة/التطبيقات بلا استثناء)
    if (fullText) {
      await this.sendText(storeId, psid, fullText);
    }

    // 2) نبني subtitle قصير وآمن (بحد أقصى ~78 حرف بدون قطع حرف يونيكود فـ النص)
    const safeSubtitle = truncateSafe(subtitle, 78);
    const buttons = [{ type: 'postback', title: '🛒 اطلب الآن', payload: buyPayload }];

    // 3) نرسل البطاقة البصرية (صورة + زر) كتحسين إضافي - إذا فشلت (مثلاً Facebook Lite) لا
    //    نكسر التجربة، لأن الزبون سبق وشاف التفاصيل كاملة فـ الرسالة النصية فوق.
    try {
      return await this.callSendAPI(storeId, {
        messaging_type: 'RESPONSE',
        recipient: { id: psid },
        message: {
          attachment: {
            type: 'template',
            payload: {
              template_type: 'generic',
              elements: [
                {
                  title: truncateSafe(title, 80),
                  subtitle: safeSubtitle || undefined,
                  image_url: imageUrl || undefined,
                  buttons,
                },
              ],
            },
          },
        },
      });
    } catch (err) {
      logger.warn('فشل إرسال بطاقة المنتج البصرية (تم إرسال النص الكامل كبديل مسبقًا)', {
        storeId,
        psid,
        error: err.message,
      });
      // نرسل زر الطلب كـ quick reply نصي بديل باش الزبون يقدر يطلب حتى بلا البطاقة البصرية
      return this.sendQuickReplies(storeId, psid, 'اضغط "اطلب الآن" لطلب هذا المنتج 👇', [
        { title: '🛒 اطلب الآن', payload: buyPayload },
      ]);
    }
  }

  async getUserProfile(storeId, psid) {
    try {
      const token = await this.resolveToken(storeId);
      const res = await fetch(`${GRAPH_BASE}/${psid}?fields=first_name,last_name&access_token=${token}`);
      if (!res.ok) return {};
      return res.json();
    } catch (err) {
      logger.warn('فشل جلب بيانات ملف الزبون من فيسبوك', { psid, error: err.message });
      return {};
    }
  }

  // يضبط زر "Get Started" - يُستدعى مرة عند إقلاع البوت (للصفحة المشتركة) أو عند ربط صفحة خاصة بمتجر
  async setupMessengerProfile(pageAccessToken = env.facebook.pageAccessToken) {
    try {
      const res = await fetch(`${GRAPH_BASE}/me/messenger_profile?access_token=${pageAccessToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          get_started: { payload: 'GET_STARTED' },
          greeting: [{ locale: 'default', text: 'أهلاً بك! اضغط ابدأ للتصفح والطلب.' }],
        }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        logger.warn('فشل ضبط إعدادات Messenger Profile (Get Started)', { errText });
      } else {
        logger.info('✅ تم ضبط زر Get Started لصفحة فيسبوك');
      }
    } catch (err) {
      logger.warn('فشل ضبط إعدادات Messenger Profile', { error: err.message });
    }
  }

  // ⚠️ خطوة إلزامية بعد أي ربط (OAuth أو يدوي): بلاها، فيسبوك أبدًا ما يبعتلنا webhook لهذه
  // الصفحة (رسائل الزبائن توصل فيسبوك بصح ما توصلناش، والبوت يبقى ساكت بلا أي خطأ ظاهر).
  async subscribePageToApp(pageId, pageAccessToken) {
    const res = await fetch(
      `${GRAPH_BASE}/${pageId}/subscribed_apps?subscribed_fields=messages,messaging_postbacks,messaging_referrals&access_token=${pageAccessToken}`,
      { method: 'POST' }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success !== true) {
      logger.error('فشل تفعيل webhook لصفحة جديدة (subscribed_apps)', { pageId, status: res.status, data });
      throw new Error(
        `تعذر تفعيل استقبال الرسائل لهذه الصفحة${data?.error?.message ? ` (${data.error.message})` : ''}.`
      );
    }
    logger.info('✅ تم تفعيل webhook للصفحة (subscribed_apps)', { pageId });
    return true;
  }

  // تحقق من توقيع الطلب القادم من فيسبوك (X-Hub-Signature-256) - يحتاج FB_APP_SECRET
  // ملاحظة: التحقق هنا يعتمد على appSecret العام (تطبيقنا نحن). الصفحات المربوطة عبر نفس
  // تطبيقنا (الحالة الطبيعية) توقيعها يتحقق بنفس السر. إذا تاجر استعمل تطبيق فيسبوك منفصل
  // بالكامل لصفحته، لازم إعداد إضافي خاص بيه (تواصل مع الإدارة).
  verifySignature(rawBody, signatureHeader) {
    if (!env.facebook.appSecret) return true; // ما فعّلش التحقق - غير مستحسن لكن مقبول للبداية
    if (!signatureHeader) return false;
    const expected =
      'sha256=' + crypto.createHmac('sha256', env.facebook.appSecret).update(rawBody).digest('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
    } catch (_) {
      return false;
    }
  }
}

module.exports = new FacebookMessengerService();
