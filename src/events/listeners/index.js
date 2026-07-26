const registerNotificationListeners = require('./notificationListeners');
const registerAnalyticsListeners = require('./analyticsListeners');
const registerRatingListeners = require('./ratingListeners');

// نقطة تسجيل موحدة لكل الاستماعات - تُستدعى عند إقلاع أي بوت.
// محمية من التسجيل المزدوج (idempotent): لو تم استدعاؤها أكثر من مرة في نفس العملية
// (مثال: شغلت البوتات الثلاثة مع بعض في process واحد)، ما تكررش الاستماعات
// (وإلا كل حدث يتعالج مرتين أو أكثر - إشعارات مكررة، تحليلات مضاعفة، إلخ).
let alreadyRegistered = false;

function registerAllListeners() {
  if (alreadyRegistered) return;
  registerNotificationListeners();
  registerAnalyticsListeners();
  registerRatingListeners();
  alreadyRegistered = true;
}

module.exports = registerAllListeners;
