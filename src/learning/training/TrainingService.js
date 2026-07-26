const TrainingExampleRepository = require('./TrainingExampleRepository');
const StoreMemoryService = require('../memory/StoreMemoryService');
const StoreDictionaryService = require('../dictionary/StoreDictionaryService');
const { normalizeMessage } = require('../normalization/textNormalizer');
const { INTENT_KEYS } = require('../../engine/responseEngine');
const engine = require('../../engine/responseEngine');
const eventBus = require('../../events/eventBus');
const eventNames = require('../../events/eventNames');
const logger = require('../../utils/logger');

// عدد الأمثلة التي إذا وصلها متجر يُعتبر "أسلوب التاجر" ناضجًا بما يكفي لعرضه فـ الإحصائيات
// (لا يمنع استعمال العبارات المتعلَّمة قبل هذا الرقم، لكنه مؤشر إعلامي للتاجر فقط)
const STYLE_MATURITY_THRESHOLD = 30;

// TrainingService: نقطة الدخول الوحيدة التي يجب أن تستدعيها أي واجهة (زر "علمني"، أو أي
// مكان آخر مستقبلاً) عندما يوافق التاجر على رد أو يعدّله. هذا الملف هو من "يوزّع" التعلّم
// على الوحدات المختصة (ذاكرة، قاموس، دفتر قرارات) - باقي النظام لا يحتاج معرفة التفاصيل.
class TrainingService {
  // يُستدعى عندما يضغط التاجر "✔ الرد ممتاز" - نسجل المثال فقط بلا تغيير الرد
  async recordApproval(storeId, { customerMessage, aiReply, questionType }) {
    await TrainingExampleRepository.recordExample(storeId, {
      customerMessage,
      aiReply,
      finalReply: aiReply,
      questionType,
      wasEdited: false,
    });
  }

  // يُستدعى عندما يعدّل التاجر رد الذكاء الاصطناعي - هنا يحصل التعلّم الفعلي
  async recordEdit(storeId, { customerMessage, aiReply, finalReply, questionType = 'general' }) {
    await TrainingExampleRepository.recordExample(storeId, {
      customerMessage,
      aiReply,
      finalReply,
      questionType,
      wasEdited: true,
    });

    // 1) تعلّم أسلوب التاجر (عبارات متكررة) من الرد النهائي
    await StoreMemoryService.learnFromMerchantEdit(storeId, finalReply);

    // 2) إذا كان السؤال من نوع معروف له "نية" ثابتة (سعر/توصيل/ضمان...)، وكانت رسالة الزبون
    //    تحتوي كلمة غير معروفة (لم يفهمها محرك النوايا)، نحاول تعلّمها تلقائيًا كمرادف محلي
    //    فـ قاموس هذا المتجر (متطلب: "الكلمات الخاصة بعملائه").
    await this._maybeLearnDictionaryTerm(storeId, customerMessage, finalReply);

    eventBus.emit(eventNames.MERCHANT_EDITED_REPLY, { storeId, customerMessage, aiReply, finalReply });

    logger.info('تم تسجيل تعديل التاجر كمثال تعلّم جديد', { storeId, questionType });
  }

  async _maybeLearnDictionaryTerm(storeId, customerMessage, finalReply) {
    const { normalized } = normalizeMessage(customerMessage);
    const existingIntent = engine.detectIntent(customerMessage);
    if (existingIntent !== 'unknown') return; // الكلمة مفهومة أصلاً، لا داعي لتعلّمها كمصطلح جديد

    const impliedIntent = INTENT_KEYS.find((intentKey) =>
      finalReplyImpliesIntent(finalReply, intentKey)
    );
    if (!impliedIntent) return;

    // نأخذ أطول كلمة فـ رسالة الزبون كمرشح للمصطلح الجديد (غالبًا هي الكلمة "الغريبة" - كلمات
    // الأسئلة الشائعة الأخرى مثل "و"، "هل" قصيرة عادة وتُستبعد تلقائيًا بهذا المعيار البسيط)
    const candidateWord = normalized
      .split(/\s+/)
      .filter((w) => w.length >= 3)
      .sort((a, b) => b.length - a.length)[0];
    if (!candidateWord) return;

    await StoreDictionaryService.learnTerm(storeId, candidateWord, {
      meaning: intentToMeaning(impliedIntent),
      intent: impliedIntent,
      source: 'merchant_correction',
    });
  }

  async countRecentExamples(storeId, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    return TrainingExampleRepository.countSince(storeId, since);
  }

  isStyleMature(exampleCount) {
    return exampleCount >= STYLE_MATURITY_THRESHOLD;
  }
}

// فحص بسيط جدًا: هل الرد النهائي للتاجر يحتوي كلمات مفتاحية لنية معينة (يستعمل نفس قاموس
// engine.detectIntent الداخلي بشكل غير مباشر عبر تمرير الرد كأنه "رسالة" لتحليل النية)
function finalReplyImpliesIntent(finalReply, intentKey) {
  return engine.detectIntent(finalReply) === intentKey;
}

function intentToMeaning(intentKey) {
  const meanings = {
    price: 'كم السعر',
    delivery: 'التوصيل',
    buy: 'طلب الشراء',
    warranty: 'الضمان',
    colors: 'الألوان المتوفرة',
    compare: 'المقارنة بين المنتجات',
    greeting: 'ترحيب',
  };
  return meanings[intentKey] || intentKey;
}

module.exports = new TrainingService();
