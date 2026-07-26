const StoreService = require('../../services/StoreService');
const { env } = require('../../config/env');
const { settingsMenu, mainMenu, cancelKeyboard } = require('../../ui/adminKeyboards');
const FacebookMessengerService = require('../../services/FacebookMessengerService');
const OAuthConnectRepository = require('../../repositories/OAuthConnectRepository');

const SETTINGS_FIELDS = {
  '✏️ اسم المتجر': { key: 'storeName', prompt: 'اكتب اسم المتجر الجديد:' },
  '✏️ رسالة الترحيب': { key: 'welcomeMessage', prompt: 'اكتب رسالة الترحيب الجديدة:' },
  '✏️ رقم التواصل': { key: 'contactPhone', prompt: 'اكتب رقم التواصل الجديد:' },
  '✏️ مدة التوصيل': { key: 'deliveryTime', prompt: 'اكتب مدة التوصيل الجديدة:' },
};

async function showSettingsMenu(ctx) {
  await ctx.reply('⚙️ الإعدادات:', settingsMenu);
}

async function showMainMenu(ctx) {
  await ctx.reply('القائمة الرئيسية:', mainMenu);
}

// يعرض للتاجر رابط الموقع لتفعيل/تجديد اشتراكه بنفسه (اختيار الباقة والدفع يتم من الموقع فقط، ماشي من هنا)
async function showBillingLink(ctx) {
  const store = ctx.state.store;
  if (!env.appBaseUrl) {
    return ctx.reply('⚠️ رابط الموقع (APP_BASE_URL) غير مضبوط بعد من طرف الإدارة. تواصل معنا يدويًا.');
  }
  const link = `${env.appBaseUrl}/#billing?store=${store.id}`;
  await ctx.reply(
    `💳 معرف متجرك (Store ID): \`${store.id}\`\n\n` +
      `باقتك الحالية: ${store.planName || '-'}\n` +
      `الحالة: ${store.subscriptionStatus === 'active' ? '✅ نشط' : store.subscriptionStatus === 'trial' ? '🕒 تجريبي' : '❌ منتهي'}\n\n` +
      `لاختيار باقة جديدة أو تجديد اشتراكك والدفع مباشرة ببطاقة إدهابية أو CIB، افتح الرابط:\n${link}`,
    { parse_mode: 'Markdown' }
  );
}

function promptSettingEdit(label) {
  return async (ctx) => {
    ctx.session.awaitingSettingKey = SETTINGS_FIELDS[label].key;
    await ctx.reply(SETTINGS_FIELDS[label].prompt);
  };
}

// يبدّل تفعيل/إيقاف "تأكيد الطلب للزبون" من الإعدادات (بدون حاجة لكتابة أي نص، مجرد ضغطة).
async function toggleOrderConfirmation(ctx) {
  const enabled = await StoreService.toggleOrderConfirmation(ctx.state.store.id);
  if (enabled) {
    await ctx.reply(
      '🔔 تم تفعيل "تأكيد الطلب للزبون".\n\nمن الآن، عند ضغطك على "✅ تم التأكيد" فوق أي طلب، يوصل الزبون رسالة أن طلبه تأكد.',
      settingsMenu
    );
  } else {
    await ctx.reply(
      '🔕 تم إيقاف "تأكيد الطلب للزبون".\n\nمن الآن، الطلب يظهر مباشرة وتجهزه بلا حاجة لتأكيده، وما توصلش للزبون أي رسالة تأكيد.',
      settingsMenu
    );
  }
}

async function handleSettingValue(ctx) {
  const key = ctx.session.awaitingSettingKey;
  try {
    await StoreService.updateSettings(ctx.state.store.id, { [key]: ctx.message.text.trim() });
    ctx.session.awaitingSettingKey = null;
    await ctx.reply('✅ تم التحديث بنجاح.', mainMenu);
  } catch (err) {
    await ctx.reply(`⚠️ ${err.message}`);
  }
}

async function showStoreLink(ctx) {
  const store = ctx.state.store;
  const storeId = store.id;

  // إذا التاجر ربط صفحته الخاصة، الزبون يدخل مباشرة لصفحته (بلا حاجة لـ ref أصلاً)
  if (store.facebookConnected && store.facebookPageId) {
    return ctx.reply(
      `🔗 متجرك مربوط بصفحتك الخاصة على فيسبوك ✅\n\nأي زبون يراسل صفحتك مباشرة سيدخل تلقائيًا لمتجرك. رابط صفحتك:\nhttps://www.facebook.com/${store.facebookPageId}`
    );
  }

  if (!env.facebook.pageUsername) {
    return ctx.reply(
      '⚠️ ما تحددش بعد اسم صفحة فيسبوك (FB_PAGE_USERNAME) في إعدادات النظام. تواصل مع الإدارة.'
    );
  }
  const link = `https://m.me/${env.facebook.pageUsername}?ref=${storeId}`;
  await ctx.reply(
    `🔗 هذا هو رابط متجرك على فيسبوك ماسنجر (صفحة مشتركة). شاركه مع زبائنك في إعلاناتك:\n\n${link}\n\n💡 نصيحة: تقدر تربط صفحتك الخاصة بك من "⚙️ الإعدادات" → "📘 ربط صفحة فيسبوك الخاصة بي" باش يكون عندك رابط ثابت خاص بيك وحدك.`
  );
}

// ===== ربط صفحة فيسبوك الخاصة بالمتجر =====

async function startConnectFacebook(ctx) {
  const store = ctx.state.store;
  const storeId = store.id;

  // ما نخليوش صاحب متجر يربط صفحة جديدة بلا ما يفصل القديمة أولاً (يحمي من ربط صفحات
  // متعددة بالغلط، ويحضّر الطريق لو حبينا نحددو عدد الصفحات حسب الباقة مستقبلاً)
  if (store.facebookConnected && store.facebookPageId) {
    return ctx.reply(
      `📘 متجرك مربوط بالفعل بصفحة فيسبوك (معرف الصفحة: ${store.facebookPageId}) ✅\n\n` +
        'إذا حبيت تربط صفحة أخرى بلاصتها، اكتب "🔌 فصل الصفحة" أولاً، وبعدها اعمل الربط من جديد.'
    );
  }

  if (env.facebook.appId && env.appBaseUrl) {
    const token = await OAuthConnectRepository.create(storeId);
    const link = `${env.appBaseUrl}/connect/start?token=${token}`;
    await ctx.reply(
      `📘 اضغط الرابط التالي وسجّل دخولك بفيسبوك واختار صفحتك، وخلاص يتربط كل شيء تلقائيًا (30 ثانية):\n\n${link}\n\n` +
        '⏳ هذا الرابط صالح لمرة واحدة فقط ولمدة 10 دقائق (لأمانك). إذا انتهت صلاحيته أو أغلقت الصفحة قبل ما تكمل، فقط اضغط هذا الزر من جديد وتوصلك رابط جديد.\n\n' +
        '💡 إذا فضّلت الطريقة اليدوية (Page ID + Access Token)، اكتب "يدوي".'
    );
    ctx.session.awaitingManualFbChoice = true;
    return;
  }
  return startManualConnectFacebook(ctx);
}

async function handleDisconnectFacebook(ctx) {
  const store = ctx.state.store;
  if (!store.facebookConnected) {
    return ctx.reply('ما عندكش صفحة مربوطة حاليًا.', mainMenu);
  }
  await StoreService.disconnectFacebookPage(store.id);
  FacebookMessengerService.invalidateTokenCache(store.id);
  await ctx.reply(
    '✅ تم فصل صفحتك. زبائنك يرجعو يدخلو عبر الصفحة المشتركة لحد ما تربط صفحة جديدة.\n\nاكتب "📘 ربط صفحة فيسبوك الخاصة بي" لما تحب تربط صفحة أخرى.',
    mainMenu
  );
}

async function startManualConnectFacebook(ctx) {
  ctx.session.awaitingManualFbChoice = false;
  ctx.session.awaitingFbPageId = true;
  await ctx.reply(
    '📘 باش تربط صفحتك الخاصة، تحتاج:\n1) معرف الصفحة (Page ID)\n2) توكن وصول الصفحة (Page Access Token)\n\nتقدر تجيبهم من Meta Business Suite → إعدادات الصفحة → أدوات المطورين، أو من تطبيق فيسبوك للمطورين الخاص بك.\n\n⚠️ ملاحظة مهمة: فيسبوك (ميتا) يشترط مراجعة تطبيقك (App Review) لصلاحية pages_messaging قبل ما تقدر ترسل رسائل فعلية عبر صفحتك فـ الإنتاج. هذا شرط من ميتا نفسها وماشي حاجة نتحكم فيها.\n\nأرسل الآن معرف الصفحة (Page ID):',
    cancelKeyboard
  );
}

async function handleManualFbChoice(ctx) {
  ctx.session.awaitingManualFbChoice = false;
  return startManualConnectFacebook(ctx);
}

async function handleFbPageId(ctx) {
  const pageId = ctx.message.text.trim();
  if (ctx.message.text === '❌ إلغاء') {
    ctx.session.awaitingFbPageId = false;
    return ctx.reply('تم الإلغاء.', mainMenu);
  }
  ctx.session.awaitingFbPageId = false;
  ctx.session.pendingFbPageId = pageId;
  ctx.session.awaitingFbPageToken = true;
  await ctx.reply('الآن أرسل توكن وصول الصفحة (Page Access Token):', cancelKeyboard);
}

async function handleFbPageToken(ctx) {
  const token = ctx.message.text.trim();
  ctx.session.awaitingFbPageToken = false;
  if (ctx.message.text === '❌ إلغاء') {
    ctx.session.pendingFbPageId = null;
    return ctx.reply('تم الإلغاء.', mainMenu);
  }
  const pageId = ctx.session.pendingFbPageId;
  ctx.session.pendingFbPageId = null;
  try {
    await StoreService.connectFacebookPage(ctx.state.store.id, { pageId, pageAccessToken: token });
    FacebookMessengerService.invalidateTokenCache(ctx.state.store.id);
    try {
      await FacebookMessengerService.subscribePageToApp(pageId, token);
      await FacebookMessengerService.setupMessengerProfile(token);
      await ctx.reply('✅ تم ربط صفحتك بنجاح! أي زبون يراسل صفحتك سيدخل تلقائيًا لمتجرك.', mainMenu);
    } catch (subscribeErr) {
      await ctx.reply(
        `⚠️ تم حفظ بيانات الصفحة، لكن فيسبوك رفض تفعيل استقبال الرسائل فعليًا (${subscribeErr.message}).\n\nهذا يصير عادة لأن تطبيق فيسبوك مازال فـ "وضع التطوير" - تواصل مع الإدارة.`,
        mainMenu
      );
    }
  } catch (err) {
    await ctx.reply(`⚠️ ${err.message}`, mainMenu);
  }
}

module.exports = {
  SETTINGS_FIELDS,
  showSettingsMenu,
  showMainMenu,
  promptSettingEdit,
  handleSettingValue,
  toggleOrderConfirmation,
  showStoreLink,
  showBillingLink,
  startConnectFacebook,
  handleDisconnectFacebook,
  handleManualFbChoice,
  handleFbPageId,
  handleFbPageToken,
};
