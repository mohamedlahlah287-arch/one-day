const AIMediaService = require('../AIMediaService');
const { env } = require('../../config/env');
const OrderService = require('../OrderService');
const ProductService = require('../ProductService');
const RatingService = require('../RatingService');
const StoreRepository = require('../../repositories/StoreRepository');
const { mergeWithDefaults } = require('../../config/aiSettings');
const logger = require('../../utils/logger');

// AIAdvisorService: "مساعد الذكاء الاصطناعي" (المتطلب #7) - ماشي بوت رد على الزبائن، هذا
// موجّه للتاجر نفسه من لوحة التحكم: يحلل بيانات متجره الفعلية ويجاوب على أسئلته، ويكتب له
// محتوى تسويقي (منشورات، حملات، أوصاف منتجات، ردود مقترحة) بناءً على نفس البيانات.
class AIAdvisorService {
  isEnabled() {
    return AIMediaService.isEnabled();
  }

  // يبني ملخص نصي مختصر لحالة المتجر الحالية (طلبات، منتجات، تقييمات) يُستعمل كسياق لأي
  // سؤال أو محتوى - هذا ما يجعل الإجابات "حقيقية" (مبنية على بيانات المتجر) بدل عامة.
  async _buildStoreContext(storeId) {
    const [store, stats, topProducts, products, ratingAvg] = await Promise.all([
      StoreRepository.findById(storeId),
      OrderService.getStats(storeId).catch(() => null),
      OrderService.getTopProducts(storeId, 5).catch(() => []),
      ProductService.listProducts(storeId).catch(() => []),
      RatingService.getAverage(storeId).catch(() => null),
    ]);

    const lines = [
      `اسم المتجر: ${store?.storeName || 'غير معروف'}`,
      stats ? `إجمالي الطلبات: ${stats.totalOrders} (الملغاة: ${stats.cancelledOrders})` : null,
      stats?.byStatus ? `تفصيل الحالات: ${JSON.stringify(stats.byStatus)}` : null,
      topProducts?.length ? `أكثر المنتجات مبيعًا: ${topProducts.map((p) => p.name || p.productId).join('، ')}` : null,
      `عدد المنتجات فـ الكتالوج: ${products.length}`,
      ratingAvg ? `متوسط تقييم الزبائن: ${ratingAvg.average ?? ratingAvg} / 5` : null,
    ].filter(Boolean);

    return { store, contextText: lines.join('\n') };
  }

  // يجاوب على سؤال حر من التاجر عن متجره ("ليش قل البيع هاذ الأسبوع؟"...) بناءً على بيانات
  // حقيقية، ماشي تخمين عام.
  async ask(storeId, question) {
    if (!this.isEnabled()) throw new Error('مساعد الذكاء الاصطناعي غير مفعّل (يحتاج GROQ_API_KEY)');
    const { contextText } = await this._buildStoreContext(storeId);

    const messages = [
      {
        role: 'system',
        content:
          'أنت مستشار تجارة إلكترونية جزائري خبير، تجاوب بالعربية (يمكن دارجة خفيفة) بإيجاز ووضوح. ' +
          'استعمل فقط البيانات المعطاة لك، وإذا كانت البيانات غير كافية للإجابة بدقة، قل ذلك صراحة ' +
          'واقترح ما يمكن للتاجر فعله لمعرفة الإجابة. لا تخترع أرقامًا غير موجودة فـ البيانات.',
      },
      {
        role: 'user',
        content: `بيانات المتجر الحالية:\n${contextText}\n\nسؤال التاجر: ${question}`,
      },
    ];

    const answer = await AIMediaService._chatCompletion(messages, {
      maxTokens: 500,
      temperature: 0.4,
      model: env.groq.textModel,
    });
    return answer || 'تعذّر توليد إجابة الآن، حاول مرة أخرى.';
  }

  // توليد محتوى تسويقي/نصي - type يحدد نوع المحتوى المطلوب (المتطلب #7 و#8)
  async generateContent(storeId, type, params = {}) {
    if (!this.isEnabled()) throw new Error('مساعد الذكاء الاصطناعي غير مفعّل (يحتاج GROQ_API_KEY)');

    const { store } = await this._buildStoreContext(storeId);
    const storeName = store?.storeName || 'المتجر';
    const prompts = {
      product_description: () =>
        `اكتب وصفًا تسويقيًا جذابًا (3-4 أسطر) بالعربية لمنتج اسمه "${params.name}" ` +
        `${params.features ? `بمميزاته: ${params.features}` : ''} ${params.price ? `سعره ${params.price} دج` : ''}. ` +
        'أسلوب مقنع لكن بلا مبالغة، يناسب زبون جزائري. بلا عناوين أو Markdown، فقط الوصف مباشرة.',

      ad_post: () =>
        `اكتب منشور إعلاني قصير (سطرين لثلاثة + إيموجي مناسبة) لمتجر "${storeName}" على فيسبوك/انستغرام ` +
        `للترويج لـ "${params.name || 'منتج جديد'}"${params.offer ? ` مع عرض: ${params.offer}` : ''}. أسلوب حماسي وجذاب.`,

      messenger_campaign: () =>
        `اكتب رسالة حملة Messenger قصيرة (2-3 أسطر) لزبائن متجر "${storeName}" ` +
        `${params.audience ? `موجهة لـ: ${params.audience}` : 'موجهة لكل الزبائن'}، الهدف: ${params.goal || 'تنشيط الشراء'}. ` +
        'ودودة ومباشرة، تنتهي بدعوة واضحة للفعل.',

      whatsapp_campaign: () =>
        `اكتب رسالة واتساب قصيرة وودودة (2-3 أسطر) لزبائن متجر "${storeName}" ` +
        `${params.audience ? `موجهة لـ: ${params.audience}` : ''}، الهدف: ${params.goal || 'تنشيط الشراء'}.`,

      reply_suggestion: () =>
        `زبون كتب هذه الرسالة لمتجر "${storeName}": "${params.customerMessage}"\n` +
        'اقترح رد مقنع ومهني بالعربية (سطرين كحد أقصى) يجيب على استفساره ويشجعه على الشراء بلا إلحاح مبالغ فيه.',

      discount_suggestion: () =>
        `بناءً على بيانات المتجر التالية، اقترح خصمًا أو عرضًا مناسبًا (نسبة أو نوع العرض) ` +
        `لتحفيز المبيعات، مع سبب مختصر (سطرين كحد أقصى):\n${params.contextHint || ''}`,
    };

    const buildPrompt = prompts[type];
    if (!buildPrompt) throw new Error(`نوع محتوى غير معروف: ${type}`);

    const messages = [{ role: 'user', content: buildPrompt() }];
    const content = await AIMediaService._chatCompletion(messages, {
      maxTokens: 300,
      temperature: 0.7,
      model: env.groq.textModel,
    });
    if (!content) throw new Error('تعذّر توليد المحتوى الآن');
    logger.info('AIAdvisorService: تم توليد محتوى', { storeId, type });
    return content;
  }

  // تحليل سبب انخفاض المبيعات - حالة خاصة من ask() لكن بسؤال مُعد مسبقًا (اختصار للواجهة)
  async analyzeSalesDrop(storeId) {
    return this.ask(storeId, 'حلل بيانات متجري وأخبرني إذا كان هناك مؤشر على انخفاض المبيعات، ولماذا قد يحدث ذلك، واقترح خطوتين عمليتين لتحسين الوضع.');
  }

  async analyzeOrderRejections(storeId) {
    return this.ask(storeId, 'حلل نسبة الطلبات الملغاة/المرفوضة مقارنة بالإجمالي، واقترح أسبابًا محتملة وحلولًا عملية لتقليلها.');
  }
}

module.exports = new AIAdvisorService();
