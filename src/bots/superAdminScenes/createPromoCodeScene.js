const { Scenes } = require('telegraf');
const PromoCodeService = require('../../services/PromoCodeService');
const { toUserMessage } = require('../../middlewares/errorHandler');
const { mainMenu, cancelKeyboard } = require('../../ui/superAdminKeyboards');

function isCancel(ctx) {
  return ctx.message?.text === '❌ إلغاء';
}

async function cancelFlow(ctx) {
  await ctx.reply('تم الإلغاء.', mainMenu);
  return ctx.scene.leave();
}

function parseYesNo(text) {
  const t = (text || '').trim();
  if (t === 'نعم') return true;
  if (t === 'لا') return false;
  return null;
}

function parsePositiveInt(text) {
  const n = Number((text || '').trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

const createPromoCodeScene = new Scenes.WizardScene(
  'CREATE_PROMO_CODE_SCENE',
  async (ctx) => {
    ctx.wizard.state.data = {};
    await ctx.reply('⏱️ كم عدد ساعات العرض؟ (مدة صلاحية المميزات بعد ما يستعمل التاجر الكود)', cancelKeyboard);
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (isCancel(ctx)) return cancelFlow(ctx);
    const hours = parsePositiveInt(ctx.message?.text);
    if (!hours) {
      await ctx.reply('⚠️ أرسل رقمًا صحيحًا أكبر من 0 (مثال: 24).');
      return;
    }
    ctx.wizard.state.data.trialHours = hours;
    await ctx.reply('📅 كم عدد أيام صلاحية الكود نفسه؟ (كم يوم يقدر أي تاجر يستعمله)');
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (isCancel(ctx)) return cancelFlow(ctx);
    const days = parsePositiveInt(ctx.message?.text);
    if (!days) {
      await ctx.reply('⚠️ أرسل رقمًا صحيحًا أكبر من 0 (مثال: 7).');
      return;
    }
    ctx.wizard.state.data.validForDays = days;
    await ctx.reply('💬 كم عدد الرسائل المسموحة خلال العرض؟');
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (isCancel(ctx)) return cancelFlow(ctx);
    const messages = parsePositiveInt(ctx.message?.text);
    if (!messages) {
      await ctx.reply('⚠️ أرسل رقمًا صحيحًا أكبر من 0 (مثال: 500).');
      return;
    }
    ctx.wizard.state.data.messageLimit = messages;
    await ctx.reply('🎙️ هل يشمل العرض الرد الصوتي؟ اكتب "نعم" أو "لا".');
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (isCancel(ctx)) return cancelFlow(ctx);
    const v = parseYesNo(ctx.message?.text);
    if (v === null) {
      await ctx.reply('⚠️ اكتب "نعم" أو "لا" فقط.');
      return;
    }
    ctx.wizard.state.data.voiceReply = v;
    await ctx.reply('🖼️ هل يشمل العرض التعرف على الصور؟ اكتب "نعم" أو "لا".');
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (isCancel(ctx)) return cancelFlow(ctx);
    const v = parseYesNo(ctx.message?.text);
    if (v === null) {
      await ctx.reply('⚠️ اكتب "نعم" أو "لا" فقط.');
      return;
    }
    ctx.wizard.state.data.imageRecognition = v;
    await ctx.reply('📊 هل يشمل العرض الإحصائيات الكاملة؟ اكتب "نعم" أو "لا".');
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (isCancel(ctx)) return cancelFlow(ctx);
    const v = parseYesNo(ctx.message?.text);
    if (v === null) {
      await ctx.reply('⚠️ اكتب "نعم" أو "لا" فقط.');
      return;
    }
    ctx.wizard.state.data.fullAnalytics = v;
    await ctx.reply('🔢 كم أقصى عدد مرات استعمال للكود؟ اكتب رقمًا، أو اكتب "بدون" لعدد غير محدود.');
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (isCancel(ctx)) return cancelFlow(ctx);
    const raw = (ctx.message?.text || '').trim();
    let maxUses = null;
    if (raw !== 'بدون') {
      maxUses = parsePositiveInt(raw);
      if (!maxUses) {
        await ctx.reply('⚠️ أرسل رقمًا صحيحًا أكبر من 0، أو اكتب "بدون".');
        return;
      }
    }

    const d = ctx.wizard.state.data;
    const plan = {
      id: 'promo',
      name: 'عرض مؤقت',
      messageLimit: d.messageLimit,
      productLimit: null,
      features: {
        textReply: true,
        voiceReply: d.voiceReply,
        imageRecognition: d.imageRecognition,
        fullAnalytics: d.fullAnalytics,
        abandonedCartRecovery: d.fullAnalytics,
        staffAccounts: d.fullAnalytics,
      },
    };

    try {
      const code = await PromoCodeService.createCode({
        plan,
        trialHours: d.trialHours,
        validForDays: d.validForDays,
        maxUses,
      });
      await ctx.reply(
        `✅ تم إنشاء الكود:\n\n\`${code}\`\n\n` +
          `أعطيه لأي تاجر تريده، يكتبه فـ بوت التاجر (🎟️ استعمال كود عرض) وياخذ العرض مباشرة.`,
        { parse_mode: 'Markdown', ...mainMenu }
      );
    } catch (err) {
      await ctx.reply(`⚠️ ${toUserMessage(err)}`, mainMenu);
    }
    return ctx.scene.leave();
  }
);

createPromoCodeScene.hears('❌ إلغاء', async (ctx) => {
  await ctx.reply('تم الإلغاء.', mainMenu);
  return ctx.scene.leave();
});

module.exports = createPromoCodeScene;
