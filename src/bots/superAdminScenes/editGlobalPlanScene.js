const { Scenes } = require('telegraf');
const PlanService = require('../../services/PlanService');
const { toUserMessage } = require('../../middlewares/errorHandler');
const { mainMenu, cancelKeyboard } = require('../../ui/superAdminKeyboards');
const { PLANS } = require('../../config/plans');

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

// رقم موجب، أو null (غير محدود) - يرجع { ok, value }
function parseLimitInput(text) {
  const t = (text || '').trim();
  if (t.includes('غير')) return { ok: true, value: null };
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return { ok: false, value: null };
  return { ok: true, value: n };
}

// تُستدعى بـ ctx.scene.enter('EDIT_GLOBAL_PLAN_SCENE', { planId }) لتعديل باقة عامة (starter/growth/pro/business)
// السعر والحدود والمميزات تُطبّق على كل التجار الجدد اللي يختارون هذه الباقة من الآن فصاعدًا.
// (يسقسي سؤال واحد فـ كل مرة بدل رسالة واحدة بكل التفاصيل مفصولة بفواصل)
const editGlobalPlanScene = new Scenes.WizardScene(
  'EDIT_GLOBAL_PLAN_SCENE',
  async (ctx) => {
    const { planId } = ctx.scene.state;
    const base = PLANS[planId];
    if (!base) {
      await ctx.reply('⚠️ باقة غير معروفة.', mainMenu);
      return ctx.scene.leave();
    }
    ctx.wizard.state.data = {};
    await ctx.reply(
      `تعديل باقة "${base.name}"\n\n` +
        'اكتب "افتراضي" فـ أي وقت لإرجاع هذه الباقة للقيم الأصلية، أو جاوب على الأسئلة الجاية وحدة وحدة.\n\n' +
        '💰 شحال السعر بالدينار؟',
      cancelKeyboard
    );
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (isCancel(ctx)) return cancelFlow(ctx);
    const { planId } = ctx.scene.state;
    if ((ctx.message?.text || '').trim() === 'افتراضي') {
      try {
        await PlanService.resetPlanOverride(planId);
        await ctx.reply('✅ تم إرجاع الباقة للقيم الافتراضية.', mainMenu);
      } catch (err) {
        await ctx.reply(`⚠️ ${toUserMessage(err)}`, mainMenu);
      }
      return ctx.scene.leave();
    }
    const price = Number((ctx.message?.text || '').trim());
    if (!Number.isFinite(price) || price < 0) {
      await ctx.reply('⚠️ أرسل رقمًا صحيحًا (مثال: 2500).');
      return;
    }
    ctx.wizard.state.data.price = price;
    await ctx.reply('💬 كم عدد الرسائل المسموحة؟ اكتب رقمًا، أو اكتب "غير محدود".');
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (isCancel(ctx)) return cancelFlow(ctx);
    const r = parseLimitInput(ctx.message?.text);
    if (!r.ok) {
      await ctx.reply('⚠️ أرسل رقمًا صحيحًا أكبر من 0، أو اكتب "غير محدود".');
      return;
    }
    ctx.wizard.state.data.messageLimit = r.value;
    await ctx.reply('📦 كم أقصى عدد منتجات؟ اكتب رقمًا، أو اكتب "غير محدود".');
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (isCancel(ctx)) return cancelFlow(ctx);
    const r = parseLimitInput(ctx.message?.text);
    if (!r.ok) {
      await ctx.reply('⚠️ أرسل رقمًا صحيحًا أكبر من 0، أو اكتب "غير محدود".');
      return;
    }
    ctx.wizard.state.data.productLimit = r.value;
    await ctx.reply('📅 كم عدد أيام صلاحية الباقة؟');
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (isCancel(ctx)) return cancelFlow(ctx);
    const days = Number((ctx.message?.text || '').trim());
    if (!Number.isFinite(days) || days <= 0) {
      await ctx.reply('⚠️ أرسل رقمًا صحيحًا أكبر من 0 (مثال: 30).');
      return;
    }
    ctx.wizard.state.data.durationDays = days;
    await ctx.reply('🎙️ هل تشمل الباقة الرد الصوتي؟ اكتب "نعم" أو "لا".');
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
    await ctx.reply('🖼️ هل تشمل الباقة التعرف على الصور؟ اكتب "نعم" أو "لا".');
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
    await ctx.reply('📊 هل تشمل الباقة الإحصائيات الكاملة؟ اكتب "نعم" أو "لا".');
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (isCancel(ctx)) return cancelFlow(ctx);
    const { planId } = ctx.scene.state;
    const v = parseYesNo(ctx.message?.text);
    if (v === null) {
      await ctx.reply('⚠️ اكتب "نعم" أو "لا" فقط.');
      return;
    }
    const d = ctx.wizard.state.data;
    d.fullAnalytics = v;

    try {
      const updated = await PlanService.setPlanOverride(planId, {
        price: d.price,
        messageLimit: d.messageLimit,
        productLimit: d.productLimit,
        durationDays: d.durationDays,
        features: {
          voiceReply: d.voiceReply,
          imageRecognition: d.imageRecognition,
          fullAnalytics: d.fullAnalytics,
        },
      });
      const msgLimitText = updated.messageLimit === null ? 'غير محدود' : updated.messageLimit;
      const prodLimitText = updated.productLimit === null ? 'غير محدود' : updated.productLimit;
      await ctx.reply(
        `✅ تم تحديث باقة "${updated.name}":\n\n` +
          `السعر: ${updated.price} د.ج\nالرسائل: ${msgLimitText}\nالمنتجات: ${prodLimitText}\nالمدة: ${updated.durationDays} يوم\n` +
          `صوت: ${updated.features.voiceReply ? 'نعم' : 'لا'}\n` +
          `صور: ${updated.features.imageRecognition ? 'نعم' : 'لا'}\n` +
          `إحصائيات: ${updated.features.fullAnalytics ? 'نعم' : 'لا'}`,
        mainMenu
      );
    } catch (err) {
      await ctx.reply(`⚠️ ${toUserMessage(err)}`, mainMenu);
    }
    return ctx.scene.leave();
  }
);

editGlobalPlanScene.hears('❌ إلغاء', async (ctx) => {
  await ctx.reply('تم الإلغاء.', mainMenu);
  return ctx.scene.leave();
});

module.exports = editGlobalPlanScene;
