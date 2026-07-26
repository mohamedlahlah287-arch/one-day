const CustomerRepository = require('../repositories/CustomerRepository');
const OrderRepository = require('../repositories/OrderRepository');
const FacebookMessengerService = require('./FacebookMessengerService');
const logger = require('../utils/logger');

const INACTIVE_DAYS_DEFAULT = 30;
// وسم Messenger المستعمل للرسائل خارج نافذة الـ24 ساعة (البث الجماعي). راجع الملاحظة
// فـ FacebookMessengerService.sendTextTagged - سياسات Meta لهذا النوع من الرسائل تتغيّر،
// تحقّق من التوثيق الرسمي قبل استعمال هذا لحملة تسويقية حقيقية واسعة.
const BROADCAST_TAG = 'CONFIRMED_EVENT_UPDATE';

function toDate(value) {
  if (!value) return null;
  if (value.toDate) return value.toDate();
  return new Date(value);
}

// BroadcastService: يحدد الجمهور المستهدف (المتطلب #9) ثم يرسل الرسالة لكل واحد فيه، مع
// تحمّل فشل بعض الرسائل بدون ما توقف الإرسال لبقية الجمهور، وتقرير نهائي (نجح/فشل).
class BroadcastService {
  async _uniqueCustomerIdsFromOrders(storeId, predicate) {
    const orders = await OrderRepository.findAll(storeId, { limit: 3000 });
    const seen = new Set();
    orders.filter(predicate).forEach((o) => {
      if (o.customerId) seen.add(String(o.customerId));
    });
    return [...seen];
  }

  // يُرجع قائمة معرّفات العملاء (Facebook PSID) حسب الفئة المطلوبة
  async resolveAudience(storeId, segment, filters = {}) {
    switch (segment) {
      case 'all': {
        const customers = await CustomerRepository.findAll(storeId, { limit: 5000, orderByField: 'lastSeenAt' });
        return customers.map((c) => c.id);
      }
      case 'previous_buyers':
        return this._uniqueCustomerIdsFromOrders(storeId, (o) => o.status !== 'ملغى');
      case 'inactive': {
        const days = Number(filters.inactiveDays) || INACTIVE_DAYS_DEFAULT;
        const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
        const customers = await CustomerRepository.findAll(storeId, { limit: 5000, orderByField: 'lastSeenAt' });
        return customers.filter((c) => {
          const last = toDate(c.lastSeenAt);
          return !last || last.getTime() < cutoff;
        }).map((c) => c.id);
      }
      case 'by_wilaya':
        if (!filters.wilaya) throw new Error('يجب تحديد الولاية');
        return this._uniqueCustomerIdsFromOrders(storeId, (o) => o.wilaya === filters.wilaya && o.status !== 'ملغى');
      case 'by_product':
        if (!filters.productId && !filters.productName) throw new Error('يجب تحديد المنتج');
        return this._uniqueCustomerIdsFromOrders(
          storeId,
          (o) => (filters.productId ? o.productId === filters.productId : o.productName === filters.productName) && o.status !== 'ملغى'
        );
      default:
        throw new Error(`فئة جمهور غير معروفة: ${segment}`);
    }
  }

  // message: { text, imageUrl?, couponCode? } - يُرسل بالتتابع مع تأخير بسيط لتفادي حدود
  // معدل Graph API، ويتحمّل فشل عملاء أفراد بدون توقف باقي الحملة.
  async send(storeId, segment, filters, message) {
    if (!message?.text) throw new Error('نص الرسالة مطلوب');
    const audience = await this.resolveAudience(storeId, segment, filters);
    if (!audience.length) return { total: 0, sent: 0, failed: 0 };

    const fullText = message.couponCode ? `${message.text}\n\n🎟️ كود الخصم: ${message.couponCode}` : message.text;

    let sent = 0;
    let failed = 0;
    for (const psid of audience) {
      try {
        if (message.imageUrl) {
          await FacebookMessengerService.sendImage(storeId, psid, message.imageUrl, { messagingType: 'MESSAGE_TAG', tag: BROADCAST_TAG });
        }
        await FacebookMessengerService.sendTextTagged(storeId, psid, fullText, { messagingType: 'MESSAGE_TAG', tag: BROADCAST_TAG });
        sent += 1;
      } catch (err) {
        failed += 1;
        logger.warn('فشل إرسال رسالة بث لعميل واحد', { storeId, psid, error: err.message });
      }
      // تأخير بسيط بين الرسائل لتفادي حدود معدل Graph API عند حملات واسعة
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 60));
    }

    logger.info('انتهت حملة البث الجماعي', { storeId, segment, total: audience.length, sent, failed });
    return { total: audience.length, sent, failed };
  }
}

module.exports = new BroadcastService();
