const { Telegram } = require('telegraf');
const { env } = require('../config/env');
const logger = require('../utils/logger');
const FacebookMessengerService = require('./FacebookMessengerService');
const StoreRepository = require('../repositories/StoreRepository');
const WebNotificationRepository = require('../repositories/WebNotificationRepository');

/**
 * NotificationService: مسؤول فقط عن إرسال الإشعارات، عبر القناة المناسبة لكل طرف:
 * - صاحب المتجر والسوبر أدمن: عبر Telegram
 * - الزبون: عبر Facebook Messenger (منذ الانتقال من Telegram)
 */
class NotificationService {
  constructor() {
    this.merchantTelegram = new Telegram(env.telegram.merchantBotToken);
    this.superAdminTelegram = env.telegram.superAdminBotToken
      ? new Telegram(env.telegram.superAdminBotToken)
      : null;
  }

  // يرسل الإشعار عبر القناة اللي اختارها التاجر فـ إعداداته (تيليغرام افتراضيًا، أو الموقع).
  // إذا كانت القناة "الموقع"، نحفظ الإشعار فـ Firestore بدل إرساله لتيليغرام، وتقرأه لوحة التحكم.
  async notifyStoreOwner(storeId, message) {
    let channel = 'telegram';
    try {
      const store = await StoreRepository.findById(storeId);
      if (store?.notificationChannel === 'web') channel = 'web';
    } catch (err) {
      // فشل جلب المتجر لتحديد القناة - نكمل بالافتراضي (تيليغرام) بدل ما نوقف الإشعار كليًا
    }

    if (channel === 'web') {
      try {
        await WebNotificationRepository.create(storeId, message);
      } catch (err) {
        logger.error('فشل حفظ إشعار الموقع لصاحب المتجر', { storeId, error: err.message });
      }
      return;
    }

    try {
      await this.merchantTelegram.sendMessage(storeId, message);
    } catch (err) {
      logger.error('فشل إرسال إشعار لصاحب المتجر', { storeId, error: err.message });
    }
  }

  // مثل notifyStoreOwner لكن مع أزرار Inline - تُستعمل من نظام التعلّم (زر "علمني": ✔ ممتاز / ✏️ تعديل)
  // extraMarkup: ناتج Markup.inlineKeyboard(...) من telegraf
  async notifyStoreOwnerInteractive(storeId, message, extraMarkup) {
    try {
      await this.merchantTelegram.sendMessage(storeId, message, extraMarkup);
    } catch (err) {
      logger.error('فشل إرسال إشعار تفاعلي لصاحب المتجر', { storeId, error: err.message });
    }
  }

  // customerId هنا هو Facebook PSID (وليس Telegram ID). storeId يحدد أي صفحة نرسل منها.
  async notifyCustomer(storeId, customerId, message) {
    try {
      await FacebookMessengerService.sendText(storeId, customerId, message);
    } catch (err) {
      logger.error('فشل إرسال إشعار للزبون', { customerId, error: err.message });
    }
  }

  // إشعار السوبر أدمن (أنت) بأحداث مهمة: متجر جديد، اشتراك انتهى، إلخ.
  async notifySuperAdmin(message) {
    if (!this.superAdminTelegram || !env.superAdminTelegramId) return;
    try {
      await this.superAdminTelegram.sendMessage(env.superAdminTelegramId, message);
    } catch (err) {
      logger.error('فشل إرسال إشعار للسوبر أدمن', { error: err.message });
    }
  }
}

module.exports = new NotificationService();
