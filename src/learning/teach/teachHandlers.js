const { Scenes, Markup } = require('telegraf');
const ConversationLogService = require('../conversationLog/ConversationLogService');
const ConversationLogRepository = require('../conversationLog/ConversationLogRepository');
const TrainingService = require('../training/TrainingService');
const DecisionService = require('../decisions/DecisionService');
const { normalizeMessage } = require('../normalization/textNormalizer');
const logger = require('../../utils/logger');

const TEACH_EDIT_SCENE_ID = 'TEACH_EDIT_SCENE';

// سيناريو (Wizard) قصير: يُدخله التاجر بعد ضغط "✏ تعديل الرد"، يطلب منه كتابة الرد الصحيح
// كرسالة عادية، ثم يحفظه كمثال تعلّم عبر TrainingService، ويعرض عليه خيار تحويله لقرار ثابت
// (دفتر قرارات التاجر) إذا كان يرى أن هذا سؤال سيتكرر.
const teachEditScene = new Scenes.WizardScene(
  TEACH_EDIT_SCENE_ID,
  async (ctx) => {
    await ctx.reply('✏️ اكتب الرد الصحيح الذي تريد أن يتعلمه البوت:');
    return ctx.wizard.next();
  },
  async (ctx) => {
    const finalReply = (ctx.message?.text || '').trim();
    if (!finalReply) {
      await ctx.reply('⚠️ من فضلك اكتب نص الرد.');
      return;
    }
    const { logId } = ctx.wizard.state;
    const storeId = ctx.from.id;

    try {
      const logEntry = await ConversationLogRepository.findById(storeId, logId);
      if (!logEntry) {
        await ctx.reply('⚠️ تعذر إيجاد هذه المحادثة (قد تكون قديمة جدًا).');
        return ctx.scene.leave();
      }

      await ConversationLogService.markEdited(storeId, logId, finalReply);
      await TrainingService.recordEdit(storeId, {
        customerMessage: logEntry.customerMessage,
        aiReply: logEntry.botReply,
        finalReply,
        questionType: logEntry.intent || 'general',
      });

      await ctx.reply('✅ تم! البوت تعلّم هذا الرد وسيستعمل أسلوبك تدريجيًا فـ الأسئلة المشابهة.');
      await ctx.reply(
        'هل تحب تحوّل هذا لقرار ثابت يُستعمل تلقائيًا فـ كل سؤال مشابه مستقبلاً؟',
        Markup.inlineKeyboard([
          Markup.button.callback('📒 نعم، احفظه كقرار ثابت', `teach:decide:${logId}`),
          Markup.button.callback('لا، شكرًا', 'teach:skip'),
        ])
      );
    } catch (err) {
      logger.error('فشل حفظ تعديل التاجر (علمني)', { storeId, error: err.message });
      await ctx.reply('⚠️ حدث خطأ أثناء حفظ التعديل، حاول مرة أخرى.');
    }
    return ctx.scene.leave();
  }
);

// يسجّل كل معالجات أزرار "علمني" على بوت التاجر (Telegraf). يُستدعى مرة واحدة من adminBot.js
function registerTeachHandlers(bot) {
  bot.action(/teach:good:(.+)/, async (ctx) => {
    const logId = ctx.match[1];
    const storeId = ctx.from.id;
    try {
      const logEntry = await ConversationLogRepository.findById(storeId, logId);
      if (logEntry) {
        await ConversationLogService.markApproved(storeId, logId);
        await TrainingService.recordApproval(storeId, {
          customerMessage: logEntry.customerMessage,
          aiReply: logEntry.botReply,
          questionType: logEntry.intent || 'general',
        });
      }
      await ctx.answerCbQuery('✔ تم، شكرًا!');
      await ctx.editMessageReplyMarkup(); // نزيل الأزرار بعد الاختيار
    } catch (err) {
      logger.error('فشل تسجيل موافقة التاجر (علمني)', { storeId, error: err.message });
      await ctx.answerCbQuery('⚠️ حدث خطأ، حاول مرة أخرى.');
    }
  });

  bot.action(/teach:edit:(.+)/, async (ctx) => {
    const logId = ctx.match[1];
    await ctx.answerCbQuery();
    await ctx.editMessageReplyMarkup(); // نزيل الأزرار حتى ما يُضغط عليها مرتين
    return ctx.scene.enter(TEACH_EDIT_SCENE_ID, { logId });
  });

  // تحويل التعديل الأخير لقرار ثابت (دفتر القرارات) - اختياري، يقترحه البوت بعد كل تعديل
  bot.action(/teach:decide:(.+)/, async (ctx) => {
    const logId = ctx.match[1];
    const storeId = ctx.from.id;
    try {
      const logEntry = await ConversationLogRepository.findById(storeId, logId);
      if (!logEntry) return ctx.answerCbQuery('⚠️ تعذر إيجاد المحادثة');
      const { normalized } = normalizeMessage(logEntry.customerMessage);
      await DecisionService.recordDecision(storeId, {
        question: logEntry.customerMessage,
        normalizedQuestion: normalized,
        decisionText: logEntry.finalReply,
        questionType: logEntry.intent || 'general',
      });
      await ctx.answerCbQuery('📒 تم الحفظ فـ دفتر القرارات');
      await ctx.editMessageReplyMarkup();
    } catch (err) {
      logger.error('فشل حفظ القرار الثابت', { storeId, error: err.message });
      await ctx.answerCbQuery('⚠️ حدث خطأ');
    }
  });

  bot.action('teach:skip', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageReplyMarkup();
  });
}

module.exports = { registerTeachHandlers, teachEditScene, TEACH_EDIT_SCENE_ID };
