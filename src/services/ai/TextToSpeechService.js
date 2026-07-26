const crypto = require('crypto');
const { env } = require('../../config/env');
const { VOICE_GENDER } = require('../../config/aiSettings');
const VoiceBlobRepository = require('../../voiceNotes/VoiceBlobRepository');
const logger = require('../../utils/logger');

// تحويل نص إلى صوت طبيعي (المتطلب #15) عبر Groq (نموذج Orpheus العربي - لهجة سعودية،
// أقرب صوت عربي طبيعي متوفر حاليًا عبر Groq). ملاحظة: "playai-tts-arabic" القديم توقف
// (decommissioned) واستُبدل بـ canopylabs/orpheus-arabic-saudi، لذلك الاسم أدناه قابل
// للتغيير من متغيرات البيئة بلا الحاجة لتعديل الكود إذا غيّرت Groq الاسم مجددًا مستقبلاً.
const GROQ_SPEECH_URL = 'https://api.groq.com/openai/v1/audio/speech';

// صوتان جاهزان (رجل/امرأة) - حسب توفر Groq الحالي لنموذج Orpheus العربي.
const VOICE_BY_GENDER = {
  [VOICE_GENDER.MALE]: process.env.GROQ_TTS_VOICE_MALE || 'abdullah',
  [VOICE_GENDER.FEMALE]: process.env.GROQ_TTS_VOICE_FEMALE || 'aisha',
};

class TextToSpeechService {
  isEnabled() {
    return Boolean(env.groq.apiKey);
  }

  // ينشئ صوتًا من نص عربي ويخزّنه بشكل دائم، يرجع رابط عام صالح للإرسال عبر Messenger.
  // gender: 'male' | 'female' - يُقرأ من aiSettings.voiceGender الخاص بالمتجر.
  async synthesizeToUrl(storeId, text, { gender = VOICE_GENDER.MALE, speed = 1.0 } = {}) {
    if (!this.isEnabled()) throw new Error('خدمة تحويل النص لصوت غير مفعّلة (GROQ_API_KEY غير موجود)');
    if (!text || !text.trim()) throw new Error('لا يوجد نص لتحويله لصوت');

    const voice = VOICE_BY_GENDER[gender] || VOICE_BY_GENDER[VOICE_GENDER.MALE];
    const model = process.env.GROQ_TTS_MODEL || 'canopylabs/orpheus-arabic-saudi';

    const res = await fetch(GROQ_SPEECH_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.groq.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        voice,
        input: text.slice(0, 800), // حماية من نصوص طويلة جدًا (تكلفة + حد حجم التخزين تحت)
        response_format: 'wav',
        speed,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      logger.error('فشل توليد الصوت عبر Groq TTS', { status: res.status, errText });
      throw new Error('تعذّر توليد الرد الصوتي حاليًا');
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length > VoiceBlobRepository.MAX_RAW_BYTES) {
      // نص طويل جدًا أنتج ملفًا أكبر من حد التخزين - بدل فشل صامت، نُعلم المستدعي صراحة
      // حتى يسقط تلقائيًا لرد نصي (راجع AIReplyDeliveryService).
      throw new Error('الرد طويل جدًا لتحويله لصوت');
    }

    const blobId = `ai_tts_${storeId}_${crypto.randomUUID()}`;
    await VoiceBlobRepository.save(blobId, { base64: buffer.toString('base64'), mimeType: 'audio/wav' });
    return `${env.appBaseUrl}/media/voice/${blobId}`;
  }
}

module.exports = new TextToSpeechService();
