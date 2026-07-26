const BaseRepository = require('./BaseRepository');

// سجل الرسائل بين البوت والزبون - مفيد للتحليلات ولتحسين محرك الفهم لاحقًا
class MessageRepository extends BaseRepository {
  constructor() {
    super('messages');
  }

  async logMessage(storeId, { fromTelegramId, direction, text, intent }) {
    return this.create(storeId, { fromTelegramId, direction, text, intent });
  }
}

module.exports = new MessageRepository();
