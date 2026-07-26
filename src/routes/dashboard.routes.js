const express = require('express');
const ProductService = require('../services/ProductService');
const ProductRepository = require('../repositories/ProductRepository');
const ProductImageService = require('../services/ProductImageService');
const OrderService = require('../services/OrderService');
const CustomerRepository = require('../repositories/CustomerRepository');
const StoreService = require('../services/StoreService');
const StoreRepository = require('../repositories/StoreRepository');
const WebUserRepository = require('../repositories/WebUserRepository');
const CouponService = require('../services/CouponService');
const CouponRepository = require('../repositories/CouponRepository');
const RatingRepository = require('../repositories/RatingRepository');
const RatingService = require('../services/RatingService');
const WebNotificationRepository = require('../repositories/WebNotificationRepository');
const OrderRepository = require('../repositories/OrderRepository');
const FacebookSessionRepository = require('../repositories/FacebookSessionRepository');
const VoiceNoteService = require('../voiceNotes/VoiceNoteService');
const { INTENT_KEYS } = require('../engine/responseEngine');
const { INTENT_LABELS_AR } = require('../ui/voiceNoteKeyboards');
const { mergeConditions, NO_PRODUCT_ACTIONS } = require('../engine/voiceConditions');
const { PERMISSIONS, PERMISSION_LABELS, PRESET_ROLES, CUSTOM_PERMISSION_LIST } = require('../config/permissions');
const StoreDictionaryService = require('../learning/dictionary/StoreDictionaryService');
const StoreDictionaryRepository = require('../learning/dictionary/StoreDictionaryRepository');
const DecisionService = require('../learning/decisions/DecisionService');
const DecisionRepository = require('../learning/decisions/DecisionRepository');
const ConversationLogService = require('../learning/conversationLog/ConversationLogService');
const LearningStatsService = require('../learning/stats/LearningStatsService');
const { normalizeMessage } = require('../learning/normalization/textNormalizer');
const { requireWebUser, attachWebUser } = require('../middlewares/websiteAuthGuard');
const PlanService = require('../services/PlanService');
const DeliveryService = require('../services/DeliveryService');
const AIAdvisorService = require('../services/ai/AIAdvisorService');
const { mergeWithDefaults } = require('../config/aiSettings');
const ExcelExportService = require('../services/ExcelExportService');
const BroadcastService = require('../services/BroadcastService');
const BackupService = require('../services/BackupService');
const ChargilyService = require('../services/ChargilyService');
const SubscriptionService = require('../services/SubscriptionService');
const ReferralService = require('../services/ReferralService');
const { FIRST_PURCHASE_DISCOUNT_PERCENT } = require('../config/plans');
const { MIN_WITHDRAWAL_AMOUNT } = require('../config/referral');
const { env } = require('../config/env');
const OAuthConnectRepository = require('../repositories/OAuthConnectRepository');
const logger = require('../utils/logger');

// يتأكد أن باقة المتجر تحتوي الميزة المطلوبة قبل السماح بالوصول لمسارات مدفوعة (موظفون/
// سلات متروكة/رسائل صوتية/تحليلات كاملة) - نفس منطق الحواجز المستعملة فـ بوت تيليغرام لكن
// كحاجز REST بلا تكرار قائمة الميزات نفسها (مصدرها الوحيد src/config/plans.js عبر store.features).
function requireFeature(featureKey, message) {
  return async (req, res, next) => {
    try {
      const store = await StoreRepository.findById(req.storeId);
      if (!store) return res.status(404).json({ error: 'المتجر غير موجود' });
      if (!store.features || !store.features[featureKey]) {
        return res.status(403).json({ error: message || 'هذه الميزة غير متوفرة فـ باقتك الحالية.', upgradeRequired: true });
      }
      req.store = store;
      next();
    } catch (err) {
      logger.error('فشل التحقق من ميزة الباقة', { error: err.message, featureKey });
      res.status(500).json({ error: 'تعذّر التحقق من باقتك' });
    }
  };
}

// كل المسارات هنا تخص إدارة متجر مربوط بحساب موقع (وليس بوت تيليغرام التاجر) - جزء من
// الانتقال التدريجي لجعل لوحة تحكم الموقع مصدر الحقيقة الرئيسي (بدل تيليغرام)، حسب بند 3
// من خطة إعادة البناء. كل الميزات هنا تعتمد على نفس الخدمات/المستودعات المستعملة فـ بوت
// التاجر على تيليغرام - بلا أي تكرار للمنطق.

// يتأكد أن المستخدم مسجل دخول وعنده متجر مربوط، ويحقن storeId فـ الطلب لتفادي تكرار هذا
// التحقق فـ كل مسار على حدة.
function requireStore(req, res, next) {
  if (!req.webUser.linkedStoreId) {
    return res.status(400).json({ error: 'لا يوجد متجر مربوط بهذا الحساب بعد' });
  }
  req.storeId = req.webUser.linkedStoreId;
  next();
}

module.exports = function registerDashboardRoutes(app) {
  const router = express.Router();
  router.use(attachWebUser, requireWebUser, requireStore);

  // ===== المنتجات =====

  router.get('/products', async (req, res) => {
    try {
      const products = await ProductService.listProducts(req.storeId);
      res.json({ products });
    } catch (err) {
      logger.error('فشل جلب المنتجات من لوحة التحكم', { error: err.message });
      res.status(500).json({ error: 'تعذّر جلب المنتجات' });
    }
  });

  // يرفع صورة منتج واحدة (خانة 1 أو 2)، يخزّنها بشكل دائم، ويولّد وصفًا مبدئيًا من الصورة
  // عبر الذكاء الاصطناعي (نفس فكرة رفع صورة عبر تيليغرام، لكن من الموقع). الفورم يرسل صورة
  // واحدة فـ كل نداء حتى يبان تقدّم الرفع بوضوح فـ الواجهة.
  router.post('/products/image', async (req, res) => {
    try {
      const { base64, mimeType, slot } = req.body || {};
      const imageUrl = await ProductImageService.persistImage(req.storeId, slot === 2 ? 2 : 1, { base64, mimeType });
      const description = await ProductImageService.describeFromImageUrl(imageUrl);
      res.json({ ok: true, imageUrl, description });
    } catch (err) {
      logger.error('فشل رفع صورة منتج من لوحة التحكم', { error: err.message });
      res.status(400).json({ error: err.message || 'تعذّر رفع الصورة' });
    }
  });

  router.post('/products', async (req, res) => {
    try {
      const { name, price, description, quantity, images } = req.body || {};
      const cleanImages = Array.isArray(images) ? images.filter(Boolean).slice(0, 2) : [];
      const productData = {
        name: (name || '').trim(),
        price: Number(price),
        description: (description || '').trim(),
        quantity: quantity === '' || quantity === undefined || quantity === null ? null : Number(quantity),
        images: cleanImages,
        imageUrl: cleanImages[0] || null,
      };
      const id = await ProductService.addProduct(req.storeId, productData);
      res.json({ ok: true, id });
    } catch (err) {
      logger.error('فشل إضافة منتج من لوحة التحكم', { error: err.message });
      res.status(400).json({ error: err.message || 'تعذّر إضافة المنتج' });
    }
  });

  router.put('/products/:id', async (req, res) => {
    try {
      await ProductRepository.findByIdOrFail(req.storeId, req.params.id, 'المنتج');
      const { name, price, description, quantity, images } = req.body || {};
      const fields = {};
      if (name !== undefined) fields.name = String(name).trim();
      if (price !== undefined) fields.price = Number(price);
      if (description !== undefined) fields.description = String(description).trim();
      if (quantity !== undefined) fields.quantity = quantity === '' || quantity === null ? null : Number(quantity);
      if (images !== undefined) {
        const cleanImages = Array.isArray(images) ? images.filter(Boolean).slice(0, 2) : [];
        fields.images = cleanImages;
        fields.imageUrl = cleanImages[0] || null;
      }
      const updated = await ProductRepository.update(req.storeId, req.params.id, fields);
      res.json({ ok: true, product: updated });
    } catch (err) {
      logger.error('فشل تعديل منتج من لوحة التحكم', { error: err.message });
      res.status(400).json({ error: err.message || 'تعذّر تعديل المنتج' });
    }
  });

  router.delete('/products/:id', async (req, res) => {
    try {
      await ProductService.deleteProduct(req.storeId, req.params.id);
      res.json({ ok: true });
    } catch (err) {
      logger.error('فشل حذف منتج من لوحة التحكم', { error: err.message });
      res.status(400).json({ error: err.message || 'تعذّر حذف المنتج' });
    }
  });

  // ===== الطلبات =====

  router.get('/orders', async (req, res) => {
    try {
      const orders = await OrderService.listOrders(req.storeId, 200);
      res.json({ orders });
    } catch (err) {
      logger.error('فشل جلب الطلبات من لوحة التحكم', { error: err.message });
      res.status(500).json({ error: 'تعذّر جلب الطلبات' });
    }
  });

  router.patch('/orders/:id/status', async (req, res) => {
    try {
      const { status } = req.body || {};
      const actor = { id: req.webUser?.id || req.webUser?.uid, name: req.webUser?.name || req.webUser?.email };
      const order = await OrderService.updateStatus(req.storeId, req.params.id, status, actor);
      res.json({ ok: true, order });
    } catch (err) {
      logger.error('فشل تحديث حالة طلب من لوحة التحكم', { error: err.message });
      res.status(400).json({ error: err.message || 'تعذّر تحديث حالة الطلب' });
    }
  });

  // ===== العملاء =====

  router.get('/customers', async (req, res) => {
    try {
      const customers = await CustomerRepository.findAll(req.storeId, { limit: 300 });
      res.json({ customers });
    } catch (err) {
      logger.error('فشل جلب العملاء من لوحة التحكم', { error: err.message });
      res.status(500).json({ error: 'تعذّر جلب العملاء' });
    }
  });

  // ===== إعدادات المتجر =====

  router.get('/store-settings', async (req, res) => {
    try {
      const store = await StoreRepository.findById(req.storeId);
      if (!store) return res.status(404).json({ error: 'المتجر غير موجود' });
      res.json({
        storeName: store.storeName || '',
        welcomeMessage: store.welcomeMessage || '',
        contactPhone: store.contactPhone || '',
        deliveryTime: store.deliveryTime || '',
        notificationChannel: store.notificationChannel || 'web',
        facebookConnected: Boolean(store.facebookPageId),
        facebookPageId: store.facebookPageId || null,
        facebookPageName: store.facebookPageName || null,
        facebookConnectedAt: store.facebookConnectedAt || null,
        telegramLinked: !String(req.storeId).startsWith('web_'),
      });
    } catch (err) {
      logger.error('فشل جلب إعدادات المتجر من لوحة التحكم', { error: err.message });
      res.status(500).json({ error: 'تعذّر جلب إعدادات المتجر' });
    }
  });

  router.put('/store-settings', async (req, res) => {
    try {
      const { storeName, welcomeMessage, contactPhone, deliveryTime, notificationChannel } = req.body || {};
      const payload = { storeName, welcomeMessage, contactPhone, deliveryTime, notificationChannel };
      Object.keys(payload).forEach((k) => { if (payload[k] === undefined) delete payload[k]; });
      const updated = await StoreService.updateSettings(req.storeId, payload);
      res.json({ ok: true, store: updated });
    } catch (err) {
      logger.error('فشل تحديث إعدادات المتجر من لوحة التحكم', { error: err.message });
      res.status(400).json({ error: err.message || 'تعذّر تحديث إعدادات المتجر' });
    }
  });

  // ===== ربط / تغيير / حذف صفحة Facebook Messenger من لوحة تحكم الموقع =====
  // storeId يُؤخذ دائمًا من الجلسة (requireStore) - لا يُطلب من التاجر إدخال أي معرف يدويًا.

  // ينشئ رابط بدء الربط بضغطة واحدة. يُستعمل لأول ربط، ولـ "تغيير الصفحة" أيضًا (بعد موافقة
  // التاجر على تحذير الفصل من الواجهة) - لهذا لا يوجد هنا أي رفض إذا كانت صفحة مربوطة بالفعل.
  router.post('/facebook/connect', async (req, res) => {
    try {
      if (!env.facebook.appId || !env.appBaseUrl) {
        return res.status(503).json({ error: 'ميزة الربط بضغطة واحدة غير مفعّلة حاليًا من طرف الإدارة.' });
      }
      const token = await OAuthConnectRepository.create(req.storeId);
      res.json({ ok: true, connectUrl: `${env.appBaseUrl}/connect/start?token=${token}` });
    } catch (err) {
      logger.error('فشل إنشاء رابط ربط/تغيير فيسبوك من لوحة التحكم', { error: err.message });
      res.status(500).json({ error: 'تعذّر إنشاء رابط الربط، حاول مرة أخرى' });
    }
  });

  // يفصل صفحة Facebook الحالية عن المتجر فورًا (بلا الحاجة للتواصل مع الدعم)
  router.post('/facebook/disconnect', async (req, res) => {
    try {
      const store = await StoreRepository.findById(req.storeId);
      if (!store?.facebookConnected && !store?.facebookPageId) {
        return res.status(400).json({ error: 'لا توجد صفحة مربوطة أصلاً.' });
      }
      await StoreService.disconnectFacebookPage(req.storeId);
      res.json({ ok: true });
    } catch (err) {
      logger.error('فشل حذف ربط فيسبوك من لوحة التحكم', { error: err.message });
      res.status(400).json({ error: err.message || 'تعذّر حذف الربط' });
    }
  });

  // ===== الاشتراك والفوترة (نفس تصميم لوحة التحكم بالكامل - بلا أي صفحة قديمة منفصلة) =====

  router.get('/billing', async (req, res) => {
    try {
      const store = await StoreRepository.findById(req.storeId);
      if (!store) return res.status(404).json({ error: 'المتجر غير موجود' });
      const plans = await PlanService.getPaidEffectivePlans();
      res.json({
        store: {
          planId: store.planId || 'free',
          planName: store.planName || 'المجانية',
          subscriptionStatus: store.subscriptionStatus || null,
          subscriptionExpiresAt: store.subscriptionExpiresAt || null,
          messageCount: store.messageCount || 0,
          messageLimit: store.messageLimit ?? null,
          hasEverPaid: Boolean(store.hasEverPaid),
        },
        plans,
        paymentsEnabled: ChargilyService.isConfigured(),
        firstPurchaseDiscountPercent: FIRST_PURCHASE_DISCOUNT_PERCENT,
      });
    } catch (err) {
      logger.error('فشل جلب بيانات الاشتراك من لوحة التحكم', { error: err.message });
      res.status(500).json({ error: 'تعذّر جلب بيانات الاشتراك' });
    }
  });

  // ينشئ عملية دفع لباقة مختارة - نفس منطق /api/checkout العام، لكن storeId يُؤخذ من الجلسة
  // الحالية دائمًا (بلا أي إدخال يدوي لمعرف المتجر).
  router.post('/billing/checkout', async (req, res) => {
    try {
      const { planId } = req.body || {};
      const plan = await PlanService.getEffectivePlan(planId);
      if (!plan) return res.status(400).json({ error: 'باقة غير معروفة' });
      if (plan.price === 0) return res.status(400).json({ error: 'الباقة المجانية لا تحتاج دفع' });

      if (!ChargilyService.isConfigured()) {
        return res.status(503).json({ error: 'الدفع الإلكتروني غير مفعّل حاليًا من طرف الإدارة. تواصل مع الدعم لتفعيله.' });
      }

      const store = await StoreRepository.findByIdOrFail(req.storeId);
      const isFirstPurchase = !store.hasEverPaid;
      const discountPercent = isFirstPurchase ? FIRST_PURCHASE_DISCOUNT_PERCENT : 0;
      const final = Math.round(plan.price * (1 - discountPercent / 100));

      // استعمال رصيد المحفظة (عمولات الإحالة) تلقائيًا لتخفيض المبلغ المطلوب دفعه
      const { walletApplied, remaining } = ReferralService.computeWalletApplication(store, final);

      if (remaining <= 0 && walletApplied > 0) {
        await StoreRepository.incrementWallet(req.storeId, -walletApplied);
        await SubscriptionService.renew(req.storeId, plan);
        await StoreRepository.update(req.storeId, { hasEverPaid: true, lastPaymentAmount: final });
        await ReferralService.onSubscriptionPaid({ storeId: req.storeId, amountPaid: final });
        return res.json({ ok: true, freeViaWallet: true, walletApplied, amount: 0 });
      }

      const checkout = await ChargilyService.createCheckout({
        amount: remaining,
        description: `اشتراك باقة ${plan.name} - ${store.storeName || req.storeId}`,
        storeId: req.storeId,
        planId,
        walletApplied,
        planValue: final,
        successUrl: `${env.appBaseUrl}/payment-success.html`,
        failureUrl: `${env.appBaseUrl}/payment-failed.html`,
      });

      res.json({ ok: true, checkoutUrl: checkout.checkout_url, amount: remaining, walletApplied });
    } catch (err) {
      logger.error('فشل إنشاء عملية دفع من لوحة التحكم', { error: err.message });
      res.status(500).json({ error: err.message || 'تعذّر إنشاء عملية الدفع' });
    }
  });

  // ===== برنامج الإحالة: كود الدعوة + رصيد العمولات + طلبات السحب =====

  // ملخص عام: كود الدعوة، الرصيد الحالي، عدد المتاجر المدعوة
  router.get('/referral/summary', async (req, res) => {
    try {
      const summary = await ReferralService.getSummary(req.storeId);
      res.json(summary);
    } catch (err) {
      logger.error('فشل جلب ملخص الإحالة', { error: err.message });
      res.status(500).json({ error: 'تعذّر جلب بيانات الإحالة' });
    }
  });

  // تاريخ العمولات (من مين، شحال، وقتاش)
  router.get('/referral/commissions', async (req, res) => {
    try {
      const commissions = await ReferralService.listCommissions(req.storeId);
      res.json({ commissions });
    } catch (err) {
      logger.error('فشل جلب سجل العمولات', { error: err.message });
      res.status(500).json({ error: 'تعذّر جلب سجل العمولات' });
    }
  });

  // تاريخ طلبات السحب وحالتها
  router.get('/referral/withdrawals', async (req, res) => {
    try {
      const withdrawals = await ReferralService.listWithdrawals(req.storeId);
      res.json({ withdrawals, minWithdrawalAmount: MIN_WITHDRAWAL_AMOUNT });
    } catch (err) {
      logger.error('فشل جلب طلبات السحب', { error: err.message });
      res.status(500).json({ error: 'تعذّر جلب طلبات السحب' });
    }
  });

  // إنشاء طلب سحب جديد (الحد الأدنى 5000 دج) - ينقص الرصيد فورًا ويرجع تلقائيًا لو رُفض لاحقًا
  router.post('/referral/withdrawals', async (req, res) => {
    try {
      const { amount, method, accountNumber, phone } = req.body || {};
      const request = await ReferralService.requestWithdrawal(req.storeId, { amount, method, accountNumber, phone });
      res.json({ ok: true, request });
    } catch (err) {
      logger.error('فشل إنشاء طلب سحب', { error: err.message });
      res.status(400).json({ error: err.message || 'تعذّر إنشاء طلب السحب' });
    }
  });

  // ===== إعدادات الحساب (حساب الموقع، وليس المتجر) =====

  router.put('/account', async (req, res) => {
    try {
      const { fullName, phone } = req.body || {};
      const fields = {};
      if (fullName !== undefined) fields.fullName = String(fullName).trim();
      if (phone !== undefined) fields.phone = String(phone).trim();
      const updated = await WebUserRepository.update(req.webUser.id, fields);
      res.json({ ok: true, user: { fullName: updated.fullName, phone: updated.phone, email: updated.email } });
    } catch (err) {
      logger.error('فشل تحديث إعدادات الحساب من لوحة التحكم', { error: err.message });
      res.status(400).json({ error: err.message || 'تعذّر تحديث الحساب' });
    }
  });

  // ===== الكوبونات =====

  router.get('/coupons', async (req, res) => {
    try {
      const coupons = await CouponRepository.findAll(req.storeId, { limit: 200 });
      res.json({ coupons });
    } catch (err) {
      logger.error('فشل جلب الكوبونات من لوحة التحكم', { error: err.message });
      res.status(500).json({ error: 'تعذّر جلب الكوبونات' });
    }
  });

  router.post('/coupons', async (req, res) => {
    try {
      const coupon = await CouponService.createCoupon(req.storeId, req.body || {});
      res.json({ ok: true, coupon });
    } catch (err) {
      logger.error('فشل إنشاء كوبون من لوحة التحكم', { error: err.message });
      res.status(400).json({ error: err.message || 'تعذّر إنشاء الكوبون' });
    }
  });

  router.put('/coupons/:id', async (req, res) => {
    try {
      const updated = await CouponRepository.update(req.storeId, req.params.id, { active: Boolean(req.body?.active) });
      res.json({ ok: true, coupon: updated });
    } catch (err) {
      logger.error('فشل تعديل كوبون من لوحة التحكم', { error: err.message });
      res.status(400).json({ error: err.message || 'تعذّر تعديل الكوبون' });
    }
  });

  router.delete('/coupons/:id', async (req, res) => {
    try {
      await CouponRepository.delete(req.storeId, req.params.id);
      res.json({ ok: true });
    } catch (err) {
      logger.error('فشل حذف كوبون من لوحة التحكم', { error: err.message });
      res.status(400).json({ error: err.message || 'تعذّر حذف الكوبون' });
    }
  });

  // ===== التقييمات =====

  router.get('/ratings', async (req, res) => {
    try {
      const [ratings, average] = await Promise.all([
        RatingRepository.findAll(req.storeId, { limit: 200 }),
        RatingService.getAverage(req.storeId),
      ]);
      res.json({ ratings, average });
    } catch (err) {
      logger.error('فشل جلب التقييمات من لوحة التحكم', { error: err.message });
      res.status(500).json({ error: 'تعذّر جلب التقييمات' });
    }
  });

  // ===== الإشعارات =====

  router.get('/notifications', async (req, res) => {
    try {
      const notifications = await WebNotificationRepository.listRecent(req.storeId, 50);
      res.json({ notifications });
    } catch (err) {
      logger.error('فشل جلب إشعارات لوحة التحكم', { error: err.message });
      res.status(500).json({ error: 'تعذّر جلب الإشعارات' });
    }
  });

  // ===== الموظفون (Growth+) =====

  router.get('/staff', requireFeature('staffAccounts', 'إدارة الموظفين متوفرة من باقة "Pro" فما فوق.'), async (req, res) => {
    try {
      const staff = await StoreService.listStaffMembers(req.storeId);
      res.json({
        staff,
        permissionList: CUSTOM_PERMISSION_LIST.map((p) => ({ key: p, label: PERMISSION_LABELS[p] })),
        presets: Object.entries(PRESET_ROLES).map(([label, permissions]) => ({ label, permissions })),
        allPermissionKey: PERMISSIONS.ALL,
      });
    } catch (err) {
      logger.error('فشل جلب الموظفين من لوحة التحكم', { error: err.message });
      res.status(500).json({ error: 'تعذّر جلب أعضاء الفريق' });
    }
  });

  router.post('/staff', requireFeature('staffAccounts', 'إدارة الموظفين متوفرة من باقة "Pro" فما فوق.'), async (req, res) => {
    try {
      const { telegramId, name, permissions } = req.body || {};
      await StoreService.addStaffMember(req.storeId, String(telegramId || '').trim(), {
        name: (name || '').trim(),
        permissions: Array.isArray(permissions) ? permissions : [],
      });
      const staff = await StoreService.listStaffMembers(req.storeId);
      res.json({ ok: true, staff });
    } catch (err) {
      logger.error('فشل إضافة عضو فريق من لوحة التحكم', { error: err.message });
      res.status(400).json({ error: err.message || 'تعذّر إضافة عضو الفريق' });
    }
  });

  router.delete('/staff/:telegramId', requireFeature('staffAccounts', 'إدارة الموظفين متوفرة من باقة "Pro" فما فوق.'), async (req, res) => {
    try {
      await StoreService.removeStaffMember(req.storeId, req.params.telegramId);
      res.json({ ok: true });
    } catch (err) {
      logger.error('فشل حذف عضو فريق من لوحة التحكم', { error: err.message });
      res.status(400).json({ error: err.message || 'تعذّر حذف عضو الفريق' });
    }
  });

  // ===== السلات المتروكة (Growth+) =====
  // للعرض فقط - إرسال التذكيرات نفسها يبقى تلقائيًا عبر abandonedCartJob (كل مدة معيّنة)،
  // هذا القسم يعطي التاجر رؤية على من ترك سلته ووصل التذكير له أو لا.

  router.get('/abandoned-carts', requireFeature('abandonedCartRecovery', 'متابعة السلات المتروكة متوفرة من باقة "Growth" فما فوق.'), async (req, res) => {
    try {
      const sessions = await FacebookSessionRepository.findByStore(req.storeId, { limit: 100 });
      const carts = sessions
        .filter((s) => s.orderDraft?.productName)
        .map((s) => ({
          psid: s.psid,
          productName: s.orderDraft.productName,
          customerName: s.orderDraft.name || null,
          phone: s.orderDraft.phone || null,
          reminderStage: s.abandonedReminderStage || 0,
          updatedAt: s.updatedAt || null,
        }));
      res.json({ carts });
    } catch (err) {
      logger.error('فشل جلب السلات المتروكة من لوحة التحكم', { error: err.message });
      res.status(500).json({ error: 'تعذّر جلب السلات المتروكة' });
    }
  });

  // ===== الرسائل الصوتية للتاجر (Business فقط) =====
  // التسجيل من المتصفح (MediaRecorder) أو رفع ملف - يُبعث كـ base64 داخل JSON بدل multipart،
  // حتى نتفادى الحاجة لمكتبة رفع ملفات إضافية (multer) غير مستعملة أصلاً فـ المشروع.

  router.get('/voice-notes', requireFeature('merchantVoiceNotes', 'الرسائل الصوتية متوفرة من باقة "Pro" فما فوق.'), async (req, res) => {
    try {
      const [intentNotes, products] = await Promise.all([
        VoiceNoteService.listIntentVoiceNotes(req.storeId),
        ProductRepository.findAll(req.storeId, { limit: 500 }),
      ]);
      const notesByKey = {};
      intentNotes.forEach((n) => { notesByKey[n.id] = n; });

      const intents = INTENT_KEYS.map((key) => ({
        key,
        label: INTENT_LABELS_AR[key] || key,
        url: notesByKey[key]?.url || null,
        duration: notesByKey[key]?.duration || null,
        // شروط التشغيل (افتراضيات النظام مدموجة مع تخصيص التاجر إن وُجد) - راجع
        // src/engine/voiceConditions.js. تُستعمل فـ لوحة التحكم لعرض "تعمل عندما..."
        // ولإظهار/إخفاء خيار "إذا لم يعرف المنتج" حسب requiresProduct.
        conditions: mergeConditions(key, notesByKey[key]?.conditions),
      }));

      const productNotes = products
        .filter((p) => p.voiceNoteUrl)
        .map((p) => ({ id: p.id, name: p.name, url: p.voiceNoteUrl, duration: p.voiceNoteDuration || null }));

      res.json({
        intents,
        products: products.map((p) => ({ id: p.id, name: p.name })),
        productNotes,
        noProductActions: NO_PRODUCT_ACTIONS,
      });
    } catch (err) {
      logger.error('فشل جلب الرسائل الصوتية من لوحة التحكم', { error: err.message });
      res.status(500).json({ error: 'تعذّر جلب الرسائل الصوتية' });
    }
  });

  // تحديث "شروط التشغيل" لنية معينة (يتطلب منتج؟ + الفعل البديل إذا لم يُعرف المنتج)
  router.put('/voice-notes/intent/:key/conditions', requireFeature('merchantVoiceNotes', 'الرسائل الصوتية متوفرة من باقة "Pro" فما فوق.'), async (req, res) => {
    try {
      if (!INTENT_KEYS.includes(req.params.key)) return res.status(400).json({ error: 'نية غير معروفة' });
      const { requiresProduct, noProductAction, noProductText } = req.body || {};
      const saved = await VoiceNoteService.setConditionsForIntent(req.storeId, req.params.key, {
        requiresProduct,
        noProductAction,
        noProductText,
      });
      res.json({ ok: true, conditions: saved });
    } catch (err) {
      logger.error('فشل تحديث شروط التشغيل لنية من لوحة التحكم', { error: err.message });
      res.status(400).json({ error: err.message || 'تعذّر تحديث شروط التشغيل' });
    }
  });

  router.post('/voice-notes/intent/:key', requireFeature('merchantVoiceNotes', 'الرسائل الصوتية متوفرة من باقة "Pro" فما فوق.'), async (req, res) => {
    try {
      if (!INTENT_KEYS.includes(req.params.key)) return res.status(400).json({ error: 'نية غير معروفة' });
      const { base64, mimeType, duration } = req.body || {};
      if (!base64) return res.status(400).json({ error: 'لم يتم استلام أي ملف صوتي' });
      await VoiceNoteService.attachToIntentFromBase64(req.storeId, req.params.key, { base64, mimeType, duration });
      res.json({ ok: true });
    } catch (err) {
      logger.error('فشل حفظ رسالة صوتية لنية من لوحة التحكم', { error: err.message });
      res.status(400).json({ error: err.message || 'تعذّر حفظ الرسالة الصوتية' });
    }
  });

  router.delete('/voice-notes/intent/:key', requireFeature('merchantVoiceNotes', 'الرسائل الصوتية متوفرة من باقة "Pro" فما فوق.'), async (req, res) => {
    try {
      await VoiceNoteService.removeFromIntent(req.storeId, req.params.key);
      res.json({ ok: true });
    } catch (err) {
      logger.error('فشل حذف رسالة صوتية لنية من لوحة التحكم', { error: err.message });
      res.status(400).json({ error: err.message || 'تعذّر حذف الرسالة الصوتية' });
    }
  });

  router.post('/voice-notes/product/:id', requireFeature('merchantVoiceNotes', 'الرسائل الصوتية متوفرة من باقة "Pro" فما فوق.'), async (req, res) => {
    try {
      const { base64, mimeType, duration } = req.body || {};
      if (!base64) return res.status(400).json({ error: 'لم يتم استلام أي ملف صوتي' });
      await VoiceNoteService.attachToProductFromBase64(req.storeId, req.params.id, { base64, mimeType, duration });
      res.json({ ok: true });
    } catch (err) {
      logger.error('فشل حفظ رسالة صوتية لمنتج من لوحة التحكم', { error: err.message });
      res.status(400).json({ error: err.message || 'تعذّر حفظ الرسالة الصوتية' });
    }
  });

  router.delete('/voice-notes/product/:id', requireFeature('merchantVoiceNotes', 'الرسائل الصوتية متوفرة من باقة "Pro" فما فوق.'), async (req, res) => {
    try {
      await VoiceNoteService.removeFromProduct(req.storeId, req.params.id);
      res.json({ ok: true });
    } catch (err) {
      logger.error('فشل حذف رسالة صوتية لمنتج من لوحة التحكم', { error: err.message });
      res.status(400).json({ error: err.message || 'تعذّر حذف الرسالة الصوتية' });
    }
  });

  // ===== التحليلات الكاملة (Pro+) =====

  router.get('/analytics', requireFeature('fullAnalytics', 'الإحصائيات الكاملة متوفرة من باقة "Pro" فما فوق.'), async (req, res) => {
    try {
      const [orders, topProducts, store] = await Promise.all([
        OrderRepository.findAll(req.storeId, { limit: 1000 }),
        OrderService.getTopProducts(req.storeId, 5),
        StoreRepository.findById(req.storeId),
      ]);

      const validOrders = orders.filter((o) => o.status !== 'ملغى');
      const totalRevenue = validOrders.reduce((sum, o) => sum + Number(o.total || o.price || 0), 0);

      // إيرادات آخر 30 يوم مجمّعة حسب اليوم (لرسم بياني بسيط فـ الواجهة)
      const revenueByDay = {};
      const today = new Date();
      for (let i = 29; i >= 0; i -= 1) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        revenueByDay[d.toISOString().slice(0, 10)] = 0;
      }
      validOrders.forEach((o) => {
        const date = o.createdAt?.toDate ? o.createdAt.toDate() : (o.createdAt ? new Date(o.createdAt) : null);
        if (!date) return;
        const key = date.toISOString().slice(0, 10);
        if (key in revenueByDay) revenueByDay[key] += Number(o.total || o.price || 0);
      });

      // أفضل العملاء حسب رقم الهاتف (نفس رقم الهاتف = نفس الزبون عبر عدة طلبات)
      const customerTotals = {};
      validOrders.forEach((o) => {
        if (!o.phone) return;
        if (!customerTotals[o.phone]) customerTotals[o.phone] = { name: o.name, phone: o.phone, ordersCount: 0, revenue: 0 };
        customerTotals[o.phone].ordersCount += 1;
        customerTotals[o.phone].revenue += Number(o.total || o.price || 0);
      });
      const topCustomers = Object.values(customerTotals).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

      const ordersByStatus = orders.reduce((acc, o) => {
        acc[o.status] = (acc[o.status] || 0) + 1;
        return acc;
      }, {});

      // ===== إضافات المتطلب #10: معدل رفض الطلبات، متوسط قيمة الطلب، عدد الرسائل =====
      const cancelledCount = ordersByStatus['ملغى'] || 0;
      const rejectionRate = orders.length ? Math.round((cancelledCount / orders.length) * 1000) / 10 : 0;
      const avgOrderValue = validOrders.length ? Math.round(totalRevenue / validOrders.length) : 0;
      const conversionRate = store?.messageCount
        ? Math.round((orders.length / store.messageCount) * 1000) / 10
        : null; // null إذا ماكاينش عدد رسائل مسجّل بعد

      // أكثر الولايات شراءً
      const wilayaTotals = {};
      validOrders.forEach((o) => {
        if (!o.wilaya) return;
        wilayaTotals[o.wilaya] = (wilayaTotals[o.wilaya] || 0) + 1;
      });
      const topWilayas = Object.entries(wilayaTotals).sort((a, b) => b[1] - a[1]).slice(0, 5)
        .map(([wilaya, count]) => ({ wilaya, count }));

      // أفضل أوقات الطلبات (توزيع حسب الساعة)
      const hourCounts = Array(24).fill(0);
      orders.forEach((o) => {
        const d = o.createdAt?.toDate ? o.createdAt.toDate() : (o.createdAt ? new Date(o.createdAt) : null);
        if (d) hourCounts[d.getHours()] += 1;
      });
      const bestHours = hourCounts
        .map((count, hour) => ({ hour, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3)
        .filter((h) => h.count > 0);

      // أداء الموظفين (بناءً على من قام بآخر تحديث حالة لكل طلب - راجع OrderService.updateStatus)
      const staffTotals = {};
      orders.forEach((o) => {
        const handler = o.lastHandledBy;
        if (!handler?.id) return;
        const key = handler.name || handler.id;
        staffTotals[key] = (staffTotals[key] || 0) + 1;
      });
      const staffPerformance = Object.entries(staffTotals).sort((a, b) => b[1] - a[1])
        .map(([name, ordersHandled]) => ({ name, ordersHandled }));

      res.json({
        totalRevenue,
        totalOrders: orders.length,
        ordersByStatus,
        revenueByDay: Object.entries(revenueByDay).map(([date, revenue]) => ({ date, revenue })),
        topProducts,
        topCustomers,
        rejectionRate,
        avgOrderValue,
        conversionRate,
        messageCount: store?.messageCount || 0,
        topWilayas,
        bestHours,
        staffPerformance,
      });
    } catch (err) {
      logger.error('فشل جلب التحليلات الكاملة من لوحة التحكم', { error: err.message });
      res.status(500).json({ error: 'تعذّر جلب التحليلات' });
    }
  });

  // ===== الذكاء الاصطناعي / التعلّم =====

  router.get('/ai/overview', async (req, res) => {
    try {
      const report = await LearningStatsService.buildWeeklyReport(req.storeId);
      res.json({ report });
    } catch (err) {
      logger.error('فشل جلب التقرير الأسبوعي من لوحة التحكم', { error: err.message });
      res.status(500).json({ error: 'تعذّر جلب تقرير الأسبوع' });
    }
  });

  router.get('/ai/dictionary', async (req, res) => {
    try {
      const terms = await StoreDictionaryService.listTerms(req.storeId);
      res.json({ terms });
    } catch (err) {
      logger.error('فشل جلب قاموس المتجر من لوحة التحكم', { error: err.message });
      res.status(500).json({ error: 'تعذّر جلب القاموس' });
    }
  });

  router.post('/ai/dictionary', async (req, res) => {
    try {
      const { term, meaning, intent } = req.body || {};
      if (!term || !meaning) return res.status(400).json({ error: 'المصطلح والمعنى مطلوبان' });
      await StoreDictionaryService.learnTerm(req.storeId, String(term).trim(), {
        meaning: String(meaning).trim(),
        intent: intent || null,
        source: 'dashboard_manual',
      });
      const terms = await StoreDictionaryService.listTerms(req.storeId);
      res.json({ ok: true, terms });
    } catch (err) {
      logger.error('فشل إضافة مصطلح قاموس من لوحة التحكم', { error: err.message });
      res.status(400).json({ error: err.message || 'تعذّر إضافة المصطلح' });
    }
  });

  router.delete('/ai/dictionary/:id', async (req, res) => {
    try {
      await StoreDictionaryRepository.delete(req.storeId, req.params.id);
      res.json({ ok: true });
    } catch (err) {
      logger.error('فشل حذف مصطلح قاموس من لوحة التحكم', { error: err.message });
      res.status(400).json({ error: err.message || 'تعذّر حذف المصطلح' });
    }
  });

  router.get('/ai/decisions', async (req, res) => {
    try {
      const decisions = await DecisionService.listDecisions(req.storeId);
      res.json({ decisions });
    } catch (err) {
      logger.error('فشل جلب دفتر القرارات من لوحة التحكم', { error: err.message });
      res.status(500).json({ error: 'تعذّر جلب دفتر القرارات' });
    }
  });

  router.post('/ai/decisions', async (req, res) => {
    try {
      const { question, decisionText, questionType } = req.body || {};
      if (!question || !decisionText) return res.status(400).json({ error: 'السؤال والقرار مطلوبان' });
      await DecisionService.recordDecision(req.storeId, {
        question: String(question).trim(),
        normalizedQuestion: normalizeMessage(String(question).trim()),
        decisionText: String(decisionText).trim(),
        questionType: questionType || 'general',
      });
      const decisions = await DecisionService.listDecisions(req.storeId);
      res.json({ ok: true, decisions });
    } catch (err) {
      logger.error('فشل إضافة قرار من لوحة التحكم', { error: err.message });
      res.status(400).json({ error: err.message || 'تعذّر إضافة القرار' });
    }
  });

  router.delete('/ai/decisions/:id', async (req, res) => {
    try {
      await DecisionRepository.delete(req.storeId, req.params.id);
      res.json({ ok: true });
    } catch (err) {
      logger.error('فشل حذف قرار من لوحة التحكم', { error: err.message });
      res.status(400).json({ error: err.message || 'تعذّر حذف القرار' });
    }
  });

  router.get('/ai/review-queue', async (req, res) => {
    try {
      const items = await ConversationLogService.getPendingReviewCandidates(req.storeId, { limit: 30 });
      res.json({ items });
    } catch (err) {
      logger.error('فشل جلب قائمة المراجعة من لوحة التحكم', { error: err.message });
      res.status(500).json({ error: 'تعذّر جلب قائمة المراجعة' });
    }
  });

  router.post('/ai/review-queue/:id/approve', async (req, res) => {
    try {
      await ConversationLogService.markApproved(req.storeId, req.params.id);
      res.json({ ok: true });
    } catch (err) {
      logger.error('فشل اعتماد رد من لوحة التحكم', { error: err.message });
      res.status(400).json({ error: err.message || 'تعذّر الاعتماد' });
    }
  });

  router.post('/ai/review-queue/:id/edit', async (req, res) => {
    try {
      const { finalReply } = req.body || {};
      if (!finalReply) return res.status(400).json({ error: 'الرد النهائي مطلوب' });
      await ConversationLogService.markEdited(req.storeId, req.params.id, String(finalReply).trim());
      res.json({ ok: true });
    } catch (err) {
      logger.error('فشل تعديل رد من لوحة التحكم', { error: err.message });
      res.status(400).json({ error: err.message || 'تعذّر التعديل' });
    }
  });

  // ===== شركات التوصيل (src/services/DeliveryService.js) - المتطلب #1 =====

  router.get('/delivery-providers', requireFeature('deliveryIntegration', 'تكامل شركات التوصيل متوفر من باقة "Growth" فما فوق.'), async (req, res) => {
    try {
      const providers = await DeliveryService.listProviders(req.storeId);
      res.json({ providers });
    } catch (err) {
      logger.error('فشل جلب شركات التوصيل', { error: err.message });
      res.status(500).json({ error: 'تعذّر جلب شركات التوصيل' });
    }
  });

  router.post('/delivery-providers/:providerId/test', requireFeature('deliveryIntegration', 'تكامل شركات التوصيل متوفر من باقة "Growth" فما فوق.'), async (req, res) => {
    try {
      const result = await DeliveryService.testConnection(req.storeId, req.params.providerId, req.body || {});
      res.json(result);
    } catch (err) {
      res.status(400).json({ ok: false, message: err.message || 'فشل اختبار الاتصال' });
    }
  });

  router.post('/delivery-providers/:providerId/connect', requireFeature('deliveryIntegration', 'تكامل شركات التوصيل متوفر من باقة "Growth" فما فوق.'), async (req, res) => {
    try {
      const result = await DeliveryService.connectProvider(req.storeId, req.params.providerId, req.body || {});
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message || 'تعذّر ربط شركة التوصيل' });
    }
  });

  router.delete('/delivery-providers/:providerId', requireFeature('deliveryIntegration', 'تكامل شركات التوصيل متوفر من باقة "Growth" فما فوق.'), async (req, res) => {
    try {
      await DeliveryService.disconnectProvider(req.storeId, req.params.providerId);
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err.message || 'تعذّر فك ربط شركة التوصيل' });
    }
  });

  // إنشاء شحنة لطلب معيّن (يدويًا من لوحة التحكم، أو يمكن استدعاؤها تلقائيًا بعد قبول الطلب)
  router.post('/orders/:orderId/shipment', requireFeature('deliveryIntegration', 'تكامل شركات التوصيل متوفر من باقة "Growth" فما فوق.'), async (req, res) => {
    try {
      const { providerId } = req.body || {};
      if (!providerId) return res.status(400).json({ error: 'يجب تحديد شركة التوصيل' });
      const shipment = await DeliveryService.createShipmentForOrder(req.storeId, req.params.orderId, providerId);
      res.json({ ok: true, shipment });
    } catch (err) {
      logger.error('فشل إنشاء شحنة', { error: err.message });
      res.status(400).json({ error: err.message || 'تعذّر إنشاء الشحنة' });
    }
  });

  // مزامنة يدوية فورية لحالة شحنة طلب معيّن (بالإضافة إلى المزامنة الدورية التلقائية)
  router.post('/orders/:orderId/shipment/sync', requireFeature('deliveryIntegration', 'تكامل شركات التوصيل متوفر من باقة "Growth" فما فوق.'), async (req, res) => {
    try {
      const result = await DeliveryService.syncOrderStatus(req.storeId, req.params.orderId);
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(400).json({ error: err.message || 'تعذّر مزامنة حالة الشحنة' });
    }
  });

  // ===== إعدادات مساعد الذكاء الاصطناعي (المتطلب #16) =====

  router.get('/ai-settings', async (req, res) => {
    try {
      const store = await StoreRepository.findById(req.storeId);
      if (!store) return res.status(404).json({ error: 'المتجر غير موجود' });
      res.json({ settings: mergeWithDefaults(store.aiSettings), aiEnabled: AIAdvisorService.isEnabled() });
    } catch (err) {
      logger.error('فشل جلب إعدادات الذكاء الاصطناعي', { error: err.message });
      res.status(500).json({ error: 'تعذّر جلب الإعدادات' });
    }
  });

  router.put('/ai-settings', async (req, res) => {
    try {
      const store = await StoreRepository.findById(req.storeId);
      if (!store) return res.status(404).json({ error: 'المتجر غير موجود' });
      const merged = mergeWithDefaults({ ...store.aiSettings, ...(req.body || {}) });
      const updated = await StoreRepository.saveAISettings(req.storeId, merged);
      res.json({ ok: true, settings: updated.aiSettings });
    } catch (err) {
      logger.error('فشل تحديث إعدادات الذكاء الاصطناعي', { error: err.message });
      res.status(400).json({ error: err.message || 'تعذّر تحديث الإعدادات' });
    }
  });

  // ===== مساعد الذكاء الاصطناعي للتاجر (المتطلبات #7 و#8) =====

  router.post('/ai/ask', requireFeature('aiAdvisor', 'مساعد الذكاء الاصطناعي متوفر من باقة "Growth" فما فوق.'), async (req, res) => {
    try {
      const { question } = req.body || {};
      if (!question || !question.trim()) return res.status(400).json({ error: 'السؤال مطلوب' });
      const answer = await AIAdvisorService.ask(req.storeId, question.trim());
      res.json({ ok: true, answer });
    } catch (err) {
      logger.error('فشل رد مساعد الذكاء الاصطناعي', { error: err.message });
      res.status(400).json({ error: err.message || 'تعذّر توليد الإجابة' });
    }
  });

  // type: product_description | ad_post | messenger_campaign | whatsapp_campaign |
  //       reply_suggestion | discount_suggestion
  router.post('/ai/generate', requireFeature('aiAdvisor', 'مساعد الذكاء الاصطناعي متوفر من باقة "Growth" فما فوق.'), async (req, res) => {
    try {
      const { type, params } = req.body || {};
      if (!type) return res.status(400).json({ error: 'نوع المحتوى مطلوب' });
      const content = await AIAdvisorService.generateContent(req.storeId, type, params || {});
      res.json({ ok: true, content });
    } catch (err) {
      logger.error('فشل توليد محتوى AI', { error: err.message, type: req.body?.type });
      res.status(400).json({ error: err.message || 'تعذّر توليد المحتوى' });
    }
  });

  router.get('/ai/analyze/sales-drop', requireFeature('aiAdvisor', 'مساعد الذكاء الاصطناعي متوفر من باقة "Growth" فما فوق.'), async (req, res) => {
    try {
      res.json({ ok: true, answer: await AIAdvisorService.analyzeSalesDrop(req.storeId) });
    } catch (err) {
      res.status(400).json({ error: err.message || 'تعذّر التحليل' });
    }
  });

  router.get('/ai/analyze/order-rejections', requireFeature('aiAdvisor', 'مساعد الذكاء الاصطناعي متوفر من باقة "Growth" فما فوق.'), async (req, res) => {
    try {
      res.json({ ok: true, answer: await AIAdvisorService.analyzeOrderRejections(req.storeId) });
    } catch (err) {
      res.status(400).json({ error: err.message || 'تعذّر التحليل' });
    }
  });

  // ===== تصدير Excel احترافي (المتطلب #6) =====

  router.get('/orders/export', requireFeature('excelExportAdvanced', 'التصدير مع الفلاتر متوفر من باقة "Growth" فما فوق.'), async (req, res) => {
    try {
      const filters = {
        statusGroup: req.query.statusGroup || 'all',
        dateRange: req.query.dateRange || undefined,
        dateFrom: req.query.dateFrom,
        dateTo: req.query.dateTo,
        wilaya: req.query.wilaya || undefined,
        product: req.query.product || undefined,
        deliveryProvider: req.query.deliveryProvider || undefined,
      };
      const { buffer } = await ExcelExportService.buildOrdersWorkbook(req.storeId, filters);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="orders-export-${Date.now()}.xlsx"`);
      res.send(Buffer.from(buffer));
    } catch (err) {
      logger.error('فشل تصدير الطلبات إلى Excel', { error: err.message });
      res.status(500).json({ error: 'تعذّر تصدير الطلبات' });
    }
  });

  // ===== البث الجماعي - Broadcast (المتطلب #9) =====

  router.post('/broadcast/send', requireFeature('broadcast', 'البث الجماعي متوفر من باقة "Pro" فما فوق.'), async (req, res) => {
    try {
      const { segment, filters, message } = req.body || {};
      if (!segment) return res.status(400).json({ error: 'يجب تحديد فئة الجمهور' });
      const result = await BroadcastService.send(req.storeId, segment, filters || {}, message || {});
      res.json({ ok: true, ...result });
    } catch (err) {
      logger.error('فشل إرسال حملة البث الجماعي', { error: err.message });
      res.status(400).json({ error: err.message || 'تعذّر إرسال الحملة' });
    }
  });

  // ===== النسخ الاحتياطي (المتطلب #11) =====

  router.get('/backup/download', requireFeature('backup', 'النسخ الاحتياطي متوفر من باقة "Pro" فما فوق.'), async (req, res) => {
    try {
      const data = await BackupService.buildDownloadableBackup(req.storeId);
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="redonbot-backup-${Date.now()}.json"`);
      res.send(JSON.stringify(data, null, 2));
    } catch (err) {
      logger.error('فشل تنزيل نسخة احتياطية', { error: err.message });
      res.status(500).json({ error: 'تعذّر إنشاء النسخة الاحتياطية' });
    }
  });

  router.post('/backup/snapshot', requireFeature('backup', 'النسخ الاحتياطي متوفر من باقة "Pro" فما فوق.'), async (req, res) => {
    try {
      const result = await BackupService.createSavedSnapshot(req.storeId, { triggeredBy: 'manual' });
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(400).json({ error: err.message || 'تعذّر إنشاء النسخة الاحتياطية' });
    }
  });

  router.get('/backup/snapshots', requireFeature('backup', 'النسخ الاحتياطي متوفر من باقة "Pro" فما فوق.'), async (req, res) => {
    try {
      const snapshots = await BackupService.listSavedSnapshots(req.storeId);
      res.json({ snapshots });
    } catch (err) {
      res.status(500).json({ error: 'تعذّر جلب النسخ الاحتياطية' });
    }
  });

  router.post('/backup/snapshots/:id/restore', requireFeature('backup', 'النسخ الاحتياطي متوفر من باقة "Pro" فما فوق.'), async (req, res) => {
    try {
      const result = await BackupService.restoreSavedSnapshot(req.storeId, req.params.id);
      res.json({ ok: true, ...result });
    } catch (err) {
      logger.error('فشل استعادة نسخة احتياطية', { error: err.message });
      res.status(400).json({ error: err.message || 'تعذّر الاستعادة' });
    }
  });

  app.use('/api/dashboard', router);
};
