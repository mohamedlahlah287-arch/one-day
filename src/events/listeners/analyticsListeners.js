const eventBus = require('../eventBus');
const events = require('../eventNames');
const AnalyticsService = require('../../services/AnalyticsService');

function registerAnalyticsListeners() {
  eventBus.on(events.ORDER_CREATED, ({ storeId, orderId, total }) => {
    AnalyticsService.track(storeId, 'order_created', { orderId, total });
  });

  eventBus.on(events.ORDER_CANCELLED, ({ storeId, orderId }) => {
    AnalyticsService.track(storeId, 'order_cancelled', { orderId });
  });

  eventBus.on(events.CUSTOMER_REGISTERED, ({ storeId, customerId }) => {
    AnalyticsService.track(storeId, 'customer_registered', { customerId });
  });

  eventBus.on(events.STORE_REGISTERED, ({ storeId }) => {
    AnalyticsService.track(storeId, 'store_registered', {});
  });
}

module.exports = registerAnalyticsListeners;
