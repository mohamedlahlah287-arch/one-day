const StoreRepository = require('../../repositories/StoreRepository');
const FacebookMessengerService = require('../FacebookMessengerService');
const TextToSpeechService = require('./TextToSpeechService');
const { REPLY_MODE, mergeWithDefaults } = require('../../config/aiSettings');
const logger = require('../../utils/logger');

// AIReplyDeliveryService: نقطة الدخول الوحيدة لإرسال ردود "ديناميكية" (نص AI/fallback/تعلّم -
// ماشي الرسائل الصوتية المسجّلة يدويًا من التاجر لكل نية، تلك تبقى عبر decisionEngine كما هي).
// يطبّق "طريقة الرد" (المتطلب #14): ذكي/دائمًا نص/دائمًا صوت/مخصص، حسب نوع رسالة الزبون
// (نص أو صوت أصلاً قبل أي تحويل).
class AIReplyDeliveryService {
  // outputsFor: يحسب أي الأشكال (نص/صوت) يجب إرسالها، بلا أي استدعاء شبكة - يسهّل اختباره
  outputsFor(aiSettings, inputType) {
    const { replyMode, customReplyMap } = aiSettings;

    if (replyMode === REPLY_MODE.ALWAYS_TEXT) return { text: true, voice: false };
    if (replyMode === REPLY_MODE.ALWAYS_VOICE) return { text: false, voice: true };

    if (replyMode === REPLY_MODE.CUSTOM) {
      const map = inputType === 'voice' ? customReplyMap.voiceIn : customReplyMap.textIn;
      // إذا التاجر ما فعّلش لا نص ولا صوت بالخطأ لهذه الحالة، نرجع لنص كافتراضي آمن
      if (!map.text && !map.voice) return { text: true, voice: false };
      return { text: Boolean(map.text), voice: Boolean(map.voice) };
    }

    // SMART (الافتراضي): نص للنص، صوت للصوت
    return inputType === 'voice' ? { text: false, voice: true } : { text: true, voice: false };
  }

  // يرسل رد واحد (text) للزبون بالشكل المناسب حسب إعدادات المتجر ونوع رسالة الزبون الأصلية.
  // storeId, psid: نفس معطيات FacebookMessengerService المعتادة.
  // inputType: 'text' | 'voice' - نوع رسالة الزبون الأصلية (قبل أي تحويل من صوت لنص).
  async sendSmartReply(storeId, psid, text, { inputType = 'text' } = {}) {
    if (!text) return;
    const store = await StoreRepository.findById(storeId);
    const aiSettings = mergeWithDefaults(store?.aiSettings);

    // ميزة الرد الصوتي مرتبطة بباقة المتجر (store.features.voiceReply) بلا تغيير - نفس الحاجز
    // المستعمل حاليًا فـ mediaController.js لباقي وظائف الصوت.
    const voiceAllowedByPlan = Boolean(store?.features?.voiceReply) && TextToSpeechService.isEnabled();
    const outputs = this.outputsFor(aiSettings, inputType);

    if (outputs.voice && voiceAllowedByPlan) {
      try {
        const audioUrl = await TextToSpeechService.synthesizeToUrl(storeId, text, {
          gender: aiSettings.voiceGender,
          speed: aiSettings.speed,
        });
        await FacebookMessengerService.sendAudio(storeId, psid, audioUrl);
        if (outputs.text) await FacebookMessengerService.sendText(storeId, psid, text);
        return;
      } catch (err) {
        logger.error('فشل إرسال رد صوتي، سيتم الرجوع لرد نصي', { storeId, error: err.message });
        // نسقط تلقائيًا لرد نصي بدل ما يبقى الزبون بلا أي رد
      }
    }

    await FacebookMessengerService.sendText(storeId, psid, text);
  }
}

module.exports = new AIReplyDeliveryService();
