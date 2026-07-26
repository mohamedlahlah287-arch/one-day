const express = require('express');
const { env } = require('../config/env');
const { FIRST_PURCHASE_DISCOUNT_PERCENT } = require('../config/plans');
const PlanService = require('../services/PlanService');
const StoreService = require('../services/StoreService');
const StoreRepository = require('../repositories/StoreRepository');
const PendingRegistrationRepository = require('../repositories/PendingRegistrationRepository');
const WebNotificationRepository = require('../repositories/WebNotificationRepository');
const SubscriptionService = require('../services/SubscriptionService');
const ChargilyService = require('../services/ChargilyService');
const ReferralService = require('../services/ReferralService');
const ReferralRepository = require('../repositories/ReferralRepository');
const { getMerchantBotUsername } = require('../utils/telegramBotInfo');
const logger = require('../utils/logger');

module.exports = function registerWebsiteRoutes(app) {
  const router = express.Router();

  // إعدادات عامة يحتاجها الموقع (روابط التواصل، هل الدفع مفعّل...)
  router.get('/config', (req, res) => {
    res.json({
      social: env.social,
      paymentsEnabled: ChargilyService.isConfigured(),
      appBaseUrl: env.appBaseUrl,
    });
  });

  // كل الخطط بالترتيب مع الأسعار (تعكس أي تعديل سواه السوبر أدمن من بوته فورًا)
  router.get('/plans', async (req, res) => {
    try {
      const plans = await PlanService.getAllEffectivePlans();
      res.json({
        order: plans.map((p) => p.id),
        plans,
        firstPurchaseDiscountPercent: FIRST_PURCHASE_DISCOUNT_PERCENT,
      });
    } catch (err) {
      logger.error('فشل جلب الخطط', { error: err.message });
      res.status(500).json({ error: 'تعذّر جلب الباقات' });
    }
  });

  // يبحث عن متجر عبر معرفه (Store ID = نفس معرف Telegram الخاص بصاحب المتجر)
  // يُستعمل في صفحة الدفع لتأكيد هوية التاجر قبل إنشاء عملية الدفع
  router.get('/store/:storeId', async (req, res) => {
    try {
      const store = await StoreRepository.findById(req.params.storeId);
      if (!store) return res.status(404).json({ error: 'لم يتم العثور على متجر بهذا المعرف' });
      res.json({
        id: store.id,
        storeName: store.storeName,
        planId: store.planId,
        planName: store.planName,
        subscriptionStatus: store.subscriptionStatus,
        subscriptionExpiresAt: store.subscriptionExpiresAt,
        hasEverPaid: Boolean(store.hasEverPaid),
        notificationChannel: store.notificationChannel || 'telegram',
      });
    } catch (err) {
      logger.error('خطأ في البحث عن متجر من الموقع', { error: err.message });
      res.status(500).json({ error: 'خطأ في السيرفر' });
    }
  });

  // ينشئ متجرًا جديدًا مباشرة من الموقع (بلا الحاجة لفورم /register المنفصل): التاجر يدخل اسم
  // متجره ومعرف Telegram تاعو (اختياري، للتحقق السريع فقط)، ونرجعله رابط تيليغرام يفتحه مرة
  // وحدة فقط ليأكد هويته (نفس آلية /register - لازم نتأكد أن معرف Telegram حقيقي وأنه هو نفسه
  // اللي ضغط "ابدأ"، ماشي أي رقم يكتبه أي حد فـ الفورم - هذا سبب وجود هذه الخطوة الوحيدة).
  // بعد هذا التأكيد الوحيد، التاجر يقدر يدير كل شيء من لوحة تحكم الموقع بلا ما يرجع لتيليغرام.
  router.post('/store/create', async (req, res) => {
    try {
      const storeName = (req.body?.storeName || '').trim();
      const telegramId = (req.body?.telegramId || '').trim();
      const referralCode = (req.body?.referralCode || '').trim();

      if (storeName.length < 2) {
        return res.status(400).json({ error: 'اسم المتجر قصير جدًا' });
      }
      if (telegramId && !/^\d{5,}$/.test(telegramId)) {
        return res.status(400).json({ error: 'معرف Telegram غير صحيح (يجب أن يكون رقمًا)' });
      }

      // إذا هذا المعرف عنده متجر بالفعل، نوجهه مباشرة للوحة التحكم بلا تكرار
      if (telegramId) {
        const existing = await StoreRepository.findById(telegramId);
        if (existing) {
          return res.json({ ok: true, alreadyExists: true, storeId: existing.id });
        }
      }

      const token = await PendingRegistrationRepository.create({
        storeName,
        ownerName: '',
        phone: '',
        referralCode,
        signupIp: req.ip,
      });
      let telegramLink = null;
      try {
        const username = await getMerchantBotUsername();
        telegramLink = `https://t.me/${username}?start=reg_${token}`;
      } catch (err) {
        logger.error('فشل جلب اسم بوت التاجر (getMe)', { error: err.message });
      }

      res.json({ ok: true, alreadyExists: false, telegramLink });
    } catch (err) {
      logger.error('فشل إنشاء متجر من الموقع', { error: err.message });
      res.status(500).json({ error: 'تعذّر إنشاء المتجر' });
    }
  });

  // يحدّث إعدادات المتجر من لوحة تحكم الموقع (حاليًا: قناة الإشعارات - تيليغرام أو الموقع)
  router.patch('/store/:storeId/settings', async (req, res) => {
    try {
      const { notificationChannel } = req.body || {};
      const updated = await StoreService.updateSettings(req.params.storeId, { notificationChannel });
      res.json({ ok: true, notificationChannel: updated.notificationChannel });
    } catch (err) {
      logger.error('فشل تحديث إعدادات المتجر من الموقع', { error: err.message });
      res.status(400).json({ error: err.message || 'تعذّر تحديث الإعدادات' });
    }
  });

  // إشعارات صاحب المتجر لما يكون اختار قناة "الموقع" بدل تيليغرام (طلبات جديدة...)
  router.get('/store/:storeId/notifications', async (req, res) => {
    try {
      const notifications = await WebNotificationRepository.listRecent(req.params.storeId, 30);
      res.json({ notifications });
    } catch (err) {
      logger.error('فشل جلب إشعارات المتجر من الموقع', { error: err.message });
      res.status(500).json({ error: 'تعذّر جلب الإشعارات' });
    }
  });

  // ينشئ عملية دفع (checkout) عبر Chargily لباقة معينة
  router.post('/checkout', async (req, res) => {
    try {
      const { storeId, planId } = req.body;
      if (!storeId || !planId) return res.status(400).json({ error: 'storeId و planId مطلوبان' });

      const plan = await PlanService.getEffectivePlan(planId);
      if (!plan) return res.status(400).json({ error: 'باقة غير معروفة' });
      if (plan.price === 0) return res.status(400).json({ error: 'الباقة المجانية لا تحتاج دفع' });

      const store = await StoreRepository.findByIdOrFail(storeId);
      const isFirstPurchase = !store.hasEverPaid;
      const discountPercent = isFirstPurchase ? FIRST_PURCHASE_DISCOUNT_PERCENT : 0;
      const final = Math.round(plan.price * (1 - discountPercent / 100));

      // استعمال رصيد المحفظة (عمولات الإحالة) تلقائيًا لتخفيض المبلغ المطلوب دفعه
      const { walletApplied, remaining } = ReferralService.computeWalletApplication(store, final);

      // إذا الرصيد يغطي كامل المبلغ، ما نحتاجش نمرّ عبر Chargily إطلاقًا - نفعّل الاشتراك مباشرة
      if (remaining <= 0 && walletApplied > 0) {
        await StoreRepository.incrementWallet(storeId, -walletApplied);
        await SubscriptionService.renew(storeId, plan);
        await StoreRepository.update(storeId, { hasEverPaid: true, lastPaymentAmount: final });
        await ReferralService.onSubscriptionPaid({ storeId, amountPaid: final });
        logger.info('تم تفعيل الاشتراك بالكامل عبر رصيد المحفظة (بدون Chargily)', { storeId, planId, walletApplied });
        return res.json({ ok: true, freeViaWallet: true, walletApplied, amount: 0 });
      }

      if (!ChargilyService.isConfigured()) {
        return res.status(503).json({ error: 'الدفع الإلكتروني غير مفعّل بعد. أضف CHARGILY_SECRET_KEY في متغيرات البيئة.' });
      }

      const checkout = await ChargilyService.createCheckout({
        amount: remaining,
        description: `اشتراك باقة ${plan.name} - ${store.storeName || storeId}`,
        storeId,
        planId,
        walletApplied,
        planValue: final,
        successUrl: `${env.appBaseUrl}/payment-success.html`,
        failureUrl: `${env.appBaseUrl}/payment-failed.html`,
      });

      res.json({ checkoutUrl: checkout.checkout_url, amount: remaining, walletApplied });
    } catch (err) {
      logger.error('خطأ في إنشاء عملية دفع', { error: err.message });
      res.status(500).json({ error: err.message || 'تعذّر إنشاء عملية الدفع' });
    }
  });

  app.use('/api', router);
};

// ⚠️ مهم: هذا المسار يجب تسجيله على app قبل express.json() العام،
// لأن التحقق من توقيع Chargily يحتاج الـ body الخام (raw bytes) وليس JSON مُحلَّل.
// لهذا هو مُصدَّر بشكل منفصل ويُستدعى في customerBot.js قبل app.use(express.json()).
module.exports.registerChargilyWebhook = function registerChargilyWebhook(app) {
  app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
      const signature = req.headers['signature'];
      const isValid = ChargilyService.verifyWebhookSignature(req.body, signature);
      if (!isValid) {
        logger.warn('توقيع webhook غير صالح من Chargily - تم تجاهل الطلب');
        return res.status(403).send('invalid signature');
      }

      const event = JSON.parse(req.body.toString('utf8'));
      const checkout = event?.data;
      const meta = Array.isArray(checkout?.metadata) ? checkout.metadata[0] : checkout?.metadata;
      const storeId = meta?.storeId;
      const planId = meta?.planId;
      const walletApplied = Number(meta?.walletApplied) || 0;
      // planValue = القيمة الكاملة للباقة (كاش + رصيد)، وهي أساس احتساب عمولة الإحالة. لو غير
      // موجودة (حالات قديمة قبل هذا التحديث) نرجع للمبلغ المدفوع كاش فقط.
      const planValue = Number(meta?.planValue) || Number(checkout?.amount) || 0;

      // حماية من معالجة نفس حدث الدفع مرتين (Chargily قد يعيد إرسال نفس الـ webhook)
      const alreadyProcessed = await ReferralRepository.isPaymentEventProcessed(checkout?.id);

      if (event.type === 'checkout.paid' && storeId && planId && !alreadyProcessed) {
        const plan = await PlanService.getEffectivePlan(planId);
        if (plan) {
          if (walletApplied > 0) {
            await StoreRepository.incrementWallet(storeId, -walletApplied);
          }
          await SubscriptionService.renew(storeId, plan);
          await StoreRepository.update(storeId, { hasEverPaid: true, lastPaymentAmount: checkout.amount });
          await ReferralService.onSubscriptionPaid({ storeId, amountPaid: planValue });
          await ReferralRepository.markPaymentEventProcessed(checkout?.id);
          logger.info('تم تفعيل الاشتراك تلقائيًا بعد الدفع', { storeId, planId, amount: checkout.amount, walletApplied });
        }
      } else if (alreadyProcessed) {
        logger.info('تم تجاهل حدث دفع مكرر (webhook معاد الإرسال)', { checkoutId: checkout?.id });
      } else {
        logger.info('حدث دفع غير مكتمل أو ناقص البيانات', { type: event?.type, storeId, planId });
      }

      res.status(200).send('ok');
    } catch (err) {
      logger.error('خطأ في معالجة webhook من Chargily', { error: err.message });
      res.status(500).send('error');
    }
  });
};
