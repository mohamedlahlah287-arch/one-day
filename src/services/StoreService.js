const StoreRepository = require('../repositories/StoreRepository');
const eventBus = require('../events/eventBus');
const events = require('../events/eventNames');
const { ValidationError, NotFoundError } = require('../errors');
const { PERMISSIONS, CUSTOM_PERMISSION_LIST } = require('../config/permissions');
const { getPlan } = require('../config/plans');
const ReferralService = require('./ReferralService');
const logger = require('../utils/logger');

class StoreService {
  // ينسّق رقم الهاتف (يزيل المسافات/الشرطات) حتى تكون المقارنة بين المتاجر موثوقة
  _normalizePhone(phone) {
    return String(phone || '').replace(/[\s-]/g, '');
  }

  // يتأكد أن رقم الهاتف غير مستعمل من طرف متجر آخر قبل حفظه (متجران لا يمكن أن يشتركا بنفس الرقم)
  async _assertPhoneAvailable(contactPhone, currentStoreId = null) {
    const normalized = this._normalizePhone(contactPhone);
    if (!normalized) return;
    const existing = await StoreRepository.findByContactPhone(normalized, currentStoreId);
    if (existing) {
      throw new ValidationError('رقم الهاتف هذا مستعمل بالفعل من طرف متجر آخر', ['contactPhone']);
    }
  }

  async getStore(storeId) {
    return StoreRepository.findById(storeId);
  }

  async listAllStores() {
    return StoreRepository.findAllStores();
  }

  // إنشاء متجر جديد من طرف السوبر أدمن فقط، مع باقة محددة سلفًا
  async adminCreateStore(ownerTelegramId, storeName, plan) {
    if (!storeName || storeName.trim().length < 2) {
      throw new ValidationError('اسم المتجر قصير جدًا', ['storeName']);
    }
    if (!plan || !plan.id) {
      throw new ValidationError('الباقة غير صحيحة', ['plan']);
    }
    const existing = await StoreRepository.findById(ownerTelegramId);
    if (existing) {
      throw new ValidationError('هذا المستخدم يملك متجرًا مسجلاً بالفعل', ['ownerTelegramId']);
    }
    const referral = await ReferralService.createReferralFieldsForNewStore({});
    const store = await StoreRepository.create(ownerTelegramId, { storeName: storeName.trim(), plan, referral });
    await ReferralService.afterStoreCreated(ownerTelegramId, referral.code);
    eventBus.emit(events.STORE_REGISTERED, { storeId: ownerTelegramId, storeName });
    return store;
  }

  // تسجيل ذاتي (من الموقع): التاجر يعبّي فورم على الموقع، ثم يأكد عبر بوت التاجر (deep link).
  // يُنشئ متجر بباقة تجريبية (trial) تلقائيًا - السوبر أدمن يقدر يرقّي الباقة لاحقًا يدويًا.
  // referralCode/signupIp (اختياري): كود الدعوة اللي دخله التاجر + IP وقت تعبئة الفورم على الموقع
  // (يُستعملان لربط الإحالة واحتساب العمولات لاحقًا - راجع ReferralService).
  async selfRegisterStore(ownerTelegramId, { storeName, ownerName, phone, referralCode, signupIp }) {
    if (!storeName || storeName.trim().length < 2) {
      throw new ValidationError('اسم المتجر قصير جدًا', ['storeName']);
    }
    const existing = await StoreRepository.findById(ownerTelegramId);
    if (existing) {
      throw new ValidationError('عندك متجر مسجل بالفعل بهذا الحساب', ['ownerTelegramId']);
    }
    await this._assertPhoneAvailable(phone);
    const plan = getPlan('trial');
    const referral = await ReferralService.createReferralFieldsForNewStore({
      referralCodeInput: referralCode,
      signupIp,
    });
    const store = await StoreRepository.create(ownerTelegramId, {
      storeName: storeName.trim(),
      plan,
      ownerName: ownerName || '',
      contactPhone: this._normalizePhone(phone),
      referral,
    });
    await ReferralService.afterStoreCreated(ownerTelegramId, referral.code);
    eventBus.emit(events.STORE_REGISTERED, { storeId: ownerTelegramId, storeName });
    return store;
  }

  // إنشاء متجر مباشرة من الموقع (بلا أي حاجة لتيليغرام) - يُستدعى من POST /api/auth/store/create
  // بعد التحقق أن المستخدم مسجل دخول (requireWebUser). storeId هنا معرف مولّد عشوائيًا من الموقع
  // نفسه (وليس معرف تيليغرام)، وقناة الإشعارات الافتراضية = 'web' لأن ماكاين حساب تيليغرام مربوط.
  async createStoreFromWeb(storeId, { storeName, contactPhone = '', referralCode, signupIp }) {
    if (!storeName || storeName.trim().length < 2) {
      throw new ValidationError('اسم المتجر قصير جدًا', ['storeName']);
    }
    const existing = await StoreRepository.findById(storeId);
    if (existing) {
      throw new ValidationError('يوجد متجر بهذا المعرف بالفعل', ['storeId']);
    }
    await this._assertPhoneAvailable(contactPhone);
    const plan = getPlan('free');
    const referral = await ReferralService.createReferralFieldsForNewStore({
      referralCodeInput: referralCode,
      signupIp,
    });
    const store = await StoreRepository.create(storeId, {
      storeName: storeName.trim(),
      plan,
      contactPhone: this._normalizePhone(contactPhone),
      referral,
    });
    await ReferralService.afterStoreCreated(storeId, referral.code);
    await StoreRepository.update(storeId, { notificationChannel: 'web' });
    eventBus.emit(events.STORE_REGISTERED, { storeId, storeName });
    logger.info('تم إنشاء متجر جديد مباشرة من الموقع (بلا تيليغرام)', { storeId, storeName });
    return { ...store, notificationChannel: 'web' };
  }

  async updateSettings(storeId, fields) {
    const allowedFields = ['storeName', 'welcomeMessage', 'contactPhone', 'deliveryTime', 'notificationChannel'];
    const filtered = Object.fromEntries(
      Object.entries(fields).filter(([key]) => allowedFields.includes(key))
    );
    if (filtered.notificationChannel && !['telegram', 'web'].includes(filtered.notificationChannel)) {
      throw new ValidationError('قناة إشعارات غير صالحة', ['notificationChannel']);
    }
    if (Object.keys(filtered).length === 0) {
      throw new ValidationError('لا يوجد حقل صالح للتحديث');
    }
    if (filtered.contactPhone !== undefined) {
      await this._assertPhoneAvailable(filtered.contactPhone, storeId);
      filtered.contactPhone = this._normalizePhone(filtered.contactPhone);
    }
    return StoreRepository.update(storeId, filtered);
  }

  // يبدّل بين تفعيل/إيقاف "تأكيد الطلب" (زر التأكيد + رسالة إشعار الزبون). يرجع القيمة الجديدة.
  async toggleOrderConfirmation(storeId) {
    const store = await StoreRepository.findByIdOrFail(storeId);
    const newValue = !store.orderConfirmationEnabled;
    await StoreRepository.update(storeId, { orderConfirmationEnabled: newValue });
    return newValue;
  }

  // يوقف المتجر يدويًا (البوت يتوقف عن الرد على الزبائن) بدون حذف أي بيانات
  async pauseStore(storeId) {
    const store = await StoreRepository.findByIdOrFail(storeId);
    return StoreRepository.update(storeId, { active: false, manuallyPaused: true });
  }

  // يعيد تفعيل متجر متوقف يدويًا (لا يعمل إذا كان الاشتراك منتهي فعليًا - لازم تجديد أولاً)
  async unpauseStore(storeId) {
    const store = await StoreRepository.findByIdOrFail(storeId);
    if (store.subscriptionStatus === 'expired') {
      throw new ValidationError('لا يمكن تفعيل المتجر - الاشتراك منتهي. جدد الاشتراك أولاً.');
    }
    return StoreRepository.update(storeId, { active: true, manuallyPaused: false });
  }

  async deleteStore(storeId) {
    await StoreRepository.findByIdOrFail(storeId);
    return StoreRepository.delete(storeId);
  }

  // تغيير باقة متجر قائم (الحدود والمميزات تتغير فورًا، ويُعاد ضبط عداد الرسائل)
  async changePlan(storeId, plan) {
    await StoreRepository.findByIdOrFail(storeId);
    return StoreRepository.update(storeId, {
      planId: plan.id,
      planName: plan.name,
      planDurationDays: plan.durationDays,
      messageLimit: plan.messageLimit,
      productLimit: plan.productLimit,
      features: plan.features,
      messageCount: 0,
    });
  }

  // يبني كائن باقة من بيانات المتجر المخزّنة (يُستعمل عند "تجديد بنفس الباقة")
  buildPlanFromStore(store) {
    return {
      id: store.planId,
      name: store.planName,
      durationDays: store.planDurationDays || 30,
      messageLimit: store.messageLimit ?? null,
      productLimit: store.productLimit ?? null,
      features: store.features || {},
    };
  }

  async findByIdOrFail(storeId) {
    const store = await StoreRepository.findById(storeId);
    if (!store) throw new NotFoundError('المتجر', { storeId });
    return store;
  }

  // ===== تحديد هوية "المتحدث" فـ بوت التاجر: صاحب متجر أو عضو فريق =====
  // يرجع null إذا الشخص ماشي صاحب متجر ولا عضو فريق فـ أي متجر.
  async resolveActor(telegramId) {
    const ownedStore = await StoreRepository.findById(telegramId);
    if (ownedStore) {
      return { store: ownedStore, role: 'owner', permissions: [PERMISSIONS.ALL] };
    }
    const staffEntry = await StoreRepository.findStaffIndex(telegramId);
    if (staffEntry) {
      const store = await StoreRepository.findById(staffEntry.storeId);
      if (store) {
        return { store, role: 'staff', permissions: staffEntry.permissions || [] };
      }
    }
    return null;
  }

  // ===== فريق العمل =====

  async addStaffMember(storeId, telegramId, { name, permissions }) {
    if (!telegramId || !/^\d+$/.test(String(telegramId).trim())) {
      throw new ValidationError('معرف تيليغرام غير صحيح، يجب أن يكون أرقام فقط.');
    }
    if (String(telegramId) === String(storeId)) {
      throw new ValidationError('لا يمكنك إضافة نفسك كعضو فريق، أنت صاحب المتجر أصلاً.');
    }
    const existingOwner = await StoreRepository.findById(telegramId);
    if (existingOwner) {
      throw new ValidationError('هذا الشخص صاحب متجر مسجّل بالفعل، لا يمكن إضافته كموظف.');
    }
    const validPermissions = (permissions || []).filter(
      (p) => p === PERMISSIONS.ALL || CUSTOM_PERMISSION_LIST.includes(p)
    );
    if (validPermissions.length === 0) {
      throw new ValidationError('لازم تختار صلاحية واحدة على الأقل.');
    }
    await StoreRepository.addStaff(storeId, telegramId, { name, permissions: validPermissions });
    return this.getStore(storeId);
  }

  async removeStaffMember(storeId, telegramId) {
    return StoreRepository.removeStaff(storeId, telegramId);
  }

  async listStaffMembers(storeId) {
    const store = await this.findByIdOrFail(storeId);
    const staff = store.staff || {};
    return Object.entries(staff).map(([telegramId, data]) => ({ telegramId, ...data }));
  }

  // ===== صفحة فيسبوك خاصة بالمتجر =====

  // skipValidation=true: يُستعمل من مسار OAuth بضغطة واحدة فقط، لأن التوكن يجي مباشرة من
  // /me/accounts الرسمي تاع فيسبوك (مضمون التطابق مع pageId). الاستدعاء اليدوي (نسخ/لصق من
  // Meta Business Suite) يبقى يحتاج التحقق لأن الإنسان يقدر يغلط فـ النسخ.
  // ملاحظة: التحقق عبر /me?access_token= يحتاج صلاحية زايدة (pages_read_engagement أو ميزة
  // Page Public Metadata Access) قد ما تكونش متوفرة قبل اكتمال App Review، فتفشل بلا داعي
  // حتى لو التوكن سليم فعليًا - لهذا نتجاوزها فـ مسار OAuth.
  async connectFacebookPage(storeId, { pageId, pageAccessToken, pageName = null, skipValidation = false }) {
    if (!pageId || !pageAccessToken) {
      throw new ValidationError('لازم تعطي معرف الصفحة (Page ID) وتوكن الوصول (Page Access Token) معًا.');
    }

    if (!skipValidation) {
      // نتحقق أن التوكن صحيح ويطابق فعلاً هذه الصفحة قبل ما نخزنو
      const res = await fetch(`https://graph.facebook.com/v19.0/me?access_token=${pageAccessToken}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.id) {
        logger.error('فشل التحقق من توكن صفحة فيسبوك', { status: res.status, data, pageId });
        const detail = data?.error?.message ? ` (${data.error.message})` : '';
        throw new ValidationError(`توكن الوصول غير صالح أو منتهي${detail}. تأكد من نسخه بشكل صحيح من Meta Business Suite.`);
      }
      if (String(data.id) !== String(pageId)) {
        throw new ValidationError(
          `التوكن يخص صفحة أخرى (معرفها ${data.id})، تأكد من معرف الصفحة اللي كتبتو.`
        );
      }
    }

    const existing = await StoreRepository.findByFacebookPageId(pageId);
    if (existing && String(existing.id) !== String(storeId)) {
      throw new ValidationError('هذه الصفحة مربوطة بالفعل بمتجر آخر.');
    }
    return StoreRepository.connectFacebookPage(storeId, { pageId, pageAccessToken, pageName });
  }

  async disconnectFacebookPage(storeId) {
    return StoreRepository.disconnectFacebookPage(storeId);
  }

  async getStoreByFacebookPageId(pageId) {
    return StoreRepository.findByFacebookPageId(pageId);
  }
}

module.exports = new StoreService();
