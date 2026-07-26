const CouponRepository = require('../repositories/CouponRepository');
const { ValidationError, NotFoundError } = require('../errors');

class CouponService {
  async validateAndApply(storeId, code, orderTotal) {
    if (!code) return { discount: 0, total: orderTotal, coupon: null };

    const coupon = await CouponRepository.findByCode(storeId, code);
    if (!coupon) throw new NotFoundError('الكوبون');
    if (coupon.active === false) throw new ValidationError('هذا الكوبون لم يعد ساري المفعول');
    if (coupon.expiresAt && coupon.expiresAt.toDate && coupon.expiresAt.toDate() < new Date()) {
      throw new ValidationError('هذا الكوبون منتهي الصلاحية');
    }

    const discount = coupon.type === 'percentage'
      ? Math.round((orderTotal * coupon.value) / 100)
      : coupon.value;

    const total = Math.max(0, orderTotal - discount);
    return { discount, total, coupon };
  }

  async createCoupon(storeId, { code, type, value, expiresAt }) {
    if (!code || !['percentage', 'fixed'].includes(type) || !value) {
      throw new ValidationError('بيانات الكوبون غير مكتملة');
    }
    return CouponRepository.create(storeId, {
      code: code.toUpperCase(),
      type,
      value: Number(value),
      expiresAt: expiresAt || null,
      active: true,
    });
  }
}

module.exports = new CouponService();
