const ProductService = require('../../services/ProductService');
const VoiceNoteService = require('../../voiceNotes/VoiceNoteService');
const { INTENT_KEYS } = require('../../engine/responseEngine');
const { productsMenu, settingsMenu } = require('../../ui/adminKeyboards');
const { voiceIntentKeyboard, INTENT_LABELS_AR } = require('../../ui/voiceNoteKeyboards');

// Controllers: تتحقق من الشكل العام للطلب، تنادي على الخدمة، وترجع الرد. بلا منطق أعمال هنا.
// (نفس فلسفة src/controllers/admin/productController.js)

const UPGRADE_MESSAGE =
  '🎙️ الرسائل الصوتية متوفرة فقط فـ "باقة الأعمال". اضغط "💳 الاشتراك والدفع" من القائمة الرئيسية للترقية.';

async function startAttachProductVoice(ctx) {
  const store = ctx.state.store;
  if (!VoiceNoteService.isEnabled(store)) {
    await ctx.reply(UPGRADE_MESSAGE, productsMenu);
    return;
  }

  const products = await ProductService.listProducts(store.id);
  if (products.length === 0) {
    await ctx.reply('لا توجد منتجات بعد. أضف منتجًا أولاً من "➕ إضافة منتج".', productsMenu);
    return;
  }

  const list = products
    .map((p, i) => `${i + 1}. ${p.name} — 🆔 ${p.id}${p.voiceNoteUrl ? ' 🎙️' : ''}`)
    .join('\n');
  await ctx.reply(
    `🎙️ أرسل 🆔 المنتج اللي تحب تضيف/تستبدل له رسالة صوتية (المنتجات اللي عندها 🎙️ فيها رسالة مسجَّلة بالفعل):\n\n${list}`
  );
  return ctx.scene.enter('ATTACH_PRODUCT_VOICE_SCENE', { storeId: store.id });
}

async function startAttachIntentVoice(ctx) {
  const store = ctx.state.store;
  if (!VoiceNoteService.isEnabled(store)) {
    await ctx.reply(UPGRADE_MESSAGE, settingsMenu);
    return;
  }

  const existing = await VoiceNoteService.listIntentVoiceNotes(store.id);
  const existingKeys = new Set(existing.map((n) => n.intentKey));
  const summary = INTENT_KEYS.map(
    (key) => `${existingKeys.has(key) ? '🎙️' : '▫️'} ${INTENT_LABELS_AR[key] || key}`
  ).join('\n');

  await ctx.reply(
    `🎙️ اختر النوع اللي تحب تسجّل له رسالة صوتية عامة (تظهر للزبون بدل الرد النصي الجاهز):\n\n${summary}`,
    voiceIntentKeyboard()
  );
}

// يُستدعى من زر voice_cond:<intentKey>:<ask|text|none> (بعد حفظ/حذف رسالة صوتية لنية
// تتطلب معرفة منتج) - يضبط الفعل البديل عندما يسأل زبون عن هذا الموضوع بلا تحديد منتج.
async function setIntentConditionAction(ctx, intentKey, action) {
  const store = ctx.state.store;
  const label = INTENT_LABELS_AR[intentKey] || intentKey;
  await VoiceNoteService.setConditionsForIntent(store.id, intentKey, { noProductAction: action });
  const actionLabel = { ask: 'سؤال توضيحي', text: 'رسالة نصية عامة', none: 'لا شيء (تجاهل)' }[action];
  const extra =
    action === 'text'
      ? '\n\nملاحظة: النص التلقائي عام. لكتابة نص مخصص، افتح لوحة التحكم على الموقع > الرسائل الصوتية.'
      : '';
  await ctx.reply(`✅ تم ضبط "${label}": إذا لم يُعرف المنتج -> ${actionLabel}.${extra}`, settingsMenu);
}

module.exports = { startAttachProductVoice, startAttachIntentVoice, setIntentConditionAction };
