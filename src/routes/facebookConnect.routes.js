const { env } = require('../config/env');
const logger = require('../utils/logger');
const OAuthConnectRepository = require('../repositories/OAuthConnectRepository');
const StoreService = require('../services/StoreService');
const FacebookMessengerService = require('../services/FacebookMessengerService');

const GRAPH = 'https://graph.facebook.com/v19.0';

// خطوة إلزامية بعد أي ربط: نخبر فيسبوك يبعتلنا webhook لهذه الصفحة، ونضبط زر "Get Started".
// لو فشلت (عادة لأن التطبيق مازال فـ Development Mode وحساب المستخدم ماشي Admin/Tester عليه)،
// ما نوقفوش العملية (الصفحة تبقى مربوطة فـ قاعدة البيانات) لكن نحذر التاجر بوضوح فـ الرسالة.
async function subscribeAndSetup(pageId, pageAccessToken) {
  try {
    await FacebookMessengerService.subscribePageToApp(pageId, pageAccessToken);
    await FacebookMessengerService.setupMessengerProfile(pageAccessToken);
    return '';
  } catch (err) {
    logger.error('فشل تفعيل استقبال الرسائل بعد الربط', { pageId, error: err.message });
    return `<div class="note note-warning">تحذير: الصفحة رُبطت في النظام، لكن فيسبوك رفض تفعيل استقبال الرسائل فعليًا (${err.message}). هذا يصير عادة لأن تطبيق فيسبوك مازال في "وضع التطوير" (Development Mode). راجع بوت التاجر أو تواصل مع الإدارة.</div>`;
  }
}

// اختيار الصفحة (إذا التاجر يدير أكثر من صفحة) يبقى مؤقتًا فـ الذاكرة 5 دقائق فقط - بلا ما
// نمرر التوكن نفسه عبر رابط المتصفح (أمان أفضل). token -> { pages, expiresAt }
// ملاحظة: هذا الكاش يبقى فـ نفس عملية Node اللي تخدم /connect/callback و /connect/select معًا
// (نفس السيرفر Express)، فهو آمن لأن الخطوتين تصيرو فـ نفس الجلسة القصيرة لنفس المستخدم.
const pendingSelections = new Map();

function cleanupExpiredSelections() {
  const now = Date.now();
  for (const [key, val] of pendingSelections) {
    if (val.expiresAt < now) pendingSelections.delete(key);
  }
}

function renderPage(message, { success = false, warning = false, list = null } = {}) {
  const listHtml = list
    ? `<ul class="link-list">${list
        .map((item) => `<li><a href="${item.href}">${item.label}</a></li>`)
        .join('')}</ul>`
    : '';
  const icon = success
    ? '<circle cx="12" cy="12" r="9"/><path d="m8.3 12.5 2.6 2.6L16 9.8"/>'
    : warning
      ? '<path d="M12 3.5 2.5 20h19L12 3.5Z"/><path d="M12 10v4.5"/><path d="M12 17.2v.1"/>'
      : '<path d="M12 8v5M12 16v.1"/><circle cx="12" cy="12" r="9"/>';
  const tone = success ? 'success' : warning ? 'warning' : 'neutral';
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ربط صفحة Facebook — RedonBot</title>
  <link rel="icon" type="image/svg+xml" href="/assets/img/logo.svg" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;650;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0A0A0C; --card: #16161A; --border: #26262B; --text: #F1F1F3; --muted: #8B8B94;
      --success: #35C97F; --success-soft: rgba(53,201,127,.14);
      --warning: #E7B24A; --warning-soft: rgba(231,178,74,.14);
      --accent: #6D5EF5; --accent-soft: rgba(109,94,245,.14);
    }
    * { box-sizing: border-box; }
    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--text);
      display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px;
    }
    .box {
      max-width: 440px; width: 100%; text-align: center; padding: 30px 26px;
      background: var(--card); border: 1px solid var(--border); border-radius: 14px;
      box-shadow: 0 6px 24px rgba(0,0,0,.3);
    }
    .icon-wrap {
      width: 46px; height: 46px; border-radius: 12px; display: flex; align-items: center; justify-content: center;
      margin: 0 auto 16px;
      background: ${tone === 'success' ? 'var(--success-soft)' : tone === 'warning' ? 'var(--warning-soft)' : 'var(--accent-soft)'};
      color: ${tone === 'success' ? 'var(--success)' : tone === 'warning' ? 'var(--warning)' : 'var(--accent)'};
    }
    .icon-wrap svg { width: 24px; height: 24px; }
    .box p { font-size: .95rem; line-height: 1.7; color: var(--text); margin: 0; }
    .note { margin-top: 14px; padding: 10px 12px; border-radius: 9px; font-size: .82rem; text-align: start; line-height: 1.6; }
    .note-warning { background: var(--warning-soft); color: var(--warning); }
    .link-list { list-style: none; padding: 0; margin: 18px 0 0; text-align: start; }
    .link-list li { margin: 8px 0; }
    .link-list a {
      display: block; padding: 12px; background: var(--accent); color: #fff; border-radius: 9px;
      text-decoration: none; font-weight: 600; font-size: .88rem; text-align: center;
    }
    .brand { display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 18px; font-weight: 700; }
    .brand img { width: 22px; height: 22px; border-radius: 5px; }
  </style>
</head>
<body>
  <div class="box">
    <div class="brand"><img src="/assets/img/logo.svg" alt="" /><span>RedonBot</span></div>
    <div class="icon-wrap"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icon}</svg></div>
    <p>${message}</p>
    ${listHtml}
  </div>
</body>
</html>`;
}

function registerFacebookConnectRoutes(app) {
  // يُفتح من بوت التاجر عبر رابط وحيد الاستخدام (10 دقائق) - يبدأ حوار تسجيل الدخول بفيسبوك
  app.get('/connect/start', async (req, res) => {
    const { token } = req.query;
    if (!env.facebook.appId || !env.appBaseUrl) {
      return res
        .status(503)
        .send(renderPage('ميزة "الربط بضغطة واحدة" غير مفعّلة حاليًا من طرف الإدارة. استعمل الطريقة اليدوية من بوت التاجر.'));
    }
    const record = await OAuthConnectRepository.findValid(token);
    if (!record) {
      return res
        .status(400)
        .send(renderPage('هذا الرابط منتهي الصلاحية أو استُعمل من قبل. رجع لبوت التاجر واضغط "ربط صفحة فيسبوك الخاصة بي" من جديد للحصول على رابط جديد.'));
    }

    const redirectUri = `${env.appBaseUrl}/connect/callback`;
    const scope = 'pages_show_list,pages_messaging,pages_manage_metadata';
    const url =
      `https://www.facebook.com/v19.0/dialog/oauth?client_id=${env.facebook.appId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(token)}&scope=${scope}`;
    return res.redirect(url);
  });

  // فيسبوك يرجع للمستخدم هنا بعد الموافقة. state = نفس التوكن وحيد الاستخدام اللي بدأنا بيه.
  app.get('/connect/callback', async (req, res) => {
    const { code, state: token, error, error_description: errorDescription } = req.query;
    if (error) {
      return res.status(400).send(renderPage(`تم إلغاء عملية الربط: ${errorDescription || error}`));
    }
    const record = await OAuthConnectRepository.findValid(token);
    if (!record) {
      return res
        .status(400)
        .send(renderPage('هذا الرابط منتهي الصلاحية أو استُعمل من قبل (كل رابط يخدم مرة واحدة فقط لأمانك). رجع لبوت التاجر واضغط "ربط صفحة فيسبوك الخاصة بي" من جديد.'));
    }
    const { storeId } = record;

    try {
      const redirectUri = `${env.appBaseUrl}/connect/callback`;
      const tokenRes = await fetch(
        `${GRAPH}/oauth/access_token?client_id=${env.facebook.appId}&client_secret=${env.facebook.appSecret}` +
          `&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`
      );
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok || !tokenData.access_token) {
        logger.error('فشل تبادل كود OAuth فيسبوك', { tokenData });
        return res.status(400).send(renderPage('فشل تسجيل الدخول بفيسبوك. رجع لبوت التاجر وأعد المحاولة برابط جديد.'));
      }

      const pagesRes = await fetch(
        `${GRAPH}/me/accounts?fields=id,name,access_token,tasks&access_token=${tokenData.access_token}`
      );
      const pagesData = await pagesRes.json();
      if (!pagesRes.ok) {
        logger.error('فشل جلب صفحات فيسبوك بعد تسجيل الدخول', { pagesData });
        return res.status(400).send(renderPage('فشل جلب قائمة صفحاتك من فيسبوك. رجع لبوت التاجر وأعد المحاولة برابط جديد.'));
      }
      const pages = (pagesData.data || []).filter((p) => p.access_token);

      if (pages.length === 0) {
        return res.send(
          renderPage(
            'لم نجد أي صفحة فيسبوك تديرها بهذا الحساب مع صلاحية كافية. تأكد أنك سجّلت الدخول بحساب فيسبوك الذي يدير صفحتك التجارية، وأنك وافقت على كل الصلاحيات المطلوبة (خصوصًا "pages_show_list" و"pages_messaging").'
          )
        );
      }

      if (pages.length === 1) {
        await StoreService.connectFacebookPage(storeId, { pageId: pages[0].id, pageAccessToken: pages[0].access_token, pageName: pages[0].name, skipValidation: true });
        await OAuthConnectRepository.markCompleted(token);
        const subscribeWarning = await subscribeAndSetup(pages[0].id, pages[0].access_token);
        return res.send(
          renderPage(
            `تم ربط صفحة "${pages[0].name}" بمتجرك بنجاح. يمكنك الرجوع لبوت التاجر على تيليغرام الآن.${subscribeWarning}`,
            { success: true }
          )
        );
      }

      // أكثر من صفحة واحدة - نعرض قائمة اختيار (بلا تمرير التوكن عبر الرابط، ولا نكمّل التوكن الرئيسي بعد)
      cleanupExpiredSelections();
      pendingSelections.set(token, { pages, expiresAt: Date.now() + 5 * 60 * 1000 });
      const list = pages.map((p) => ({
        href: `/connect/select?token=${encodeURIComponent(token)}&pageId=${p.id}`,
        label: p.name,
      }));
      return res.send(renderPage('عندك أكثر من صفحة، اختار الصفحة اللي تحب تربطها بمتجرك:', { list }));
    } catch (err) {
      logger.error('فشل عملية ربط فيسبوك عبر OAuth', { error: err.message });
      return res.status(500).send(renderPage('حدث خطأ غير متوقع. رجع لبوت التاجر وأعد المحاولة برابط جديد.'));
    }
  });

  // اختيار صفحة معيّنة (فقط لما التاجر يدير أكثر من صفحة) - يُكمّل استهلاك التوكن الرئيسي
  app.get('/connect/select', async (req, res) => {
    const { token, pageId } = req.query;
    const record = await OAuthConnectRepository.findValid(token);
    const cached = pendingSelections.get(token);
    if (!record || !cached) {
      return res.status(400).send(renderPage('انتهت صلاحية الرابط أو استُعمل من قبل. رجع لبوت التاجر وأعد المحاولة برابط جديد.'));
    }
    const page = cached.pages.find((p) => p.id === pageId);
    if (!page) return res.status(400).send(renderPage('صفحة غير موجودة، أعد المحاولة من بوت التاجر.'));
    pendingSelections.delete(token);

    try {
      await StoreService.connectFacebookPage(record.storeId, { pageId: page.id, pageAccessToken: page.access_token, pageName: page.name, skipValidation: true });
      await OAuthConnectRepository.markCompleted(token);
      const subscribeWarning = await subscribeAndSetup(page.id, page.access_token);
      return res.send(
        renderPage(
          `تم ربط صفحة "${page.name}" بمتجرك بنجاح. يمكنك الرجوع لبوت التاجر على تيليغرام الآن.${subscribeWarning}`,
          { success: true }
        )
      );
    } catch (err) {
      return res.status(400).send(renderPage(err.message, { warning: true }));
    }
  });
}

module.exports = registerFacebookConnectRoutes;
