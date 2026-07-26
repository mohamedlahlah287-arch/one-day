// حالات الشحنة الموحّدة (بغض النظر عن شركة التوصيل). كل Adapter (Yalidine, ZR Express...)
// يترجم حالته الخاصة إلى واحدة من هذه الحالات الموحدة عبر mapStatus()، وبقية النظام
// (الإشعارات، صفحة التتبع، تصدير Excel) يتعامل فقط مع هذه القيم الثابتة.

const SHIPMENT_STATUS = {
  CREATED: 'created', // تم إنشاء الشحنة
  RECEIVED_BY_CARRIER: 'received_by_carrier', // المندوب/المركز استلمها
  IN_TRANSIT: 'in_transit', // في الطريق بين الولايات
  OUT_FOR_DELIVERY: 'out_for_delivery', // خرج للتوزيع اليوم
  DELIVERED: 'delivered', // تم التسليم
  CUSTOMER_REFUSED: 'customer_refused', // رفض الزبون
  RETURNED_TO_STORE: 'returned_to_store', // راجع للتاجر
  CANCELLED: 'cancelled', // ألغيت الشحنة
};

// رسالة تلقائية تُرسل للزبون عند كل تغيير حالة (المتطلب #4)
const SHIPMENT_STATUS_CUSTOMER_MESSAGE = {
  [SHIPMENT_STATUS.CREATED]: '📦 تم تجهيز طلبك وجارٍ تسليمه لشركة الشحن.',
  [SHIPMENT_STATUS.RECEIVED_BY_CARRIER]: '🚚 تم استلام طلبك من طرف شركة التوصيل.',
  [SHIPMENT_STATUS.IN_TRANSIT]: '📍 طلبك في الطريق.',
  [SHIPMENT_STATUS.OUT_FOR_DELIVERY]: '🚛 خرج المندوب لتوصيل طلبك اليوم.',
  [SHIPMENT_STATUS.DELIVERED]: '✅ تم تسليم طلبك بنجاح. شكرًا لثقتك بنا!',
  [SHIPMENT_STATUS.CUSTOMER_REFUSED]: '❌ تعذّر تسليم طلبك.',
  [SHIPMENT_STATUS.RETURNED_TO_STORE]: '↩️ تم إرجاع طلبك إلى المتجر.',
  [SHIPMENT_STATUS.CANCELLED]: '⚠️ تم إلغاء شحنة طلبك.',
};

// عنوان مختصر لكل حالة (يُستعمل فـ لوحة التحكم وصفحة التتبع بدل عرض المفتاح التقني)
const SHIPMENT_STATUS_LABEL_AR = {
  [SHIPMENT_STATUS.CREATED]: 'تم إنشاء الشحنة',
  [SHIPMENT_STATUS.RECEIVED_BY_CARRIER]: 'استلمها المندوب',
  [SHIPMENT_STATUS.IN_TRANSIT]: 'في الطريق',
  [SHIPMENT_STATUS.OUT_FOR_DELIVERY]: 'خرج للتوزيع',
  [SHIPMENT_STATUS.DELIVERED]: 'تم التسليم',
  [SHIPMENT_STATUS.CUSTOMER_REFUSED]: 'رفض الزبون',
  [SHIPMENT_STATUS.RETURNED_TO_STORE]: 'راجع للتاجر',
  [SHIPMENT_STATUS.CANCELLED]: 'ملغاة',
};

module.exports = { SHIPMENT_STATUS, SHIPMENT_STATUS_CUSTOMER_MESSAGE, SHIPMENT_STATUS_LABEL_AR };
