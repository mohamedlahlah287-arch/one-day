const logger = require('../utils/logger');
const OAuthConnectRepository = require('../repositories/OAuthConnectRepository');
const PendingRegistrationRepository = require('../repositories/PendingRegistrationRepository');
const AccountLinkRepository = require('../repositories/AccountLinkRepository');
const WebSessionRepository = require('../repositories/WebSessionRepository');

// عمليات تنظيف دورية: يحذف توكنات ربط فيسبوك/الموقع وتسجيلات المتاجر المؤقتة وجلسات الموقع المنتهية.
async function cleanupJob() {
  const [oauthDeleted, regDeleted, linkDeleted, sessionsDeleted] = await Promise.all([
    OAuthConnectRepository.deleteExpiredBefore(new Date()),
    PendingRegistrationRepository.deleteExpiredBefore(new Date()),
    AccountLinkRepository.deleteExpiredBefore(new Date()),
    WebSessionRepository.deleteExpiredBefore(new Date()),
  ]);
  logger.debug('cleanupJob: تم تنظيف التوكنات المنتهية', { oauthDeleted, regDeleted, linkDeleted, sessionsDeleted });
}

module.exports = cleanupJob;
