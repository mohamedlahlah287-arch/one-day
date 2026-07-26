const { getProviderMeta } = require('../../config/deliveryProviders');
const YalidineAdapter = require('./adapters/YalidineAdapter');

// خريطة provider id -> class الـ Adapter. إضافة شركة توصيل جديدة مستقبلًا = سطر واحد هنا
// + ملف Adapter جديد (بعد تفعيلها فـ src/config/deliveryProviders.js)
const ADAPTERS = {
  yalidine: YalidineAdapter,
};

function createAdapter(providerId, credentials) {
  const meta = getProviderMeta(providerId);
  if (!meta) throw new Error(`شركة توصيل غير معروفة: ${providerId}`);
  if (!meta.enabled || !ADAPTERS[providerId]) {
    throw new Error(`شركة "${meta.name}" غير متاحة بعد - قريبًا`);
  }
  const AdapterClass = ADAPTERS[providerId];
  return new AdapterClass(credentials);
}

module.exports = { createAdapter };
