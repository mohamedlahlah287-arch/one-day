const { Scenes, Markup } = require('telegraf');
const StoreService = require('../../services/StoreService');
const { PRESET_ROLES, PERMISSION_LABELS, CUSTOM_PERMISSION_LIST } = require('../../config/permissions');
const { mainMenu, cancelKeyboard } = require('../../ui/adminKeyboards');

const CUSTOM_LABEL = '🛠 مخصص (أختار يدويًا)';
const presetLabels = Object.keys(PRESET_ROLES);

function isCancel(ctx) {
  return ctx.message?.text === '❌ إلغاء';
}

async function cancelFlow(ctx) {
  await ctx.reply('تم الإلغاء.', mainMenu);
  return ctx.scene.leave();
}

function permissionsKeyboard() {
  return Markup.keyboard([...presetLabels.map((l) => [l]), [CUSTOM_LABEL], ['❌ إلغاء']]).resize();
}

function customPermissionsList() {
  return CUSTOM_PERMISSION_LIST.map((p, i) => `${i + 1}. ${PERMISSION_LABELS[p]}`).join('\n');
}

const manageStaffScene = new Scenes.WizardScene(
  'MANAGE_STAFF_SCENE',
  async (ctx) => {
    ctx.wizard.state.storeId = ctx.scene.state?.storeId || ctx.from.id;
    await ctx.reply(
      '👤 أرسل معرف تيليغرام (Telegram ID) للشخص اللي تحب تضيفو كعضو فريق.\n\nملاحظة: العضو يقدر يجيب معرفه (Telegram ID) بأن يرسل /start لبوت مثل @userinfobot',
      cancelKeyboard
    );
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (isCancel(ctx)) return cancelFlow(ctx);
    const text = (ctx.message?.text || '').trim();
    if (!/^\d+$/.test(text)) {
      await ctx.reply('⚠️ معرف تيليغرام لازم يكون أرقام فقط. أعد المحاولة أو اضغط "❌ إلغاء".');
      return;
    }
    ctx.wizard.state.telegramId = text;
    await ctx.reply('✏️ اكتب اسم يعرّفك بهذا العضو (مثال: "أخي علي" أو "بائع الهاتف") أو اكتب "بدون":');
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (isCancel(ctx)) return cancelFlow(ctx);
    const name = (ctx.message?.text || '').trim();
    ctx.wizard.state.name = name === 'بدون' ? '' : name;
    await ctx.reply('🔑 شنوة الصلاحيات اللي تحب تعطيها لهذا العضو؟ اختار حزمة جاهزة أو "مخصص":', permissionsKeyboard());
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (isCancel(ctx)) return cancelFlow(ctx);
    const choice = ctx.message?.text;
    if (PRESET_ROLES[choice]) {
      return finishAdding(ctx, PRESET_ROLES[choice]);
    }
    if (choice === CUSTOM_LABEL) {
      await ctx.reply(
        `🔢 أرسل أرقام الصلاحيات اللي تحبها مفصولة بفاصلة (مثال: 1,3):\n\n${customPermissionsList()}`,
        cancelKeyboard
      );
      return ctx.wizard.next();
    }
    await ctx.reply('⚠️ اختار من الأزرار المتوفرة من فضلك.');
    return;
  },
  async (ctx) => {
    if (isCancel(ctx)) return cancelFlow(ctx);
    const raw = (ctx.message?.text || '').trim();
    const indices = raw
      .split(/[,،]/)
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !Number.isNaN(n) && n >= 1 && n <= CUSTOM_PERMISSION_LIST.length);
    if (indices.length === 0) {
      await ctx.reply('⚠️ ماكتبتش أرقام صحيحة. حاول مرة أخرى (مثال: 1,3) أو اضغط "❌ إلغاء".');
      return;
    }
    const permissions = [...new Set(indices.map((i) => CUSTOM_PERMISSION_LIST[i - 1]))];
    return finishAdding(ctx, permissions);
  }
);

async function finishAdding(ctx, permissions) {
  const { storeId, telegramId, name } = ctx.wizard.state;
  try {
    await StoreService.addStaffMember(storeId, telegramId, { name, permissions });
    const permLabels = permissions.includes('ALL')
      ? 'كل الصلاحيات'
      : permissions.map((p) => PERMISSION_LABELS[p]).join('، ');
    await ctx.reply(
      `✅ تمت إضافة العضو بنجاح!\n\n👤 المعرف: ${telegramId}${name ? `\n📝 الاسم: ${name}` : ''}\n🔑 الصلاحيات: ${permLabels}\n\nيقدر الآن يفتح بوت التاجر ويستعمله حسب صلاحياته.`,
      mainMenu
    );
  } catch (err) {
    await ctx.reply(`⚠️ ${err.message}`, mainMenu);
  }
  return ctx.scene.leave();
}

module.exports = manageStaffScene;
