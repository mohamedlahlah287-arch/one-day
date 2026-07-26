const BaseDeliveryAdapter = require('./BaseDeliveryAdapter');
const { SHIPMENT_STATUS } = require('../../../config/shipmentStatuses');
const logger = require('../../../utils/logger');

// تكامل حقيقي مع Yalidine API v1 (https://yalidine.app - "الحساب فـ إعدادات المطوّر" يعطيك
// API ID + API Token). التوثيق الرسمي محمي بتسجيل دخول، لذلك تأكد من مطابقة أسماء الحقول
// أدناه مع لوحة Yalidine الخاصة بك قبل الإطلاق الفعلي (خصوصًا حقول الأبعاد/الوزن إذا فعّلتها).
const BASE_URL = 'https://api.yalidine.app/v1';

// يترجم حالة Yalidine الخام (last_status) إلى حالتنا الموحّدة. القيم أدناه هي الحالات
// المعروفة والموثّقة من Yalidine؛ إذا رجعت حالة غير موجودة هنا نُبقيها IN_TRANSIT كافتراضي آمن.
const RAW_STATUS_MAP = {
  'Pas encore expédié': SHIPMENT_STATUS.CREATED,
  'A vérifier': SHIPMENT_STATUS.CREATED,
  'En préparation': SHIPMENT_STATUS.CREATED,
  'Pas encore ramassé': SHIPMENT_STATUS.CREATED,
  'Prêt à expédier': SHIPMENT_STATUS.CREATED,
  'Ramassé': SHIPMENT_STATUS.RECEIVED_BY_CARRIER,
  'Au centre': SHIPMENT_STATUS.IN_TRANSIT,
  'Débarqué': SHIPMENT_STATUS.IN_TRANSIT,
  'Vers Wilaya': SHIPMENT_STATUS.IN_TRANSIT,
  'Reçu à Wilaya': SHIPMENT_STATUS.IN_TRANSIT,
  'En attente du client': SHIPMENT_STATUS.OUT_FOR_DELIVERY,
  'Sorti en livraison': SHIPMENT_STATUS.OUT_FOR_DELIVERY,
  'En cours de livraison': SHIPMENT_STATUS.OUT_FOR_DELIVERY,
  'Livré': SHIPMENT_STATUS.DELIVERED,
  'Livré payé': SHIPMENT_STATUS.DELIVERED,
  'Echèc livraison': SHIPMENT_STATUS.CUSTOMER_REFUSED,
  'Retour vers vendeur': SHIPMENT_STATUS.RETURNED_TO_STORE,
  'Retourné au vendeur': SHIPMENT_STATUS.RETURNED_TO_STORE,
  'Annulé': SHIPMENT_STATUS.CANCELLED,
};

function mapRawStatus(rawStatus) {
  return RAW_STATUS_MAP[rawStatus] || SHIPMENT_STATUS.IN_TRANSIT;
}

class YalidineAdapter extends BaseDeliveryAdapter {
  headers() {
    return {
      'X-API-ID': this.credentials.apiId,
      'X-API-TOKEN': this.credentials.apiToken,
      'Content-Type': 'application/json',
    };
  }

  async testConnection() {
    if (!this.credentials.apiId || !this.credentials.apiToken) {
      return { ok: false, message: 'API ID و API Token مطلوبان' };
    }
    try {
      const res = await fetch(`${BASE_URL}/wilayas?page_size=1`, { headers: this.headers() });
      if (res.status === 401 || res.status === 403) {
        return { ok: false, message: 'بيانات الاعتماد غير صحيحة (تحقق من API ID و API Token)' };
      }
      if (!res.ok) {
        return { ok: false, message: `تعذّر الاتصال بـ Yalidine (رمز الخطأ ${res.status})` };
      }
      return { ok: true, message: 'الاتصال بـ Yalidine ناجح ✅' };
    } catch (err) {
      logger.error('YalidineAdapter.testConnection: فشل الاتصال', { error: err.message });
      return { ok: false, message: 'تعذّر الوصول إلى خوادم Yalidine، حاول لاحقًا' };
    }
  }

  async createShipment(orderData) {
    const nameParts = String(orderData.name || '').trim().split(/\s+/);
    const firstname = nameParts[0] || orderData.name || 'زبون';
    const familyname = nameParts.slice(1).join(' ') || '-';

    const payload = [
      {
        order_id: String(orderData.orderId),
        from_wilaya_name: orderData.fromWilaya || undefined,
        firstname,
        familyname,
        contact_phone: orderData.phone,
        address: orderData.address,
        to_commune_name: orderData.commune,
        to_wilaya_name: orderData.wilaya,
        product_list: orderData.productName,
        price: Math.round(Number(orderData.price) || 0),
        is_stopdesk: false,
        freeshipping: false,
        has_exchange: false,
      },
    ];

    const res = await fetch(`${BASE_URL}/parcels`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      logger.error('YalidineAdapter.createShipment: فشل الإنشاء', { status: res.status, data });
      throw new Error(data?.message || 'فشل إنشاء الشحنة عند Yalidine');
    }

    const result = data[String(orderData.orderId)];
    if (!result || !result.success) {
      throw new Error(result?.message || 'رفضت Yalidine إنشاء الشحنة (تحقق من صحة الولاية/البلدية)');
    }

    return {
      shipmentId: result.tracking,
      trackingNumber: result.tracking,
      trackingUrl: `https://yalidine.com/track/${result.tracking}`,
      raw: result,
    };
  }

  async getShipmentStatus(trackingNumber) {
    const res = await fetch(`${BASE_URL}/parcels/${encodeURIComponent(trackingNumber)}`, {
      headers: this.headers(),
    });
    const data = await res.json();
    if (!res.ok) {
      logger.error('YalidineAdapter.getShipmentStatus: فشل الجلب', { status: res.status, data });
      throw new Error('تعذّر جلب حالة الشحنة من Yalidine');
    }
    const parcel = Array.isArray(data?.data) ? data.data[0] : data;
    const rawStatus = parcel?.last_status || parcel?.status;

    return {
      status: mapRawStatus(rawStatus),
      rawStatus,
      trackingUrl: `https://yalidine.com/track/${trackingNumber}`,
      history: Array.isArray(parcel?.histories)
        ? parcel.histories.map((h) => ({ status: mapRawStatus(h.status), rawStatus: h.status, date: h.date }))
        : [],
    };
  }
}

module.exports = YalidineAdapter;
