require('../../setup');

// نعمل mock لـ ProductRepository بلاصة الاتصال الحقيقي بـ Firestore
jest.mock('../../../src/repositories/ProductRepository', () => ({
  create: jest.fn().mockResolvedValue('fake-id-123'),
  findAll: jest.fn(),
  findAllInStock: jest.fn(),
  findById: jest.fn(),
  findByIdOrFail: jest.fn(),
  delete: jest.fn(),
  decrementQuantity: jest.fn(),
}));

const ProductService = require('../../../src/services/ProductService');
const { ValidationError } = require('../../../src/errors');

describe('ProductService.validateProduct', () => {
  test('يرفض منتج بلا اسم', () => {
    expect(() => ProductService.validateProduct({ price: 1000 })).toThrow(ValidationError);
  });

  test('يرفض سعر سالب أو صفر', () => {
    expect(() => ProductService.validateProduct({ name: 'سماعات', price: 0 })).toThrow(ValidationError);
  });

  test('يقبل منتج صحيح بلا رمي خطأ', () => {
    expect(() => ProductService.validateProduct({ name: 'سماعات', price: 2500 })).not.toThrow();
  });
});

describe('ProductService.addProduct', () => {
  test('يستدعي المستودع بالبيانات الصحيحة ويرجع المعرف', async () => {
    const id = await ProductService.addProduct('store1', { name: 'ساعة', price: 3000 });
    expect(id).toBe('fake-id-123');
  });

  test('يرمي خطأ ولا يستدعي المستودع لو البيانات خاطئة', async () => {
    const ProductRepository = require('../../../src/repositories/ProductRepository');
    ProductRepository.create.mockClear();
    await expect(ProductService.addProduct('store1', { price: -5 })).rejects.toThrow(ValidationError);
    expect(ProductRepository.create).not.toHaveBeenCalled();
  });
});
