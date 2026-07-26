const { Scenes } = require('telegraf');
const ProductService = require('../../services/ProductService');
const AIMediaService = require('../../services/AIMediaService');
const VoiceNoteService = require('../../voiceNotes/VoiceNoteService');
const { validateProductName, validatePrice } = require('../../validators/productValidator');
const { mainMenu, cancelKeyboard } = require('../../ui/adminKeyboards');

function isCancel(ctx) {
  return ctx.message?.text === '❌ إلغاء';
}

async function cancelFlow(ctx) {
  await ctx.reply('تم الإلغاء.', mainMenu);
  return ctx.scene.leave();
}

const addProductScene = new Scenes.WizardScene(
  'ADD_PRODUCT_SCENE',
  async (ctx) => {
    ctx.wizard.state.product = {};
    ctx.wizard.state.storeId = ctx.scene.state?.storeId || ctx.from.id;
    await ctx.reply('📷 أرسل صورة المنتج (أو اكتب "بدون" إذا ما عندكش صورة الآن)', cancelKeyboard);
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (isCancel(ctx)) return cancelFlow(ctx);
    if (ctx.message?.photo) {
      const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
      ctx.wizard.state.product.imageFileId = fileId; // يُستعمل داخل بوت التاجر (ctx.replyWithPhoto)
      try {
        // رابط عام يقدر بوت الزبائن (Facebook Messenger) يستعمله لعرض صورة المنتج.
        // ملاحظة: هذا الرابط يحتوي توكن بوت التاجر ضمنيًا (من نظام تليغرام نفسه) وقد يتغير لاحقًا.
        // إذا حبيت استقرار أفضل مستقبلاً، فكر فـ رفع الصور لـ Firebase Storage بدل الاعتماد عليه.
        const fileLink = await ctx.telegram.getFileLink(fileId);
        ctx.wizard.state.product.imageUrl = fileLink.href;
      } catch (err) {
        ctx.wizard.state.product.imageUrl = null;
      }
    } else if (ctx.message?.text === 'بدون') {
      ctx.wizard.state.product.imageFileId = null;
      ctx.wizard.state.product.imageUrl = null;
    } else {
      await ctx.reply('أرسل صورة أو اكتب "بدون".');
      return;
    }
    await ctx.reply('📝 ما اسم المنتج؟');
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (isCancel(ctx)) return cancelFlow(ctx);
    try {
      ctx.wizard.state.product.name = validateProductName(ctx.message?.text);
    } catch (err) {
      await ctx.reply(`⚠️ ${err.message}`);
      return;
    }
    await ctx.reply('💰 ما سعر المنتج؟ (بالدينار، رقم فقط)');
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (isCancel(ctx)) return cancelFlow(ctx);
    try {
      ctx.wizard.state.product.price = validatePrice(ctx.message?.text);
    } catch (err) {
      await ctx.reply(`⚠️ ${err.message}`);
      return;
    }

    // 🎙️ إذا باقة المتجر تسمح بالرسائل الصوتية (باقة الأعمال)، نعرض عليه هنا مباشرة تسجيل
    // رسالة صوتية توضح السعر والتفاصيل بصوته - بلاصة ما يخرج من هذا السيناريو ويرجع من قائمة
    // منفصلة بعدين (🎙️ الرسائل الصوتية) باش يربطها بنفس المنتج.
    if (VoiceNoteService.isEnabled(ctx.state?.store)) {
      await ctx.reply(
        '🎙️ تحب تسجل رسالة صوتية توضح فيها سعر وتفاصيل هذا المنتج بصوتك؟ أرسلها الآن (زر المايكروفون)، أو اكتب "تخطي".',
        cancelKeyboard
      );
      return ctx.wizard.next();
    }

    await ctx.reply('📋 اكتب وصف المنتج:');
    ctx.wizard.selectStep(4); // نتخطى خطوة الصوت (index 3) لأن المتجر ما عندوش الميزة
    return;
  },
  async (ctx) => {
    if (isCancel(ctx)) return cancelFlow(ctx);
    if (ctx.message?.voice) {
      try {
        const fileId = ctx.message.voice.file_id;
        const fileLink = await ctx.telegram.getFileLink(fileId);
        ctx.wizard.state.pendingVoice = {
          fileId,
          url: fileLink.href,
          duration: ctx.message.voice.duration || null,
        };
        await ctx.reply('✅ تم استلام الرسالة الصوتية، راح تُحفظ بعد ما نكمل بيانات المنتج.');
      } catch (err) {
        await ctx.reply('⚠️ تعذر استلام الرسالة الصوتية، تقدر تكمل بلاها أو تعاود إرسالها.');
      }
    } else if ((ctx.message?.text || '').trim() !== 'تخطي') {
      await ctx.reply('أرسل رسالة صوتية، أو اكتب "تخطي".', cancelKeyboard);
      return;
    }
    await ctx.reply('📋 اكتب وصف المنتج:');
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (isCancel(ctx)) return cancelFlow(ctx);
    ctx.wizard.state.product.description = ctx.message?.text?.trim();
    await ctx.reply('⭐ اكتب أهم مميزات المنتج (أو "بدون"):');
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (isCancel(ctx)) return cancelFlow(ctx);
    ctx.wizard.state.product.features = ctx.message?.text?.trim();
    await ctx.reply('🚚 ما مدة التوصيل؟ (مثال: 2-4 أيام)');
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (isCancel(ctx)) return cancelFlow(ctx);
    ctx.wizard.state.product.deliveryTime = ctx.message?.text?.trim();
    await ctx.reply('🛡️ ما مدة الضمان؟ (أو "بدون ضمان")');
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (isCancel(ctx)) return cancelFlow(ctx);
    ctx.wizard.state.product.warranty = ctx.message?.text?.trim();
    await ctx.reply('🎥 رابط فيديو ريلز يشرح المنتج (أو "بدون")');
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (isCancel(ctx)) return cancelFlow(ctx);
    ctx.wizard.state.product.reelsUrl =
      ctx.message?.text?.trim() === 'بدون' ? null : ctx.message?.text?.trim();

    const storeId = ctx.wizard.state.storeId || ctx.from.id;
    const p = ctx.wizard.state.product;

    // نولّد وصف بصري ذكي (AI) مرة واحدة فقط عند الإضافة - يُستعمل لاحقًا لمطابقة صور
    // الزبائن بدقة أعلى من الاعتماد فقط على الوصف اللي كتبو التاجر يدويًا. إذا AI مش
    // مفعّل (بلا GROQ_API_KEY) أو فشل التحليل، نكمل عادي بلا هذا الحقل - ماشي خطأ حرج.
    let aiDescriptionGenerated = false;
    if (p.imageUrl && AIMediaService.isEnabled()) {
      try {
        p.visualDescription = await AIMediaService.describeImage(p.imageUrl);
        p.visualDescriptionSourceUrl = p.imageUrl; // نتتبع مصدرها باش نعرفو وقتاش تحتاج تجديد لاحقًا
        aiDescriptionGenerated = true;
      } catch (err) {
        // فشل تحليل الصورة (شبكة/حصة) - نكمل حفظ المنتج بلا وصف ذكي، بلا ما نوقف التاجر
      }
    }

    let productId;
    try {
      productId = await ProductService.addProduct(storeId, p);
    } catch (err) {
      await ctx.reply(`⚠️ ${err.message}`, mainMenu);
      return ctx.scene.leave();
    }

    // 🎙️ إذا التاجر سجّل رسالة صوتية فـ خطوة السعر فوق، نربطها الآن بالمنتج اللي تولّد له 🆔 توّا
    let voiceNote = false;
    if (ctx.wizard.state.pendingVoice) {
      try {
        await VoiceNoteService.attachToProduct(storeId, productId, ctx.wizard.state.pendingVoice);
        voiceNote = true;
      } catch (err) {
        // فشل ربط الصوت لا يجب أن يوقف حفظ المنتج نفسه
      }
    }

    const aiNote = aiDescriptionGenerated ? '\n\n✅ تم إنشاء وصف ذكي للمنتج لتحسين البحث بالصور.' : '';
    const voiceNoteText = voiceNote ? '\n🎙️ تم حفظ رسالتك الصوتية لهذا المنتج.' : '';
    await ctx.reply(`✅ تم حفظ المنتج بنجاح!\n\n📦 ${p.name}\n💰 ${p.price} دج${voiceNoteText}${aiNote}`, mainMenu);
    return ctx.scene.leave();
  }
);

module.exports = addProductScene;
