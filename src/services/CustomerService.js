const CustomerRepository = require('../repositories/CustomerRepository');
const eventBus = require('../events/eventBus');
const events = require('../events/eventNames');

class CustomerService {
  // customerId = Facebook PSID
  async findOrRegister(storeId, customerId, profile = {}) {
    const existing = await CustomerRepository.findByCustomerId(storeId, customerId);
    const customer = await CustomerRepository.upsert(storeId, customerId, {
      ...profile,
      lastSeenAt: new Date(),
    });
    if (!existing) {
      eventBus.emit(events.CUSTOMER_REGISTERED, { storeId, customerId, profile });
    }
    return { customer, isNew: !existing };
  }
}

module.exports = new CustomerService();
