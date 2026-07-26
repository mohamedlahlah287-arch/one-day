// أسماء الأحداث المركزية - أي مكان في المشروع يستعمل هذه الثوابت بلاصة كتابة النص يدويًا
module.exports = {
  ORDER_CREATED: 'order.created',
  ORDER_STATUS_CHANGED: 'order.status_changed',
  ORDER_CANCELLED: 'order.cancelled',
  PRODUCT_CREATED: 'product.created',
  PRODUCT_UPDATED: 'product.updated',
  PRODUCT_OUT_OF_STOCK: 'product.out_of_stock',
  PRODUCT_LOW_STOCK: 'product.low_stock',
  CUSTOMER_REGISTERED: 'customer.registered',
  STORE_REGISTERED: 'store.registered',
  SUBSCRIPTION_EXPIRING_SOON: 'subscription.expiring_soon',
  SUBSCRIPTION_EXPIRED: 'subscription.expired',

  // شركات التوصيل (src/services/DeliveryService.js)
  SHIPMENT_CREATED: 'shipment.created',
  SHIPMENT_STATUS_CHANGED: 'shipment.status_changed',

  // نظام التعلّم والذاكرة (src/learning) - راجع src/learning/README.md
  MERCHANT_EDITED_REPLY: 'learning.merchant_edited_reply',
  MERCHANT_APPROVED_REPLY: 'learning.merchant_approved_reply',
  DICTIONARY_TERM_LEARNED: 'learning.dictionary_term_learned',
  DECISION_RECORDED: 'learning.decision_recorded',
};
