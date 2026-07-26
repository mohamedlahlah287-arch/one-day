// سجل مركزي لكل شركات التوصيل المدعومة. أي شركة جديدة تُضاف هنا فقط (اسمها، الحقول
// المطلوبة للربط، وهل هي مُفعّلة فعليًا أو "قريبًا"). الواجهة (إعدادات المتجر > شركات
// التوصيل) تُبنى ديناميكيًا من هذا الملف، وDeliveryProviderFactory يقرأ منه أيضًا.

const DELIVERY_PROVIDERS = {
  yalidine: {
    id: 'yalidine',
    name: 'Yalidine',
    logo: '/assets/delivery/yalidine.png',
    enabled: true, // مُنفَّذ فعليًا (إجباري حسب المتطلبات)
    // الحقول التي يُدخلها التاجر عند الربط - تُعرض كنموذج فـ لوحة التحكم
    credentialFields: [
      { key: 'apiId', label: 'API ID', type: 'text', required: true },
      { key: 'apiToken', label: 'API Token', type: 'password', required: true },
    ],
  },
  zrexpress: {
    id: 'zrexpress',
    name: 'ZR Express',
    logo: '/assets/delivery/zrexpress.png',
    enabled: false, // الواجهة تظهر ("قريبًا") لكن التنفيذ غير جاهز بعد
    credentialFields: [
      { key: 'token', label: 'Token', type: 'text', required: true },
      { key: 'key', label: 'Key', type: 'password', required: true },
    ],
  },
  maystro: {
    id: 'maystro',
    name: 'Maystro Delivery',
    logo: '/assets/delivery/maystro.png',
    enabled: false,
    credentialFields: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true }],
  },
  noest: {
    id: 'noest',
    name: 'Noest Express',
    logo: '/assets/delivery/noest.png',
    enabled: false,
    credentialFields: [
      { key: 'apiToken', label: 'API Token', type: 'password', required: true },
      { key: 'guid', label: 'GUID', type: 'text', required: true },
    ],
  },
};

// قائمة مرتّبة (للعرض فـ الواجهة بترتيب ثابت)
const DELIVERY_PROVIDER_LIST = Object.values(DELIVERY_PROVIDERS);

function getProviderMeta(providerId) {
  return DELIVERY_PROVIDERS[providerId] || null;
}

module.exports = { DELIVERY_PROVIDERS, DELIVERY_PROVIDER_LIST, getProviderMeta };
