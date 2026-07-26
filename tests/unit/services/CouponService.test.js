require('../../setup');

jest.mock('../../../src/repositories/CouponRepository', () => ({
  findByCode: jest.fn(),
  create: jest.fn(),
}));

const CouponRepository = require('../../../src/repositories/CouponRepository');
const CouponService = require('../../../src/services/CouponService');
const { NotFoundError, ValidationError } = require('../../../src/errors');

describe('CouponService.validateAndApply', () => {
  test('يرجع بلا خصم لو ما كاين حتى كود', async () => {
    const result = await CouponService.validateAndApply('store1', null, 1000);
    expect(result.total).toBe(1000);
    expect(result.discount).toBe(0);
  });

  test('يرمي NotFoundError لو الكود غير موجود', async () => {
    CouponRepository.findByCode.mockResolvedValue(null);
    await expect(CouponService.validateAndApply('store1', 'XXXX', 1000)).rejects.toThrow(NotFoundError);
  });

  test('يحسب الخصم النسبي بشكل صحيح', async () => {
    CouponRepository.findByCode.mockResolvedValue({ code: 'SALE10', type: 'percentage', value: 10, active: true });
    const result = await CouponService.validateAndApply('store1', 'SALE10', 1000);
    expect(result.discount).toBe(100);
    expect(result.total).toBe(900);
  });

  test('يرفض كوبون غير مفعّل', async () => {
    CouponRepository.findByCode.mockResolvedValue({ code: 'OLD', active: false });
    await expect(CouponService.validateAndApply('store1', 'OLD', 1000)).rejects.toThrow(ValidationError);
  });
});
