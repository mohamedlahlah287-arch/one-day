const { env } = require('../config/env');
const logger = require('../utils/logger');

// AIMediaService: خدمة اختيارية (تحتاج GROQ_API_KEY في المتغيرات).
// تحوّل الرسائل الصوتية لنص (Whisper) وتحلل الصور (نموذج رؤية) عبر Groq API.
// إذا ما كانش المفتاح موجودًا، isEnabled() ترجع false والبوت يرسل رسالة بديلة بدل ما يحاول.
// ملاحظة: أسماء النماذج (whisperModel / visionModel) قابلة للتغيير من متغيرات البيئة
// بلا الحاجة لتعديل الكود، لأن Groq يحدّث أسماء نماذجه من وقت لآخر.

const GROQ_BASE = 'https://api.groq.com/openai/v1';

// qwen3.6-27b (والعديد من نماذج Groq الحديثة) هي "نماذج تفكير" (reasoning models) - كتبعت
// أحيانًا كتلة <think>...</think> تحتوي تفكيرها الداخلي قبل الجواب النهائي. إذا ما نظفناهاش،
// هذا التفكير الداخلي (بالإنجليزية، منسق بـ Markdown) يوصل للزبون مباشرة وهذا خطأ فادح.
// هذه الدالة تشيل أي كتلة تفكير + رموز Markdown، وتخلي فقط الجواب النهائي الصافي.
function cleanAIOutput(text) {
  if (!text) return '';
  let out = String(text);
  out = out.replace(/<think>[\s\S]*?<\/think>/gi, ''); // كتلة تفكير كاملة
  out = out.replace(/<\/?think>/gi, ''); // فـ حالة كتلة ناقصة (اتقطعت بسبب max_tokens)
  out = out.replace(/\*\*/g, ''); // bold markdown
  out = out.replace(/^#+\s*/gm, ''); // عناوين markdown
  out = out.replace(/^\d+\.\s*/gm, ''); // قوائم مرقّمة
  return out.trim();
}

class AIMediaService {
  isEnabled() {
    return Boolean(env.groq.apiKey);
  }

  // fileUrl: رابط الملف الصوتي (من ctx.telegram.getFileLink)
  async transcribeVoice(fileUrl) {
    const audioRes = await fetch(fileUrl);
    if (!audioRes.ok) throw new Error(`تعذر تحميل الملف الصوتي: ${audioRes.status}`);
    const audioBuffer = await audioRes.arrayBuffer();

    const form = new FormData();
    form.append('file', new Blob([audioBuffer]), 'voice.ogg');
    form.append('model', env.groq.whisperModel);
    form.append('language', 'ar');

    const res = await fetch(`${GROQ_BASE}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.groq.apiKey}` },
      body: form,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      logger.error('فشل تحويل الصوت لنص عبر Groq', { status: res.status, errText });
      throw new Error('Groq transcription failed');
    }
    const data = await res.json();
    return (data.text || '').trim();
  }

  // نداء عام لـ chat/completions - مشترك بين describeImage و classifyIntent و matchProduct.
  // ملاحظة: تم حذف reasoning_effort لأنه غير مدعوم فـ كل النماذج (بعضها كيرفض القيمة 'none'،
  // وبعضها كيرفض الحقل بالكامل)، وكان كيسبب أخطاء 400 من Groq. تنظيف كتلة <think> يتكفل بيه
  // cleanAIOutput() أصلاً.
  async _chatCompletion(messages, { maxTokens = 200, temperature = 0.3, model = env.groq.visionModel } = {}) {
    const res = await fetch(`${GROQ_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.groq.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      logger.error('فشل نداء Groq', { status: res.status, errText });
      throw new Error('Groq request failed');
    }
    const data = await res.json();
    return cleanAIOutput(data.choices?.[0]?.message?.content);
  }

  // fileUrl: رابط الصورة (من ctx.telegram.getFileLink أو رابط Messenger المباشر)
  async describeImage(fileUrl) {
    const messages = [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text:
              'صف هذه الصورة بجملة أو جملتين بالعربية فقط. اذكر نوع المنتج، اللون، والتفاصيل ' +
              'المميزة (شعار، نمط، شكل) إذا وجدت. لا تشرح تفكيرك ولا تستعمل عناوين أو Markdown أو ' +
              'قوائم مرقّمة - فقط الوصف النهائي مباشرة، بلا أي مقدمة.',
          },
          { type: 'image_url', image_url: { url: fileUrl } },
        ],
      },
    ];
    const description = await this._chatCompletion(messages, { maxTokens: 150 });
    return description || 'لم أتمكن من تحليل الصورة.';
  }

  // يقارن وصف صورة الزبون مع منتجات المتجر ويرجع id المنتج الأقرب، أو null إذا ماكاين حتى تطابق.
  // أدق من المطابقة النصية البسيطة (findProductByName) لأنه يفهم المعنى (لون، نوع، تصميم)
  // وليس فقط تطابق حرفي فـ الاسم.
  async matchProductFromDescription(description, products) {
    if (!products.length) return null;
    const catalog = products
      .map((p, i) => {
        const parts = [p.name, p.description, p.features, p.visualDescription].filter(Boolean);
        return `${i + 1}) ${parts.join(' - ')}`;
      })
      .join('\n');
    const messages = [
      {
        role: 'user',
        content:
          `هذا وصف صورة أرسلها زبون:\n"${description}"\n\nوهذه قائمة منتجات المتجر:\n${catalog}\n\n` +
          'إذا كان الوصف يطابق أحد المنتجات (نفس النوع تقريبًا، حتى لو اللون أو التفاصيل الدقيقة ' +
          'مختلفة قليلاً)، أجب برقم المنتج فقط (مثال: 2). إذا ماكاين حتى منتج قريب، أجب بكلمة NONE فقط. ' +
          'بلا أي شرح أو نص إضافي.',
      },
    ];
    const answer = await this._chatCompletion(messages, { maxTokens: 10, temperature: 0, model: env.groq.textModel });
    const num = parseInt(answer.match(/\d+/)?.[0], 10);
    if (!num || num < 1 || num > products.length) return null;
    return products[num - 1];
  }

  // يصنّف نية الزبون من نص حر (يفهم أي صياغة أو كلمة جزائرية حتى لو ماكانتش فـ قائمة الكلمات
  // المفتاحية الثابتة فـ responseEngine.js) - يُستعمل فقط كخط دفاع ثاني إذا فشلت المطابقة السريعة.
  async classifyIntent(text, allowedIntents) {
    const messages = [
      {
        role: 'user',
        content:
          `صنّف نية هذه الرسالة من زبون جزائري (عربية دارجة): "${text}"\n\n` +
          `اختر كلمة واحدة فقط من هذه القائمة: ${allowedIntents.join(', ')}, unknown\n` +
          'أجب بالكلمة فقط بلا أي شرح.',
      },
    ];
    const answer = (
      await this._chatCompletion(messages, { maxTokens: 8, temperature: 0, model: env.groq.textModel })
    )
      .toLowerCase()
      .trim();
    return allowedIntents.includes(answer) ? answer : null;
  }
}

module.exports = new AIMediaService();
