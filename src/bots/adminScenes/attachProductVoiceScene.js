const { Scenes } = require('telegraf');
const ProductService = require('../../services/ProductService');
const VoiceNoteService = require('../../voiceNotes/VoiceNoteService');
const { productsMenu, cancelKeyboard } = require('../../ui/adminKeyboards');
const logger = require('../../utils/logger');

function isCancel(ctx) {
  return ctx.message?.text === '❌ إلغاء';
}

async function cancelFlow(ctx) {
  await ctx.reply('تم الإلغاء.', productsMenu);
  return ctx.scene.leave();
}

// ATTACH_PRODUCT_VOICE_SCENE: التاجر يرسل 🆔 المنتج (القائمة سبق عرضها من voiceNoteController)
// ثم يرسل رسالة صوتية (voice note تليغرام) تشرح المنتج وسعره - نحفظها مباشرة على وثيقة المنتج.
const attachProductVoiceScene = new Scenes.WizardScene(
  'ATTACH_PRODUCT_VOICE_SCENE',
  async (ctx) => {
    // القائمة والتعليمات سبق إرسالها من voiceNoteController.startAttachProductVoice - هنا فقط
    // نجهّز الحالة وننتقل للخطوة التي تنتظر 🆔 المنتج، بلا رسالة إضافية (تفادي تكرار).
    ctx.wizard.state.storeId = ctx.scene.state?.storeId || ctx.from.id;
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (isCancel(ctx)) return cancelFlow(ctx);
    const productId = ctx.message?.text?.trim();
    if (!productId) {
      await ctx.reply('أرسل 🆔 المنتج (كما يظهر فـ القائمة فوق).', cancelKeyboard);
      return;
    }
    try {
      const product = await ProductService.getProduct(ctx.wizard.state.storeId, productId);
      ctx.wizard.state.productId = product.id;
      ctx.wizard.state.productName = product.name;
    } catch (err) {
      await ctx.reply(`⚠️ ${err.message}. أرسل 🆔 صحيح أو اضغط "❌ إلغاء".`, cancelKeyboard);
      return;
    }
    await ctx.reply(`🎙️ أرسل الآن رسالة صوتية تشرح "${ctx.wizard.state.productName}" (السعر وكل التفاصيل بصوتك):`, cancelKeyboard);
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (isCancel(ctx)) return cancelFlow(ctx);
    if (!ctx.message?.voice) {
      await ctx.reply('أرسل رسالة صوتية (زر المايكروفون فـ تليغرام)، أو اضغط "❌ إلغاء".', cancelKeyboard);
      return;
    }
    const { storeId, productId, productName } = ctx.wizard.state;
    try {
      const fileId = ctx.message.voice.file_id;
      const fileLink = await ctx.telegram.getFileLink(fileId);
      await VoiceNoteService.attachToProduct(storeId, productId, {
        fileId,
        url: fileLink.href,
        duration: ctx.message.voice.duration || null,
      });
      await ctx.reply(`✅ تم حفظ الرسالة الصوتية لـ "${productName}". سيسمعها أي زبون يسأل عن هذا المنتج.`, productsMenu);
    } catch (err) {
      logger.error('فشل حفظ رسالة صوتية لمنتج', { storeId, productId, error: err.message });
      await ctx.reply(`⚠️ ${err.message || 'تعذر حفظ الرسالة الصوتية، حاول مرة أخرى.'}`, productsMenu);
    }
    return ctx.scene.leave();
  }
);

module.exports = attachProductVoiceScene;
