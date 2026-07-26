const { Scenes } = require('telegraf');
const StoreService = require('../../services/StoreService');
const { toUserMessage } = require('../../middlewares/errorHandler');
const { validateStoreName } = require('../../validators/storeValidator');
const { getPlan, buildCustomPlan } = require('../../config/plans');
const { planChoiceInline, mainMenu, cancelKeyboard } = require('../../ui/superAdminKeyboards');
const { env } = require('../../config/env');

function storeLinkLine(ownerTelegramId) {
  if (!env.facebook.pageUsername) return '';
  return `\n\n🔗 رابط المتجر للزبائن: https://m.me/${env.facebook.pageUsername}?ref=${ownerTelegramId}`;
}

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

const ID_REGEX = /^\d{5,}$/; // معرف Telegram رقمي، عادة 9-10 أرقام

const addStoreScene = new Scenes.WizardScene(
  'ADD_STORE_SCENE',
  async (ctx) => {
    await ctx.reply(
      '🆔 أرسل معرف Telegram (ID) الخاص بصاحب المتجر.\n\nملاحظة: اطلب منه يرسل /start لأي بوت مثل @userinfobot ليعرف رقمه.',
      cancelKeyboard
    );
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (isCancel(ctx)) return cancelFlow(ctx);
    const id = ctx.message?.text?.trim();
    if (!id || !ID_REGEX.test(id)) {
      await ctx.reply('⚠️ المعرف غير صحيح، يجب أن يكون رقمًا. أعد المحاولة أو اضغط ❌ إلغاء.');
      return;
    }
    ctx.wizard.state.ownerTelegramId = id;
    await ctx.reply('🏪 ما اسم المتجر؟', cancelKeyboard);
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (isCancel(ctx)) return cancelFlow(ctx);
    try {
      ctx.wizard.state.storeName = validateStoreName(ctx.message?.text);
    } catch (err) {
      await ctx.reply(`⚠️ ${toUserMessage(err)}`);
      return;
    }
    await ctx.reply('📦 اختر الباقة:', planChoiceInline(`create_${ctx.wizard.state.ownerTelegramId}`));
    return ctx.wizard.next();
  },
  async (ctx) => {
    // ننتظر ضغطة زر (يعالجها scene.action تحت) أو نص خام لباقة مخصصة (الخطوة التالية)
    if (ctx.message?.text) {
      await ctx.reply('من فضلك اختر باقة من الأزرار بالأعلى، أو اضغط ❌ إلغاء.');
    }
  },
  // ===== من هنا: باقة مخصصة - سؤال واحد فـ كل مرة (يبدأ عبر scene.action تحت بـ selectStep) =====
  async (ctx) => {
    if (isCancel(ctx)) return cancelFlow(ctx);
    ctx.wizard.state.custom = {};
    const r = parseLimitInput(ctx.message?.text);
    if (!r.ok) {
      await ctx.reply('⚠️ أرسل رقمًا صحيحًا أكبر من 0، أو اكتب "غير محدود".');
      return;
    }
    ctx.wizard.state.custom.messageLimit = r.value;
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
    ctx.wizard.state.custom.durationDays = days;
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
    ctx.wizard.state.custom.voiceReply = v;
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
    ctx.wizard.state.custom.imageRecognition = v;
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
    ctx.wizard.state.custom.fullAnalytics = v;
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
    const c = ctx.wizard.state.custom;
    const plan = buildCustomPlan({
      messageLimit: c.messageLimit,
      durationDays: c.durationDays,
      voiceReply: c.voiceReply,
      imageRecognition: c.imageRecognition,
      fullAnalytics: c.fullAnalytics,
      productLimit: r.value,
    });

    try {
      await StoreService.adminCreateStore(ctx.wizard.state.ownerTelegramId, ctx.wizard.state.storeName, plan);
      await ctx.reply(
        `✅ تم إنشاء متجر "${ctx.wizard.state.storeName}" بباقة مخصصة بنجاح!${storeLinkLine(ctx.wizard.state.ownerTelegramId)}`,
        mainMenu
      );
    } catch (err) {
      await ctx.reply(`⚠️ ${toUserMessage(err)}`, mainMenu);
    }
    return ctx.scene.leave();
  }
);

addStoreScene.hears('❌ إلغاء', async (ctx) => {
  await ctx.reply('تم الإلغاء.', mainMenu);
  return ctx.scene.leave();
});

addStoreScene.action(/plan_create_(\d+)_(starter|pro|business)/, async (ctx) => {
  await ctx.answerCbQuery();
  const [, ownerTelegramId, planId] = ctx.match;
  const plan = getPlan(planId);
  try {
    await StoreService.adminCreateStore(ownerTelegramId, ctx.wizard.state.storeName, plan);
    await ctx.editMessageText(
      `✅ تم إنشاء متجر "${ctx.wizard.state.storeName}" بباقة "${plan.name}" بنجاح!${storeLinkLine(ownerTelegramId)}`
    );
    await ctx.reply('تم. يمكنك إدارة المتجر من "📋 كل المتاجر".', mainMenu);
  } catch (err) {
    await ctx.reply(`⚠️ ${toUserMessage(err)}`, mainMenu);
  }
  return ctx.scene.leave();
});

addStoreScene.action(/plan_create_(\d+)_custom/, async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.editMessageText('⚙️ باقة مخصصة اخترتها. راح نسقسيك سؤال بسؤال.');
  await ctx.reply('💬 كم عدد الرسائل المسموحة؟ اكتب رقمًا، أو اكتب "غير محدود".', cancelKeyboard);
  return ctx.wizard.selectStep(4);
});

module.exports = addStoreScene;
