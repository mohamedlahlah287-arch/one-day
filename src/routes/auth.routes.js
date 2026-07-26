const crypto = require('crypto');
const express = require('express');
const { env } = require('../config/env');
const logger = require('../utils/logger');
const GoogleAuthService = require('../services/GoogleAuthService');
const EmailService = require('../services/EmailService');
const StoreService = require('../services/StoreService');
const WebUserRepository = require('../repositories/WebUserRepository');
const WebSessionRepository = require('../repositories/WebSessionRepository');
const AccountLinkRepository = require('../repositories/AccountLinkRepository');
const StoreRepository = require('../repositories/StoreRepository');
const OAuthConnectRepository = require('../repositories/OAuthConnectRepository');
const NotificationService = require('../services/NotificationService');
const ProductRepository = require('../repositories/ProductRepository');
const OrderRepository = require('../repositories/OrderRepository');
const CustomerRepository = require('../repositories/CustomerRepository');
const { getMerchantBotUsername } = require('../utils/telegramBotInfo');
const {
  attachWebUser,
  requireWebUser,
  setSessionCookie,
  clearSessionCookie,
} = require('../middlewares/websiteAuthGuard');

function registerAuthRoutes(app) {
  const router = express.Router();
  router.use(attachWebUser);

  // إعدادات صفحة تسجيل الدخول/التسجيل (Client ID تاع Google - عمومي، ماشي سري)
  router.get('/config', (req, res) => {
    res.json({ googleClientId: env.google.clientId, googleEnabled: GoogleAuthService.isConfigured() });
  });

  // تسجيل حساب جديد: أول مرة نتحقق من Google، ثم نطلب باقي المعلومات (الاسم الكامل، الهاتف،
  // تاريخ الميلاد) إذا كان الحساب جديدًا فعلًا.
  router.post('/signup', async (req, res) => {
    try {
      const { credential, phone, fullName, birthDate } = req.body || {};
      const googleUser = await GoogleAuthService.verifyIdToken(credential);

      const existing = await WebUserRepository.findByEmail(googleUser.email);
      if (existing) {
        const token = await WebSessionRepository.create(existing.id);
        setSessionCookie(req, res, token);
        await WebUserRepository.touchLogin(existing.id);
        return res.json({ ok: true, alreadyExists: true, user: publicUser(existing) });
      }

      if (!phone || !fullName || !birthDate) {
        // نرجع بيانات Google المتحقق منها للواجهة الأمامية باش تعرض بقية الحقول (الاسم مسبق التعبئة)
        return res.status(200).json({
          ok: false,
          needsMoreInfo: true,
          googleProfile: { email: googleUser.email, fullName: googleUser.fullName, avatarUrl: googleUser.avatarUrl },
        });
      }

      const user = await WebUserRepository.create({
        email: googleUser.email,
        googleId: googleUser.googleId,
        fullName,
        phone,
        birthDate,
        avatarUrl: googleUser.avatarUrl,
      });

      const token = await WebSessionRepository.create(user.id);
      setSessionCookie(req, res, token);

      // إشعار السوبر أدمن بحساب جديد للمراجعة (البيانات محفوظة أصلًا في Firebase)
      await NotificationService.notifySuperAdmin(
        `👤 حساب موقع جديد للمراجعة:\n\n` +
          `الاسم: ${fullName}\nالإيميل: ${googleUser.email}\nالهاتف: ${phone}\nتاريخ الميلاد: ${birthDate}\n\n` +
          `معرف الحساب: ${user.id}`
      );
      await EmailService.sendWelcomeEmail(googleUser.email, fullName);

      res.json({ ok: true, user: publicUser(user) });
    } catch (err) {
      logger.error('فشل تسجيل حساب جديد عبر الموقع', { error: err.message });
      res.status(400).json({ error: err.message || 'تعذّر إنشاء الحساب' });
    }
  });

  // تسجيل الدخول عبر Google لحساب موجود مسبقًا
  router.post('/login', async (req, res) => {
    try {
      const { credential } = req.body || {};
      const googleUser = await GoogleAuthService.verifyIdToken(credential);
      const user = await WebUserRepository.findByEmail(googleUser.email);
      if (!user) {
        return res.status(404).json({ error: 'لا يوجد حساب بهذا الإيميل. سجّل حساب جديد أولًا.' });
      }
      const token = await WebSessionRepository.create(user.id);
      setSessionCookie(req, res, token);
      await WebUserRepository.touchLogin(user.id);
      res.json({ ok: true, user: publicUser(user) });
    } catch (err) {
      logger.error('فشل تسجيل الدخول عبر الموقع', { error: err.message });
      res.status(400).json({ error: err.message || 'تعذّر تسجيل الدخول' });
    }
  });

  router.post('/logout', attachWebUser, async (req, res) => {
    if (req.webSessionToken) await WebSessionRepository.revoke(req.webSessionToken);
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  router.get('/me', requireWebUser, async (req, res) => {
    let store = null;
    if (req.webUser.linkedStoreId) {
      store = await StoreRepository.findById(req.webUser.linkedStoreId);
    }
    res.json({
      user: publicUser(req.webUser),
      // متاجر أُنشئت مباشرة من الموقع (بلا تيليغرام) يبدأ معرفها بـ "web_" - نستعملها هنا
      // لتحديد هل حساب تيليغرام مربوط فعليًا أم لا (بدل الاعتماد فقط على وجود linkedStoreId).
      telegramLinked: Boolean(store && !String(store.id).startsWith('web_')),
      store: store
        ? {
            id: store.id,
            storeName: store.storeName,
            planName: store.planName,
            subscriptionStatus: store.subscriptionStatus,
            subscriptionExpiresAt: store.subscriptionExpiresAt,
            messageCount: store.messageCount,
            messageLimit: store.messageLimit,
          }
        : null,
    });
  });

  // ينشئ متجرًا جديدًا مباشرة من الموقع لحساب المستخدم الحالي - بلا أي حاجة لتيليغرام.
  // هذا هو المسار الرئيسي الجديد لإنشاء متجر (بديل عن link-telegram الذي يبقى اختياريًا فقط).
  router.post('/store/create', requireWebUser, async (req, res) => {
    try {
      if (req.webUser.linkedStoreId) {
        return res.status(400).json({ error: 'عندك متجر مربوط بحسابك بالفعل.' });
      }
      const storeName = (req.body?.storeName || '').trim();
      const contactPhone = (req.body?.contactPhone || '').trim();
      const referralCode = (req.body?.referralCode || '').trim();
      // معرف متجر عشوائي مستقل تمامًا عن تيليغرام (بادئة web_ لتفادي أي تضارب مع معرفات تيليغرام الرقمية)
      const storeId = `web_${crypto.randomBytes(12).toString('hex')}`;
      const store = await StoreService.createStoreFromWeb(storeId, {
        storeName,
        contactPhone,
        referralCode,
        signupIp: req.ip,
      });
      await WebUserRepository.linkStore(req.webUser.id, storeId);

      await NotificationService.notifySuperAdmin(
        `🏪 متجر جديد أُنشئ مباشرة من الموقع (بلا تيليغرام):\n\nالاسم: ${storeName}\nمعرف المتجر: ${storeId}\nالحساب: ${req.webUser.email}`
      );

      res.json({ ok: true, storeId, storeName: store.storeName });
    } catch (err) {
      logger.error('فشل إنشاء متجر من الموقع مباشرة', { error: err.message });
      res.status(400).json({ error: err.message || 'تعذّر إنشاء المتجر' });
    }
  });

  // إحصائيات سريعة لصفحة "نظرة عامة" في لوحة تحكم الموقع الجديدة (KPIs). نحسبها من نفس
  // المستودعات المستعملة فـ بوت التاجر - بلا الحاجة لأي بنية بيانات إضافية.
  router.get('/dashboard-stats', requireWebUser, async (req, res) => {
    try {
      if (!req.webUser.linkedStoreId) {
        return res.status(404).json({ error: 'لا يوجد متجر مربوط بهذا الحساب' });
      }
      const storeId = req.webUser.linkedStoreId;
      const store = await StoreRepository.findById(storeId);
      if (!store) return res.status(404).json({ error: 'المتجر غير موجود' });

      const [orders, products, customers] = await Promise.all([
        OrderRepository.findAll(storeId, { limit: 1000 }),
        ProductRepository.findAll(storeId, { limit: 1000 }),
        CustomerRepository.findAll(storeId, { limit: 1000 }),
      ]);

      const revenue = orders.reduce((sum, o) => sum + Number(o.total || o.price || 0), 0);
      const ordersByStatus = orders.reduce((acc, o) => {
        acc[o.status] = (acc[o.status] || 0) + 1;
        return acc;
      }, {});

      res.json({
        storeName: store.storeName,
        planName: store.planName,
        subscriptionStatus: store.subscriptionStatus,
        messageCount: store.messageCount || 0,
        messageLimit: store.messageLimit || 0,
        ordersCount: orders.length,
        ordersByStatus,
        revenue,
        productsCount: products.length,
        customersCount: customers.length,
      });
    } catch (err) {
      logger.error('فشل جلب إحصائيات لوحة التحكم', { error: err.message });
      res.status(500).json({ error: 'تعذّر جلب الإحصائيات' });
    }
  });

  // ينشئ رابط تيليغرام وحيد الاستخدام لربط الحساب الحالي بمتجر (أو بمتجر تاجر جديد) - اختياري،
  // فقط لمن يرغب أيضًا فـ استعمال بوت التاجر على تيليغرام (إدارة إضافية أو إشعارات فورية).
  router.post('/link-telegram', requireWebUser, async (req, res) => {
    try {
      const token = await AccountLinkRepository.create(req.webUser.id);
      const username = await getMerchantBotUsername();
      res.json({ ok: true, telegramLink: `https://t.me/${username}?start=link_${token}` });
    } catch (err) {
      logger.error('فشل إنشاء رابط ربط تيليغرام', { error: err.message });
      res.status(500).json({ error: 'تعذّر إنشاء رابط الربط، حاول مرة أخرى' });
    }
  });

  // ينشئ رابط ربط فيسبوك (نفس آلية بوت التاجر) لكن مباشرة من لوحة تحكم الموقع
  router.post('/connect-facebook', requireWebUser, async (req, res) => {
    try {
      if (!req.webUser.linkedStoreId) {
        return res.status(400).json({ error: 'أنشئ متجرك أولًا قبل ربط فيسبوك.' });
      }
      if (!env.facebook.appId || !env.appBaseUrl) {
        return res.status(503).json({ error: 'ميزة الربط بضغطة واحدة غير مفعّلة حاليًا من طرف الإدارة.' });
      }
      const store = await StoreRepository.findById(req.webUser.linkedStoreId);
      if (store?.facebookConnected && store?.facebookPageId) {
        return res.status(400).json({ error: `متجرك مربوط بالفعل بصفحة فيسبوك (معرف: ${store.facebookPageId}).` });
      }
      const token = await OAuthConnectRepository.create(req.webUser.linkedStoreId);
      res.json({ ok: true, connectUrl: `${env.appBaseUrl}/connect/start?token=${token}` });
    } catch (err) {
      logger.error('فشل إنشاء رابط ربط فيسبوك من لوحة تحكم الموقع', { error: err.message });
      res.status(500).json({ error: 'تعذّر إنشاء رابط الربط، حاول مرة أخرى' });
    }
  });

  app.use('/api/auth', router);
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    linkedStoreId: user.linkedStoreId || null,
  };
}

module.exports = registerAuthRoutes;
