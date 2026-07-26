const { asyncHandler, toUserMessage } = require('../middlewares/errorHandler');
const rateLimiter = require('../middlewares/rateLimiter');
const { ensureStoreRegistered, requirePermission, requireOwner } = require('../middlewares/authGuard');
const { PERMISSIONS } = require('../config/permissions');
const StoreService = require('../services/StoreService');
const PromoCodeService = require('../services/PromoCodeService');
const PendingRegistrationRepository = require('../repositories/PendingRegistrationRepository');
const AccountLinkRepository = require('../repositories/AccountLinkRepository');
const WebUserRepository = require('../repositories/WebUserRepository');
const StoreRepository = require('../repositories/StoreRepository');
const { mainMenu, staffMenu } = require('../ui/adminKeyboards');

const productController = require('../controllers/admin/productController');
const orderController = require('../controllers/admin/orderController');
const statsController = require('../controllers/admin/statsController');
const storeController = require('../controllers/admin/storeController');
const staffController = require('../controllers/admin/staffController');
const voiceNoteController = require('../controllers/admin/voiceNoteController');
const { ATTACH_INTENT_VOICE_SCENE_ID } = require('../bots/adminScenes/attachIntentVoiceScene');

function registerAdminRoutes(bot) {
  bot.use(rateLimiter);

  bot.start(
    asyncHandler(async (ctx) => {
      // تسجيل ذاتي من الموقع: /start reg_TOKEN - نكمل إنشاء المتجر الآن لأنه أول مرة نعرف
      // فيها معرف Telegram الحقيقي تاع هذا الشخص.
      const payload = ctx.startPayload || '';

      // ربط حساب الموقع (تسجيل دخول عبر Google) بمتجر تيليغرام: /start link_TOKEN
      // التوكن يُنشأ من لوحة تحكم الموقع (بعد تسجيل الدخول) عبر POST /api/auth/link-telegram
      if (payload.startsWith('link_')) {
        const token = payload.slice(5);
        const linkRecord = await AccountLinkRepository.findValid(token);
        if (!linkRecord) {
          return ctx.reply('⏳ رابط الربط هذا منتهي الصلاحية أو استُعمل من قبل. رجع للوحة تحكم الموقع واطلب رابطًا جديدًا.');
        }
        const actor = await StoreService.resolveActor(ctx.from.id);
        if (!actor) {
          return ctx.reply(
            'عندك حساب على الموقع، لكن ما عندكش متجر مسجل بهذا الحساب على تيليغرام بعد. سجّل متجرك أولًا من "/register" على الموقع، ثم أعد المحاولة.'
          );
        }
        await StoreRepository.update(ctx.from.id, { linkedWebUserId: linkRecord.webUserId });
        await WebUserRepository.linkStore(linkRecord.webUserId, ctx.from.id);
        await AccountLinkRepository.markCompleted(token, ctx.from.id);
        return ctx.reply(`✅ تم ربط حسابك على الموقع بمتجر "${actor.store.storeName}" بنجاح! رجع للوحة التحكم على الموقع.`, mainMenu);
      }

      if (payload.startsWith('reg_')) {
        const token = payload.slice(4);
        const pending = await PendingRegistrationRepository.findValid(token);
        if (!pending) {
          return ctx.reply(
            '⏳ رابط التسجيل هذا منتهي الصلاحية أو استُعمل من قبل. رجع للموقع وسجّل من جديد.'
          );
        }
        const alreadyOwner = await StoreService.getStore(ctx.from.id);
        if (alreadyOwner) {
          await PendingRegistrationRepository.markCompleted(token, ctx.from.id);
          return ctx.reply(`👋 عندك متجر مسجل بالفعل: "${alreadyOwner.storeName}".`, mainMenu);
        }
        try {
          const store = await StoreService.selfRegisterStore(ctx.from.id, {
            storeName: pending.storeName,
            ownerName: pending.ownerName,
            phone: pending.phone,
            referralCode: pending.referralCode,
            signupIp: pending.signupIp,
          });
          await PendingRegistrationRepository.markCompleted(token, ctx.from.id);
          return ctx.reply(
            `🎉 تم إنشاء متجر "${store.storeName}" بنجاح!\n\n` +
              `📦 الباقة: ${store.planName} (${store.planDurationDays} أيام تجريبية)\n\n` +
              'الخطوة الجاية: من "⚙️ الإعدادات" اربط صفحة فيسبوك متجرك، وزيد منتجاتك الأولى من "📦 المنتجات".',
            mainMenu
          );
        } catch (err) {
          return ctx.reply(`⚠️ ${err.message}`, mainMenu);
        }
      }

      const actor = await StoreService.resolveActor(ctx.from.id);
      if (!actor) {
        return ctx.reply(
          '🚫 هذا البوت مخصص فقط لأصحاب المتاجر المسجلين لدينا أو أعضاء الفريق المضافين من طرفهم.\n\nإذا كنت تريد فتح متجر، سجّل من الموقع أو تواصل مع الإدارة لتفعيل حسابك.'
        );
      }
      const { store, role } = actor;
      if (!store.active) {
        return ctx.reply(
          `⏸️ متجر "${store.storeName}" متوقف حاليًا (${
            store.subscriptionStatus === 'expired' ? 'انتهى الاشتراك' : 'أوقفته الإدارة'
          }).\n\nتواصل مع الإدارة لتجديد أو تفعيل الاشتراك.`
        );
      }
      const usage =
        store.messageLimit === null || store.messageLimit === undefined
          ? 'غير محدود'
          : `${store.messageCount || 0} / ${store.messageLimit}`;
      const greeting =
        role === 'owner'
          ? `👋 أهلاً بعودتك يا صاحب متجر "${store.storeName}"!`
          : `👋 أهلاً بك! أنت عضو فريق فـ متجر "${store.storeName}".`;
      await ctx.reply(
        `${greeting}\n\n📦 الباقة: ${store.planName || '—'}\n💬 استهلاك الرسائل هذا الشهر: ${usage}`,
        mainMenu
      );
    })
  );

  bot.hears('📦 المنتجات', ensureStoreRegistered, asyncHandler(productController.showProductsMenu));
  bot.hears(
    '➕ إضافة منتج',
    ensureStoreRegistered,
    requirePermission(PERMISSIONS.MANAGE_PRODUCTS),
    asyncHandler(productController.startAddProduct)
  );
  bot.hears('📂 كل المنتجات', ensureStoreRegistered, asyncHandler(productController.listAllProducts));
  bot.hears(
    '🎙️ صوت شرح لمنتج',
    ensureStoreRegistered,
    requirePermission(PERMISSIONS.MANAGE_PRODUCTS),
    asyncHandler(voiceNoteController.startAttachProductVoice)
  );
  bot.hears(
    '🗑 حذف منتج',
    ensureStoreRegistered,
    requirePermission(PERMISSIONS.MANAGE_PRODUCTS),
    asyncHandler(productController.promptDeleteProduct)
  );

  bot.hears('📋 الطلبات', ensureStoreRegistered, requirePermission(PERMISSIONS.VIEW_ORDERS), asyncHandler(orderController.listOrders));
  bot.hears('📊 الإحصائيات', ensureStoreRegistered, requirePermission(PERMISSIONS.VIEW_STATS), asyncHandler(statsController.showStats));
  bot.hears('⚙️ الإعدادات', ensureStoreRegistered, requirePermission(PERMISSIONS.MANAGE_SETTINGS), asyncHandler(storeController.showSettingsMenu));
  bot.hears('🔗 رابط متجرك للزبائن', ensureStoreRegistered, asyncHandler(storeController.showStoreLink));
  bot.hears('💳 الاشتراك والدفع', ensureStoreRegistered, asyncHandler(storeController.showBillingLink));
  bot.hears('⬅️ رجوع للقائمة الرئيسية', ensureStoreRegistered, asyncHandler(storeController.showMainMenu));

  bot.hears(
    '📘 ربط صفحة فيسبوك الخاصة بي',
    ensureStoreRegistered,
    requirePermission(PERMISSIONS.MANAGE_SETTINGS),
    asyncHandler(storeController.startConnectFacebook)
  );

  bot.hears(
    '🔌 فصل الصفحة',
    ensureStoreRegistered,
    requirePermission(PERMISSIONS.MANAGE_SETTINGS),
    asyncHandler(storeController.handleDisconnectFacebook)
  );

  bot.hears(
    '🔔 تأكيد الطلب للزبون',
    ensureStoreRegistered,
    requirePermission(PERMISSIONS.MANAGE_SETTINGS),
    asyncHandler(storeController.toggleOrderConfirmation)
  );

  bot.hears(
    '🎙️ رسائل صوتية عامة',
    ensureStoreRegistered,
    requirePermission(PERMISSIONS.MANAGE_SETTINGS),
    asyncHandler(voiceNoteController.startAttachIntentVoice)
  );

  // اختيار النية من اللوحة اللي أرسلها voiceNoteController.startAttachIntentVoice
  bot.action(
    /voice_intent:(.+)/,
    ensureStoreRegistered,
    requirePermission(PERMISSIONS.MANAGE_SETTINGS),
    asyncHandler(async (ctx) => {
      const intentKey = ctx.match[1];
      await ctx.answerCbQuery();
      await ctx.editMessageReplyMarkup(); // نزيل اللوحة حتى ما يُضغط عليها مرتين
      return ctx.scene.enter(ATTACH_INTENT_VOICE_SCENE_ID, { storeId: ctx.state.store.id, intentKey });
    })
  );

  // اختيار "شروط التشغيل" (الفعل البديل إذا لم يُعرف المنتج) من اللوحة اللي أرسلها
  // attachIntentVoiceScene.promptConditionsIfNeeded بعد حفظ/حذف رسالة صوتية
  bot.action(
    /voice_cond:(.+):(ask|text|none)/,
    ensureStoreRegistered,
    requirePermission(PERMISSIONS.MANAGE_SETTINGS),
    asyncHandler(async (ctx) => {
      const [, intentKey, action] = ctx.match;
      await ctx.answerCbQuery();
      await ctx.editMessageReplyMarkup();
      await voiceNoteController.setIntentConditionAction(ctx, intentKey, action);
    })
  );

  // ===== فريق العمل (مخصص لصاحب المتجر فقط) =====
  bot.hears('👥 فريق العمل', ensureStoreRegistered, requireOwner, asyncHandler(async (ctx) => ctx.reply('👥 إدارة الفريق:', staffMenu)));
  bot.hears('➕ إضافة عضو', ensureStoreRegistered, requireOwner, asyncHandler(staffController.startAddStaff));
  bot.hears('👥 قائمة الفريق', ensureStoreRegistered, requireOwner, asyncHandler(staffController.listStaff));
  bot.hears('🗑 حذف عضو', ensureStoreRegistered, requireOwner, asyncHandler(staffController.promptRemoveStaff));

  Object.keys(storeController.SETTINGS_FIELDS).forEach((label) => {
    bot.hears(
      label,
      ensureStoreRegistered,
      requirePermission(PERMISSIONS.MANAGE_SETTINGS),
      asyncHandler(storeController.promptSettingEdit(label))
    );
  });

  // ===== كود عرض مؤقت (يعطيه السوبر أدمن) =====
  bot.hears(
    '🎟️ استعمال كود عرض',
    ensureStoreRegistered,
    requireOwner,
    asyncHandler(async (ctx) => {
      ctx.session.awaitingPromoCode = true;
      await ctx.reply('أرسل كود العرض اللي عندك:');
    })
  );

  bot.on(
    'text',
    ensureStoreRegistered,
    asyncHandler(async (ctx, next) => {
      if (ctx.session.awaitingDeleteProductId) return productController.handleDeleteProductId(ctx);
      if (ctx.session.awaitingRemoveStaffId) return staffController.handleRemoveStaffId(ctx);
      if (ctx.session.awaitingSettingKey) return storeController.handleSettingValue(ctx);
      if (ctx.session.awaitingManualFbChoice && ctx.message.text.trim() === 'يدوي') {
        return storeController.handleManualFbChoice(ctx);
      }
      if (ctx.session.awaitingFbPageId) return storeController.handleFbPageId(ctx);
      if (ctx.session.awaitingFbPageToken) return storeController.handleFbPageToken(ctx);
      if (ctx.session.awaitingPromoCode) {
        ctx.session.awaitingPromoCode = false;
        try {
          const { plan, trialExpiresAt } = await PromoCodeService.redeemCode(ctx.from.id, ctx.message.text);
          const expiresText = trialExpiresAt.toLocaleString('ar-DZ');
          await ctx.reply(
            `🎉 تم تفعيل العرض! باقتك الآن: ${plan.name}\nينتهي العرض ويرجع متجرك لباقته السابقة تلقائيًا في: ${expiresText}`,
            mainMenu
          );
        } catch (err) {
          await ctx.reply(`⚠️ ${toUserMessage(err)}`, mainMenu);
        }
        return;
      }
      return next ? next() : undefined;
    })
  );

  bot.action(
    /order_(confirm|shipped|delivered|cancel)_(.+)/,
    ensureStoreRegistered,
    requirePermission(PERMISSIONS.MANAGE_ORDERS),
    asyncHandler(orderController.updateOrderStatusAction)
  );
}

module.exports = registerAdminRoutes;
