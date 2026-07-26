const crypto = require('crypto');
const StoreRepository = require('../repositories/StoreRepository');
const ReferralRepository = require('../repositories/ReferralRepository');
const ValidationError = require('../errors/ValidationError');
const { MIN_WITHDRAWAL_AMOUNT, WITHDRAWAL_METHODS, getCommissionPercent } = require('../config/referral');
const logger = require('../utils/logger');

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // بدون حروف/أرقام تتلخبط (0/O, 1/I...)

class ReferralService {
  _randomCode(length = 7) {
    let code = '';
    for (let i = 0; i < length; i += 1) {
      code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
    }
    return code;
  }

  // يولّد كود دعوة فريد وياخذو (يجرب لين يلقى كود غير مستعمل). يُستدعى مرة وحدة عند إنشاء أي متجر.
  async generateUniqueCode() {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const code = this._randomCode();
      const reserved = await ReferralRepository.reserveCode(code, 'PENDING');
      if (reserved) return code;
    }
    throw new Error('تعذّر توليد كود دعوة فريد، حاول مرة أخرى');
  }

  // يربط كود الدعوة فعليًا بمعرف المتجر بعد ما ننشئ المتجر (كنا حجزنا الكود بـ storeId مؤقت 'PENDING')
  async bindCodeToStore(code, storeId) {
    await ReferralRepository.codesCollection().doc(code).set({ storeId: String(storeId) }, { merge: true });
  }

  // يُستدعى عند تسجيل متجر جديد (قبل إنشائه) للتحقق من كود الدعوة المُدخل وكشف الغش المحتمل.
  // يرجع: { referredByStoreId, referredByCode, flagged } أو {} إذا ما كاين حتى كود.
  async resolveReferralLink({ referralCodeInput, signupIp }) {
    const codeRaw = String(referralCodeInput || '').trim().toUpperCase();
    if (!codeRaw) return {};

    const referrerStoreId = await ReferralRepository.findStoreIdByCode(codeRaw);
    if (!referrerStoreId) {
      // كود غير صحيح - نتجاهله بصمت (ما نمنعش التسجيل بسببه) لكن بلا ربط
      logger.warn('كود دعوة غير صحيح عند التسجيل', { code: codeRaw });
      return {};
    }

    // حماية من الغش: إذا نفس عنوان IP المستعمل عند التسجيل هو نفسه IP تسجيل المتجر "الداعي"،
    // هذا مؤشر قوي إن نفس الشخص يحاول يدعو نفسه بحساب ثاني. نسجل الربط لكن نمنع احتساب العمولة.
    let flagged = false;
    if (signupIp) {
      const referrerStore = await StoreRepository.findById(referrerStoreId);
      if (referrerStore?.referralSignupIp && referrerStore.referralSignupIp === signupIp) {
        flagged = true;
        logger.warn('اشتباه إحالة ذاتية (نفس IP) - العمولة لن تُحتسب', { referrerStoreId, signupIp });
      }
    }

    return { referredByStoreId: String(referrerStoreId), referredByCode: codeRaw, flagged };
  }

  // يُبنى دائمًا مع StoreRepository.create: يولّد الكود، ثم بعد إنشاء المتجر يربطه بمعرفه الحقيقي.
  async createReferralFieldsForNewStore({ referralCodeInput, signupIp }) {
    const code = await this.generateUniqueCode();
    const link = await this.resolveReferralLink({ referralCodeInput, signupIp });
    return { code, signupIp: signupIp || null, ...link };
  }

  async afterStoreCreated(storeId, code) {
    if (code) await this.bindCodeToStore(code, storeId);
  }

  // ===== العمولات: تُستدعى فقط لما يدفع التاجر المدعو فعلاً (من webhook الدفع) =====
  // amountPaid: القيمة الكاملة للاشتراك اللي "دفعها" التاجر المدعو (نقدًا + رصيد مستعمل إن وُجد).
  async onSubscriptionPaid({ storeId, amountPaid }) {
    try {
      const store = await StoreRepository.findById(storeId);
      if (!store || !store.referredByStoreId) return; // هذا المتجر ما دخلش بكود دعوة، لا شيء نديرو

      if (store.referralFlaggedSelfReferral) {
        logger.warn('عمولة غير محتسبة: هذا المتجر موسوم كإحالة ذاتية مشبوهة', { storeId });
        return;
      }

      await StoreRepository.incrementReferralPaymentCount(storeId);
      const updated = await StoreRepository.findById(storeId);
      const paymentNumber = updated.referralPaymentCount;

      const percent = getCommissionPercent(paymentNumber);
      if (percent <= 0) return; // تجاوز 12 شهر من أول اشتراك - بدون عمولة

      const commission = Math.round((amountPaid * percent) / 100);
      if (commission <= 0) return;

      await StoreRepository.incrementWallet(store.referredByStoreId, commission);
      await ReferralRepository.recordCommission({
        referrerStoreId: store.referredByStoreId,
        referredStoreId: storeId,
        referredStoreName: store.storeName,
        amount: commission,
        percent,
        paymentNumber,
      });
    } catch (err) {
      // خطأ فـ حساب العمولة ما يجبش يوقف تفعيل اشتراك التاجر المدعو - نسجّل الخطأ فقط
      logger.error('فشل احتساب/إضافة عمولة الإحالة', { storeId, error: err.message });
    }
  }

  // ===== استعمال الرصيد تلقائيًا لتخفيض قيمة الاشتراك القادم =====
  // يرجع كم من المبلغ يمكن تغطيته من رصيد المحفظة (بدون تجاوز المبلغ المطلوب دفعه)
  computeWalletApplication(store, amountDue) {
    const balance = Math.max(0, Number(store?.walletBalance) || 0);
    const walletApplied = Math.min(balance, Math.max(0, amountDue));
    return { walletApplied, remaining: Math.max(0, amountDue - walletApplied) };
  }

  // ===== ملخص لوحة التاجر =====
  async getSummary(storeId) {
    const store = await StoreRepository.findByIdOrFail(storeId);
    const referredCount = await StoreRepository.countReferredStores(storeId);
    return {
      referralCode: store.referralCode || null,
      walletBalance: Number(store.walletBalance) || 0,
      referredCount,
      minWithdrawalAmount: MIN_WITHDRAWAL_AMOUNT,
    };
  }

  async listCommissions(storeId) {
    return ReferralRepository.listCommissionsForReferrer(storeId, 200);
  }

  // ===== طلبات السحب (من التاجر) =====

  async requestWithdrawal(storeId, { amount, method, accountNumber, phone }) {
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum < MIN_WITHDRAWAL_AMOUNT) {
      throw new ValidationError(`الحد الأدنى للسحب هو ${MIN_WITHDRAWAL_AMOUNT} دج`, ['amount']);
    }
    if (!WITHDRAWAL_METHODS.includes(method)) {
      throw new ValidationError('طريقة السحب يجب أن تكون CCP أو BaridiMob', ['method']);
    }
    if (!accountNumber || !String(accountNumber).trim()) {
      throw new ValidationError('رقم CCP أو BaridiMob مطلوب', ['accountNumber']);
    }
    if (!phone || !String(phone).trim()) {
      throw new ValidationError('رقم الهاتف مطلوب', ['phone']);
    }

    const store = await StoreRepository.findByIdOrFail(storeId);
    const balance = Number(store.walletBalance) || 0;
    if (balance < amountNum) {
      throw new ValidationError('رصيدك الحالي أقل من المبلغ المطلوب سحبه', ['amount']);
    }

    // ننقص الرصيد فورًا حتى ما يقدرش يطلب سحب مرتين لنفس المبلغ (يرجع تلقائيًا لو تم الرفض)
    await StoreRepository.incrementWallet(storeId, -amountNum);
    const request = await ReferralRepository.createWithdrawal({
      storeId,
      amount: amountNum,
      method,
      accountNumber: String(accountNumber).trim(),
      phone: String(phone).trim(),
    });
    logger.info('طلب سحب جديد', { storeId, amount: amountNum, method });
    return request;
  }

  async listWithdrawals(storeId) {
    return ReferralRepository.listForStore(storeId, 100);
  }

  // ===== لوحة الأدمن (السوبر أدمن) =====

  async adminListPendingWithdrawals() {
    return ReferralRepository.listPending(200);
  }

  async adminListAllWithdrawals() {
    return ReferralRepository.listAll(300);
  }

  async adminApproveWithdrawal(requestId, adminNote = '') {
    const request = await ReferralRepository.findByIdOrFail(requestId);
    if (request.status !== 'pending') {
      throw new ValidationError('هذا الطلب تمت معالجته من قبل', ['status']);
    }
    // الموافقة تعني أن الأدمن حوّل المبلغ يدويًا خارج النظام بالفعل - الرصيد كان نقص مسبقًا عند الطلب
    return ReferralRepository.updateStatus(requestId, 'approved', { adminNote, decidedAt: new Date() });
  }

  async adminRejectWithdrawal(requestId, adminNote = '') {
    const request = await ReferralRepository.findByIdOrFail(requestId);
    if (request.status !== 'pending') {
      throw new ValidationError('هذا الطلب تمت معالجته من قبل', ['status']);
    }
    // الرفض: نرجع الرصيد للتاجر تلقائيًا
    await StoreRepository.incrementWallet(request.storeId, request.amount);
    return ReferralRepository.updateStatus(requestId, 'rejected', { adminNote, decidedAt: new Date() });
  }
}

module.exports = new ReferralService();
