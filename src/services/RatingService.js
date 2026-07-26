const RatingRepository = require('../repositories/RatingRepository');
const NotificationService = require('./NotificationService');
const { ValidationError } = require('../errors');

class RatingService {
  async addRating(storeId, { orderId, psid, stars }) {
    const value = Number(stars);
    if (!value || value < 1 || value > 5) throw new ValidationError('تقييم غير صحيح');
    await RatingRepository.create(storeId, { orderId, psid, stars: value });
    if (value <= 2) {
      await NotificationService.notifyStoreOwner(
        storeId,
        `⚠️ زبون قيّم طلبه بـ ${value}/5 نجوم. قد يحتاج تواصل منك لمعرفة السبب وتحسين تجربته.`
      );
    }
    return this.getAverage(storeId);
  }

  async getAverage(storeId) {
    return RatingRepository.getAverage(storeId);
  }
}

module.exports = new RatingService();
