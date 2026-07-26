const OrderRepository = require('../repositories/OrderRepository');
const ProductService = require('./ProductService');
const CouponService = require('./CouponService');
const eventBus = require('../events/eventBus');
const events = require('../events/eventNames');
const { ValidationError } = require('../errors');
const logger = require('../utils/logger');

const VALID_STATUSES = ['جديد', 'تم التأكيد', 'تم الشحن', 'تم التسليم', 'ملغى'];

class OrderService {
  validateOrderInput(data) {
    const required = ['name', 'phone', 'wilaya', 'commune', 'address', 'productId'];
    const missing = required.filter((f) => !data[f] || String(data[f]).trim() === '');
    if (missing.length) {
      throw new ValidationError('بيانات الطلب ناقصة', missing);
    }
  }

  async createOrder(storeId, orderInput) {
    this.validateOrderInput(orderInput);

    // نتأكد أن المنتج موجود فعلاً ونجيب سعره الحقيقي من قاعدة البيانات
    // (ماشي من الرسالة اللي بعتها الواجهة - تفاديًا لتلاعب بالسعر من طرف العميل)
    const product = await ProductService.getProduct(storeId, orderInput.productId);

    const quantity = Number(orderInput.quantity) > 0 ? Math.floor(Number(orderInput.quantity)) : 1;
    if (product.quantity !== null && product.quantity !== undefined && quantity > product.quantity) {
      throw new ValidationError(`الكمية المطلوبة غير متوفرة. المتبقي فقط ${product.quantity} من "${product.name}".`);
    }

    let total = product.price * quantity;
    let discount = 0;
    let appliedCoupon = null;

    if (orderInput.couponCode) {
      const result = await CouponService.validateAndApply(storeId, orderInput.couponCode, total);
      total = result.total;
      discount = result.discount;
      appliedCoupon = result.coupon;
    }

    const orderId = await OrderRepository.create(storeId, {
      name: orderInput.name.trim(),
      phone: orderInput.phone.trim(),
      wilaya: orderInput.wilaya.trim(),
      commune: orderInput.commune.trim(),
      address: orderInput.address.trim(),
      bestTime: orderInput.bestTime || 'أي وقت',
      notes: orderInput.notes || '',
      productId: product.id,
      productName: product.name,
      price: product.price,
      quantity,
      discount,
      total,
      couponCode: appliedCoupon ? appliedCoupon.code : null,
      customerId: orderInput.customerId || null,
      status: 'جديد',
    });

    await ProductService.reduceStockAfterOrder(storeId, product.id, quantity);

    eventBus.emit(events.ORDER_CREATED, { storeId, orderId, order: orderInput, total });
    logger.info('تم إنشاء طلب جديد', { storeId, orderId, total, quantity });

    return { orderId, total, discount };
  }

  async listOrders(storeId, limit = 30) {
    return OrderRepository.findAll(storeId, { limit });
  }

  async updateStatus(storeId, orderId, status, actor = null) {
    if (!VALID_STATUSES.includes(status)) {
      throw new ValidationError('حالة الطلب غير صحيحة', ['status']);
    }
    const fields = { status };
    // actor: { id, name } - من قام بتغيير الحالة (تاجر عبر الموقع أو موظف عبر تيليغرام) -
    // يُستعمل حصريًا لتقرير "أداء الموظفين" فـ التحليلات (المتطلب #10)، بلا أي أثر آخر.
    if (actor?.id) fields.lastHandledBy = { id: String(actor.id), name: actor.name || null, at: new Date().toISOString() };
    const order = await OrderRepository.update(storeId, orderId, fields);
    eventBus.emit(events.ORDER_STATUS_CHANGED, { storeId, orderId, status });
    if (status === 'ملغى') {
      eventBus.emit(events.ORDER_CANCELLED, { storeId, orderId });
    }
    return order;
  }

  async getStats(storeId) {
    const statusCounts = await OrderRepository.countByStatusAcrossStore(storeId);
    const totalOrders = Object.values(statusCounts).reduce((a, b) => a + b, 0);
    return {
      totalOrders,
      cancelledOrders: statusCounts['ملغى'] || 0,
      byStatus: statusCounts,
    };
  }

  // متوفرة فقط لأصحاب باقة "إحصائيات كاملة" (fullAnalytics)
  async getTopProducts(storeId, limit = 5) {
    return OrderRepository.getTopSellingProducts(storeId, limit);
  }
}

module.exports = new OrderService();
