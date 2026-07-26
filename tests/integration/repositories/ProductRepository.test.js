// هذا اختبار تكاملي (integration) يحتاج اتصال حقيقي بـ Firestore (أو Firestore Emulator).
// معطّل افتراضيًا (describe.skip) لأن بيئة التطوير الحالية ما فيهاش اتصال شبكة/بيانات اعتماد حقيقية.
// لتشغيله: شغّل Firebase Emulator، عدّل describe.skip إلى describe، واحذف هذا التعليق.
require('../../setup');

describe.skip('ProductRepository (integration - يحتاج Firestore حقيقي أو Emulator)', () => {
  const ProductRepository = require('../../../src/repositories/ProductRepository');
  const TEST_STORE_ID = 'test-store-integration';

  test('ينشئ منتج ويقدر يجيبه بعدها', async () => {
    const id = await ProductRepository.create(TEST_STORE_ID, { name: 'تجربة', price: 100 });
    const found = await ProductRepository.findById(TEST_STORE_ID, id);
    expect(found.name).toBe('تجربة');
    await ProductRepository.delete(TEST_STORE_ID, id);
  });
});
