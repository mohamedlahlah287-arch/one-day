require('../setup');
const engine = require('../../src/engine/responseEngine');

describe('responseEngine.detectIntent', () => {
  test('يفهم سؤال السعر بالدارجة', () => {
    expect(engine.detectIntent('بشحال هذا')).toBe('price');
    expect(engine.detectIntent('قداش الثمن')).toBe('price');
  });

  test('يفهم نية الشراء', () => {
    expect(engine.detectIntent('نحب نشري هذا المنتج')).toBe('buy');
  });

  test('يرجع unknown لسؤال خارج النطاق', () => {
    expect(engine.detectIntent('كيفاش نزرع البطاطا')).toBe('unknown');
  });
});

describe('responseEngine.findProductByName', () => {
  test('يجد المنتج بمطابقة تقريبية للاسم', () => {
    const products = [{ id: '1', name: 'سماعات M10' }, { id: '2', name: 'ساعة ذكية' }];
    const found = engine.findProductByName('عندكم سماعات M10؟', products);
    expect(found.id).toBe('1');
  });
});
