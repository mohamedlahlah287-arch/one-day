const PromoCodeRepository = require('../repositories/PromoCodeRepository');
const StoreRepository = require('../repositories/StoreRepository');
const StoreService = require('./StoreService');
const ValidationError = require('../errors/ValidationError');
const NotFoundError = require('../errors/NotFoundError');
const logger = require('../utils/logger');

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // بلا حروف/أرقام تتشابه بصريًا (0/O, 1/I)

function randomCode(length = 8) {
  let out = '';
  for (let i = 0; i < length; i++) out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return out;
}

class PromoCodeService {
  // ينشئ كود عرض جديد. plan: كائن باقة كامل (id/name/messageLimit/productLimit/features/durationDays مؤقتة)
  // validForDays: عدد أيام صلاحية الكود نفسه (بعدها ما يقدرش أي حد يستعمله)
  // trialHours: مدة صلاحية العرض بعد الاستعمال (بالساعات) قبل ما يرجع التاجر لباقته الأصلية
  async createCode({ plan, validForDays, trialHours, maxUses = null }) {
    const code = randomCode();
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + Number(validForDays || 7));

    await PromoCodeRepository.create(code, {
      plan,
      trialHours: Number(trialHours) || 24,
      validUntil,
      maxUses: maxUses === null ? null : Number(maxUses),
    });
    return code;
  }

  // يتحقق من الكود ويطبّق الباقة المؤقتة على متجر التاجر (storeId = معرف تيليغرام صاحب المتجر)
  async redeemCode(storeId, rawCode) {
    const code = String(rawCode).trim().toUpperCase();
    const promo = await PromoCodeRepository.findByCode(code);
    if (!promo) throw new ValidationError('هذا الكود غير صحيح.');

    if (promo.validUntil?.toDate ? promo.validUntil.toDate() < new Date() : new Date(promo.validUntil) < new Date()) {
      throw new ValidationError('انتهت صلاحية هذا الكود.');
    }
    if (Array.isArray(promo.usedByStoreIds) && promo.usedByStoreIds.includes(String(storeId))) {
      throw new ValidationError('استعملت هذا الكود من قبل، لا يمكن استعماله مرتين لنفس المتجر.');
    }
    if (promo.maxUses !== null && (promo.usedByStoreIds || []).length >= promo.maxUses) {
      throw new ValidationError('نفدت عدد مرات استعمال هذا الكود.');
    }

    const store = await StoreRepository.findById(storeId);
    if (!store) throw new NotFoundError('المتجر', { storeId });

    // نحفظ الباقة الحالية باش نرجعها بعد ما تنتهي مدة العرض
    const previousPlanSnapshot = StoreService.buildPlanFromStore(store);
    const trialExpiresAt = new Date(Date.now() + promo.trialHours * 60 * 60 * 1000);

    await StoreService.changePlan(storeId, { ...promo.plan, durationDays: previousPlanSnapshot.durationDays });
    await StoreRepository.update(storeId, {
      promoTrialExpiresAt: trialExpiresAt,
      promoTrialPreviousPlan: previousPlanSnapshot,
      promoTrialCode: code,
    });
    await PromoCodeRepository.markUsedBy(code, storeId);

    logger.info('تم استعمال كود عرض', { storeId, code });
    return { plan: promo.plan, trialExpiresAt };
  }

  // تُستدعى دوريًا (job): ترجع كل المتاجر اللي انتهت مدة عرضها لباقتها الأصلية
  async revertExpiredTrials() {
    const stores = await StoreRepository.findStoresWithExpiredPromoTrial(new Date());
    for (const store of stores) {
      const previous = store.promoTrialPreviousPlan;
      if (previous) {
        await StoreService.changePlan(store.id, previous);
      }
      await StoreRepository.update(store.id, {
        promoTrialExpiresAt: null,
        promoTrialPreviousPlan: null,
        promoTrialCode: null,
      });
      logger.info('انتهى عرض تجريبي - تم إرجاع المتجر لباقته الأصلية', { storeId: store.id });
    }
    return stores.length;
  }
}

module.exports = new PromoCodeService();
