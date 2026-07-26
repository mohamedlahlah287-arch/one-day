const { EventEmitter } = require('events');
const logger = require('../utils/logger');

/**
 * eventBus: ناقل أحداث بسيط داخل نفس العملية (in-process).
 *
 * لماذا هذا مهم؟
 * بدل ما OrderService يستدعي مباشرة NotificationService و AnalyticsService و ReminderService
 * (وهذا يخلق ترابط قوي بينهم "tight coupling")، نخليه فقط يصدر حدث "تم إنشاء طلب"،
 * وأي خدمة مهتمة تستمع لهذا الحدث وتتصرف من جهتها. هذا يخلي إضافة ميزة جديدة
 * (مثال: إرسال SMS عند كل طلب) لا يحتاج تعديل OrderService إطلاقًا.
 *
 * لاحقًا إذا كبر المشروع، نقدر نبدلو هذا بـ Redis Pub/Sub أو Google Cloud Pub/Sub
 * بلا ما نلمسو الكود اللي يصدر أو يستمع للأحداث (نفس الواجهة: emit/on).
 */
class EventBus extends EventEmitter {
  emit(eventName, payload) {
    logger.debug(`حدث صدر: ${eventName}`, { payload });
    return super.emit(eventName, payload);
  }
}

module.exports = new EventBus();
