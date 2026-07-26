const { env } = require('../config/env');
const RateLimitError = require('../errors/RateLimitError');

// Rate limiting بسيط في الذاكرة: كل معرف (Telegram ID أو Facebook PSID) عنده حد أقصى
// من الرسائل كل نافذة زمنية. كافي لحماية من spam بسيط أو bug في تطبيق العميل.
// إذا كبر النظام لعدة سيرفرات، هذا يحتاج ينتقل لـ Redis (نفس مبدأ queue.js).
const requestLog = new Map(); // userId -> [timestamps]

function isRateLimited(userId) {
  if (!userId) return false;
  const now = Date.now();
  const windowStart = now - env.rateLimit.windowMs;
  const timestamps = (requestLog.get(userId) || []).filter((t) => t > windowStart);

  if (timestamps.length >= env.rateLimit.maxRequests) {
    return true;
  }
  timestamps.push(now);
  requestLog.set(userId, timestamps);
  return false;
}

// Middleware لبوتات Telegraf (بوت التاجر وبوت السوبر أدمن)
function rateLimiter(ctx, next) {
  const userId = ctx.from?.id;
  if (isRateLimited(userId)) {
    throw new RateLimitError();
  }
  return next();
}

module.exports = rateLimiter;
module.exports.isRateLimited = isRateLimited;
