const BaseRepository = require('./BaseRepository');

// تخزين إشعارات صاحب المتجر لما يختار "الموقع" بدل "تيليغرام" فـ إعدادات الإشعارات
// (stores/{storeId}/webNotifications/{id}) - تُقرأ من لوحة التحكم على الموقع.
class WebNotificationRepository extends BaseRepository {
  constructor() {
    super('webNotifications');
  }

  async create(storeId, message) {
    return super.create(storeId, { message, read: false });
  }

  async listRecent(storeId, limit = 30) {
    return this.findAll(storeId, { orderByField: 'createdAt', direction: 'desc', limit });
  }
}

module.exports = new WebNotificationRepository();
