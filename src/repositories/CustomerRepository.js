const BaseRepository = require('./BaseRepository');
const { FieldValue } = require('../database/firestore');

// عملاء المتجر (لتذكر العميل المتكرر، سجل الطلبات، إلخ)
// المعرف = Facebook PSID تاع العميل (كان سابقًا Telegram ID قبل الانتقال لـ Messenger)
class CustomerRepository extends BaseRepository {
  constructor() {
    super('customers');
  }

  async findByCustomerId(storeId, customerId) {
    return this.findById(storeId, String(customerId));
  }

  async upsert(storeId, customerId, data) {
    const ref = this.collectionRef(storeId).doc(String(customerId));
    await ref.set(
      { ...data, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
    const snap = await ref.get();
    return { id: snap.id, ...snap.data() };
  }
}

module.exports = new CustomerRepository();
