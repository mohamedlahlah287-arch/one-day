const eventBus = require('../eventBus');
const events = require('../eventNames');
const OrderRepository = require('../../repositories/OrderRepository');
const FacebookSessionRepository = require('../../repositories/FacebookSessionRepository');
const FacebookMessengerService = require('../../services/FacebookMessengerService');
const { ratingQuickReplies } = require('../../ui/customerKeyboards');
const logger = require('../../utils/logger');

// كي تحدّث حالة الطلب لـ "تم التسليم"، نطلب من الزبون تقييم تجربته (1 إلى 5 نجوم)
function registerRatingListeners() {
  eventBus.on(events.ORDER_STATUS_CHANGED, async ({ storeId, orderId, status }) => {
    if (status !== 'تم التسليم') return;
    try {
      const order = await OrderRepository.findById(storeId, orderId);
      if (!order || !order.customerId) return; // طلب بلا معرف زبون فيسبوك (نادر) - نتجاهل بصمت

      await FacebookSessionRepository.set(order.customerId, { pendingRatingOrderId: orderId });
      await FacebookMessengerService.sendQuickReplies(
        storeId,
        order.customerId,
        `🎉 تم تسليم طلبك بنجاح! كيف كانت تجربتك مع "${order.productName}"؟`,
        ratingQuickReplies
      );
    } catch (err) {
      logger.error('فشل إرسال طلب تقييم للزبون', { storeId, orderId, error: err.message });
    }
  });
}

module.exports = registerRatingListeners;
