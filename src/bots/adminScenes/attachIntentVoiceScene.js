const { Scenes } = require('telegraf');
const VoiceNoteService = require('../../voiceNotes/VoiceNoteService');
const { settingsMenu, cancelKeyboard } = require('../../ui/adminKeyboards');
const { INTENT_LABELS_AR, voiceConditionKeyboard } = require('../../ui/voiceNoteKeyboards');
const logger = require('../../utils/logger');

// بعد حفظ/حذف رسالة صوتية، إذا كانت هذه النية تتطلب معرفة منتج محدد (سعر/ضمان/ألوان/مقارنة...)
// نعرض للتاجر خيار "شروط التشغيل": شنو نفعل إذا سأل زبون عن هذا الموضوع بلا ما يحدد منتجًا؟
async function promptConditionsIfNeeded(ctx, storeId, intentKey, label) {
  const conditions = await VoiceNoteService.getConditionsForIntent(storeId, intentKey);
  if (!conditions.requiresProduct) return;
  const currentLabel = { ask: 'سؤال توضيحي', text: 'رسالة نصية', none: 'لا شيء' }[conditions.noProductAction] || 'سؤال توضيحي';
  await ctx.reply(
    `⚙️ "${label}" تحتاج معرفة منتج محدد. الإعداد الحالي إذا لم يُعرف المنتج: ${currentLabel}.\nتقدر تبدّله من هنا، أو من لوحة التحكم على الموقع (فيها تقدر تكتب نصًا مخصصًا):`,
    voiceConditionKeyboard(intentKey)
  );
}

const ATTACH_INTENT_VOICE_SCENE_ID = 'ATTACH_INTENT_VOICE_SCENE';

function isCancel(ctx) {
  return ctx.message?.text === '❌ إلغاء';
}

// ATTACH_INTENT_VOICE_SCENE: بعد اختيار التاجر للنية (زر Inline من voiceNoteController)، هذا
// السيناريو ينتظر رسالة صوتية واحدة ويحفظها كرد صوتي عام لتلك النية لكل زبائن المتجر.
// كتابة "بدون" تحذف الرسالة الصوتية الحالية (رجوع للرد النصي الافتراضي).
const attachIntentVoiceScene = new Scenes.WizardScene(
  ATTACH_INTENT_VOICE_SCENE_ID,
  async (ctx) => {
    const { intentKey } = ctx.scene.state;
    const label = INTENT_LABELS_AR[intentKey] || intentKey;
    await ctx.reply(
      `🎙️ أرسل رسالة صوتية لـ "${label}" (أو اكتب "بدون" لحذف الرسالة الصوتية الحالية والرجوع للرد النصي):`,
      cancelKeyboard
    );
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (isCancel(ctx)) {
      await ctx.reply('تم الإلغاء.', settingsMenu);
      return ctx.scene.leave();
    }
    const { storeId, intentKey } = ctx.scene.state;
    const label = INTENT_LABELS_AR[intentKey] || intentKey;

    if (ctx.message?.text?.trim() === 'بدون') {
      await VoiceNoteService.removeFromIntent(storeId, intentKey);
      await ctx.reply(`🗑 تم حذف الرسالة الصوتية لـ "${label}".`, settingsMenu);
      await promptConditionsIfNeeded(ctx, storeId, intentKey, label);
      return ctx.scene.leave();
    }

    if (!ctx.message?.voice) {
      await ctx.reply('أرسل رسالة صوتية، أو اكتب "بدون"، أو اضغط "❌ إلغاء".', cancelKeyboard);
      return;
    }

    try {
      const fileId = ctx.message.voice.file_id;
      const fileLink = await ctx.telegram.getFileLink(fileId);
      await VoiceNoteService.attachToIntent(storeId, intentKey, {
        fileId,
        url: fileLink.href,
        duration: ctx.message.voice.duration || null,
      });
      await ctx.reply(`✅ تم حفظ الرسالة الصوتية لـ "${label}". ستُرسل تلقائيًا لأي زبون يسأل عن هذا الموضوع.`, settingsMenu);
      await promptConditionsIfNeeded(ctx, storeId, intentKey, label);
    } catch (err) {
      logger.error('فشل حفظ رسالة صوتية عامة لنية', { storeId, intentKey, error: err.message });
      await ctx.reply(`⚠️ ${err.message || 'تعذر حفظ الرسالة الصوتية، حاول مرة أخرى.'}`, settingsMenu);
    }
    return ctx.scene.leave();
  }
);

module.exports = { attachIntentVoiceScene, ATTACH_INTENT_VOICE_SCENE_ID };
