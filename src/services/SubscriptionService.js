const StoreRepository = require('../repositories/StoreRepository');
const eventBus = require('../events/eventBus');
const events = require('../events/eventNames');

// إدارة اشتراك التاجر في النظام (trial / active / expired)
// التفعيل والتجديد يدويان حاليًا (السوبر أدمن يجدد بعد ما التاجر يدفع)؛
// لاحقًا يمكن ربطه بـ PaymentService لما يتوفر دفع تلقائي.
class SubscriptionService {
  // تجديد/تفعيل اشتراك متجر بباقة معينة. يمدد تاريخ الانتهاء من اليوم + مدة الباقة،
  // ويعيد ضبط عداد الرسائل الشهري، ويعيد تفعيل المتجر لو كان متوقفًا (إلا لو كان موقوف يدويًا بشكل صريح).
  async renew(storeId, plan) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + plan.durationDays);
    return StoreRepository.update(storeId, {
      subscriptionStatus: 'active',
      subscriptionExpiresAt: expiresAt,
      active: true,
      manuallyPaused: false,
      planId: plan.id,
      planName: plan.name,
      messageLimit: plan.messageLimit,
      productLimit: plan.productLimit,
      features: plan.features,
      messageCount: 0,
    });
  }

  async checkAndExpireOverdue() {
    const now = new Date();
    const expiring = await StoreRepository.findExpiringSubscriptions(now);
    for (const store of expiring) {
      await StoreRepository.update(store.id, { subscriptionStatus: 'expired', active: false });
      eventBus.emit(events.SUBSCRIPTION_EXPIRED, { storeId: store.id });
    }
    return expiring.length;
  }
}

module.exports = new SubscriptionService();
