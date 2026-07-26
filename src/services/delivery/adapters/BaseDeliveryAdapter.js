// العقد المشترك بين كل Adapter لشركة توصيل. أي شركة جديدة (ZR Express, Maystro, Noest...)
// تُنفَّذ بإنشاء class يرث من هذا الملف ويطبّق نفس الدوال، وDeliveryService يبقى بلا أي
// تعديل (Strategy pattern) - هذا ما يجعل إضافة شركة توصيل جديدة مستقبلًا بسيطة وآمنة.
class BaseDeliveryAdapter {
  constructor(credentials) {
    this.credentials = credentials || {};
  }

  // يتأكد أن بيانات الاعتماد صحيحة فعليًا عبر استدعاء بسيط لـ API الشركة.
  // يُرجع: { ok: boolean, message: string }
  // eslint-disable-next-line no-unused-vars
  async testConnection() {
    throw new Error('testConnection غير منفذة فـ هذا الـ Adapter');
  }

  // ينشئ شحنة جديدة عند شركة التوصيل انطلاقًا من بيانات طلب داخلي موحّدة.
  // orderData: { orderId, name, phone, wilaya, commune, address, productName, price, notes }
  // يُرجع: { shipmentId, trackingNumber, trackingUrl, raw }
  // eslint-disable-next-line no-unused-vars
  async createShipment(orderData) {
    throw new Error('createShipment غير منفذة فـ هذا الـ Adapter');
  }

  // يجيب آخر حالة لشحنة معينة عند شركة التوصيل.
  // يُرجع: { status (من SHIPMENT_STATUS الموحّدة), rawStatus, trackingUrl, history: [] }
  // eslint-disable-next-line no-unused-vars
  async getShipmentStatus(trackingNumber) {
    throw new Error('getShipmentStatus غير منفذة فـ هذا الـ Adapter');
  }
}

module.exports = BaseDeliveryAdapter;
