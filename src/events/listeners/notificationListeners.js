const eventBus = require('../eventBus');
const events = require('../eventNames');
const NotificationService = require('../../services/NotificationService');
const StoreRepository = require('../../repositories/StoreRepository');
const OrderRepository = require('../../repositories/OrderRepository');
const { SHIPMENT_STATUS_CUSTOMER_MESSAGE } = require('../../config/shipmentStatuses');
const logger = require('../../utils/logger');

// كل استماع هنا مسؤول عن "شنو نديرو" لما يوقع حدث معين، بلا ما OrderService/ProductService
// يعرفو بوجود هذا المنطق إطلاقًا (فصل كامل بين "وقوع الحدث" و"رد الفعل عليه")
function registerNotificationListeners() {
  eventBus.on(events.ORDER_CREATED, async ({ storeId, order, total }) => {
    await NotificationService.notifyStoreOwner(
      storeId,
      `🛒 طلب جديد!\n\n👤 ${order.name}\n📱 ${order.phone}\n📍 ${order.wilaya}, ${order.commune}\n💰 ${total} دج`
    );
  });

  eventBus.on(events.PRODUCT_OUT_OF_STOCK, async ({ storeId, productName }) => {
    await NotificationService.notifyStoreOwner(storeId, `⚠️ نفدت كمية المنتج: ${productName}`);
  });

  eventBus.on(events.PRODUCT_LOW_STOCK, async ({ storeId, productName, quantity }) => {
    await NotificationService.notifyStoreOwner(
      storeId,
      `🟡 تنبيه: تبقى فقط ${quantity} من "${productName}" في المخزون. فكر في تجديد الكمية قريبًا.`
    );
  });

  eventBus.on(events.SUBSCRIPTION_EXPIRED, async ({ storeId }) => {
    await NotificationService.notifyStoreOwner(
      storeId,
      '⛔ انتهى اشتراكك في النظام. تواصل معنا لتجديد الاشتراك ومواصلة استقبال الطلبات.'
    );
    await NotificationService.notifySuperAdmin(`⛔ اشتراك المتجر ${storeId} انتهى وتم إيقافه تلقائيًا.`);
  });

  eventBus.on(events.STORE_REGISTERED, async ({ storeId, storeName }) => {
    await NotificationService.notifySuperAdmin(`🆕 تم إنشاء متجر جديد: "${storeName}" (${storeId})`);
  });

  // إشعار الزبون بأن طلبه تأكد - فقط إذا فعّل التاجر "تأكيد الطلب للزبون" من الإعدادات.
  // إذا كانت الميزة معطّلة (الافتراضي)، ما يوصلش أي إشعار عند التأكيد.
  eventBus.on(events.ORDER_STATUS_CHANGED, async ({ storeId, orderId, status }) => {
    if (status !== 'تم التأكيد') return;
    try {
      const store = await StoreRepository.findById(storeId);
      if (!store || !store.orderConfirmationEnabled) return;
      const order = await OrderRepository.findById(storeId, orderId);
      if (!order || !order.customerId) return; // طلب بلا معرف زبون فيسبوك (نادر) - نتجاهل بصمت
      await NotificationService.notifyCustomer(
        storeId,
        order.customerId,
        `✅ تم تأكيد طلبك "${order.productName}"! جاري تجهيزه للشحن قريبًا.`
      );
    } catch (err) {
      logger.error('فشل إرسال إشعار تأكيد الطلب للزبون', { storeId, orderId, error: err.message });
    }
  });

  // إشعار الزبون تلقائيًا بكل تغيير فـ حالة شحنته عند شركة التوصيل (المتطلب #4)
  eventBus.on(events.SHIPMENT_STATUS_CHANGED, async ({ storeId, orderId, status }) => {
    try {
      const message = SHIPMENT_STATUS_CUSTOMER_MESSAGE[status];
      if (!message) return;
      const order = await OrderRepository.findById(storeId, orderId);
      if (!order || !order.customerId) return;
      const trackingLine = order.shipmentTrackingUrl ? `\n🔗 تتبع الطلب: ${order.shipmentTrackingUrl}` : '';
      await NotificationService.notifyCustomer(storeId, order.customerId, `${message}${trackingLine}`);
    } catch (err) {
      logger.error('فشل إرسال إشعار تغيّر حالة الشحنة للزبون', { storeId, orderId, error: err.message });
    }
  });
}

module.exports = registerNotificationListeners;
