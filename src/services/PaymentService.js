const logger = require('../utils/logger');

/**
 * PaymentService: حاليًا Stub (بلا تنفيذ فعلي) لأن الدفع الإلكتروني في الجزائر محدود
 * (BaridiMob لا يوفر API عام سهل). الخطة الحالية: التاجر يدفع يدويًا (تحويل/BaridiMob)
 * وأنت تفعّل الاشتراك يدويًا عبر SubscriptionService.activate().
 *
 * هذا الملف موجود بلاصة يكون جاهز لما يتوفر مزود دفع فعلي (Chargily, CIB, إلخ)
 * بلا ما تحتاج تعيد هيكلة باقي المشروع.
 */
class PaymentService {
  async createManualPaymentRequest(storeId, amount, method = 'baridimob') {
    logger.info('طلب دفع يدوي جديد', { storeId, amount, method });
    return { storeId, amount, method, status: 'pending_manual_review' };
  }
}

module.exports = new PaymentService();
