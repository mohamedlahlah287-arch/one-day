const StoreRepository = require('../repositories/StoreRepository');

// MessageQuotaService: يتحقق هل المتجر مازال يقدر يستقبل رسائل زبائن (نشط + ما وصلش لحد الباقة)،
// ويزيد العداد بعد كل رسالة مسموح بها. العداد يتصفر عند التجديد/تغيير الباقة (SubscriptionService/StoreService).
class MessageQuotaService {
  // store: كائن المتجر (يفضل تمريره جاهزًا لتفادي قراءة إضافية من قاعدة البيانات)
  canConsume(store) {
    if (!store || !store.active) {
      return { allowed: false, reason: 'inactive' };
    }
    if (store.messageLimit === null || store.messageLimit === undefined) {
      return { allowed: true, unlimited: true };
    }
    if ((store.messageCount || 0) >= store.messageLimit) {
      return { allowed: false, reason: 'quota' };
    }
    return { allowed: true };
  }

  async consume(storeId) {
    await StoreRepository.incrementMessageCount(storeId, 1);
  }
}

module.exports = new MessageQuotaService();
