const SubscriptionService = require('../services/SubscriptionService');
const logger = require('../utils/logger');

// يفحص يوميًا الاشتراكات المنتهية ويعطلها + يرسل إشعار (عبر eventBus داخل SubscriptionService)
async function subscriptionExpirationJob() {
  const count = await SubscriptionService.checkAndExpireOverdue();
  logger.info('subscriptionExpirationJob: تم الفحص', { expiredCount: count });
}

module.exports = subscriptionExpirationJob;
