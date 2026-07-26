const { Scenes } = require('telegraf');
const StoreService = require('../../services/StoreService');
const { toUserMessage } = require('../../middlewares/errorHandler');
const { buildCustomPlan } = require('../../config/plans');
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

// رقم موجب، أو null (غير محدود) - يرجع { ok, value }
function parseLimitInput(text) {
  const t = (text || '').trim();
  if (t.includes('غير')) return { ok: true, value: null };
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return { ok: false, value: null };
  return { ok: true, value: n };
}

// تُستدعى بـ ctx.scene.enter('CUSTOM_PLAN_SCENE', { storeId }) لتغيير باقة متجر موجود لباقة مخصصة
// (يسقسي سؤال واحد فـ كل مرة بدل رسالة واحدة بكل التفاصيل مفصولة بفواصل)
const customPlanScene = new Scenes.WizardScene(
  'CUSTOM_PLAN_SCENE',
  async (ctx) => {
    ctx.wizard.state.data = {};
    await ctx.reply('💬 كم عدد الرسائل المسموحة؟ اكتب رقمًا، أو اكتب "غير محدود".', cancelKeyboard);
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
    const v = parseYesNo(ctx.message?.text);
    if (v === null) {
      await ctx.reply('⚠️ اكتب "نعم" أو "لا" فقط.');
      return;
    }
    ctx.wizard.state.data.fullAnalytics = v;
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
    const d = ctx.wizard.state.data;
    const plan = buildCustomPlan({
      messageLimit: d.messageLimit,
      durationDays: d.durationDays,
      voiceReply: d.voiceReply,
      imageRecognition: d.imageRecognition,
      fullAnalytics: d.fullAnalytics,
      productLimit: r.value,
    });

    try {
      await StoreService.changePlan(ctx.scene.state.storeId, plan);
      await ctx.reply('✅ تم تحديث باقة المتجر بنجاح.', mainMenu);
    } catch (err) {
      await ctx.reply(`⚠️ ${toUserMessage(err)}`, mainMenu);
    }
    return ctx.scene.leave();
  }
);

customPlanScene.hears('❌ إلغاء', async (ctx) => {
  await ctx.reply('تم الإلغاء.', mainMenu);
  return ctx.scene.leave();
});

module.exports = customPlanScene;
