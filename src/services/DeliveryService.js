const StoreRepository = require('../repositories/StoreRepository');
const OrderRepository = require('../repositories/OrderRepository');
const { DELIVERY_PROVIDER_LIST, getProviderMeta } = require('../config/deliveryProviders');
const { SHIPMENT_STATUS } = require('../config/shipmentStatuses');
const { createAdapter } = require('./delivery/DeliveryProviderFactory');
const eventBus = require('../events/eventBus');
const events = require('../events/eventNames');
const { ValidationError, NotFoundError } = require('../errors');
const logger = require('../utils/logger');

const TERMINAL_STATUSES = [
  SHIPMENT_STATUS.DELIVERED,
  SHIPMENT_STATUS.RETURNED_TO_STORE,
  SHIPMENT_STATUS.CANCELLED,
];

class DeliveryService {
  // يُرجع قائمة كل شركات التوصيل مع حالة الربط الخاصة بهذا المتجر (بدون كشف API Token)
  async listProviders(storeId) {
    const store = await StoreRepository.findByIdOrFail(storeId);
    const connected = store.deliveryProviders || {};
    return DELIVERY_PROVIDER_LIST.map((meta) => {
      const saved = connected[meta.id];
      return {
        id: meta.id,
        name: meta.name,
        logo: meta.logo,
        enabled: meta.enabled,
        credentialFields: meta.credentialFields,
        connected: Boolean(saved?.connected),
        lastTestOk: saved?.lastTestOk ?? null,
        lastTestAt: saved?.lastTestAt ?? null,
        connectedAt: saved?.connectedAt ?? null,
      };
    });
  }

  // يختبر بيانات اعتماد (سواء محفوظة مسبقًا أو جديدة قبل حفظها) بدون تخزين شيء
  async testConnection(storeId, providerId, credentials) {
    const meta = getProviderMeta(providerId);
    if (!meta || !meta.enabled) throw new ValidationError(`شركة التوصيل "${providerId}" غير متاحة بعد`);
    const adapter = createAdapter(providerId, credentials);
    return adapter.testConnection();
  }

  // يربط حساب شركة توصيل بالمتجر: يختبر الاتصال أولًا، ولا يحفظ شيئًا إذا فشل
  async connectProvider(storeId, providerId, credentials) {
    const meta = getProviderMeta(providerId);
    if (!meta) throw new ValidationError('شركة توصيل غير معروفة');
    if (!meta.enabled) throw new ValidationError(`شركة "${meta.name}" غير متاحة بعد - قريبًا`);

    const missing = meta.credentialFields.filter((f) => f.required && !credentials?.[f.key]);
    if (missing.length) {
      throw new ValidationError('بيانات الربط ناقصة', missing.map((f) => f.key));
    }

    const test = await this.testConnection(storeId, providerId, credentials);
    if (!test.ok) {
      throw new ValidationError(test.message || 'فشل التحقق من بيانات الربط');
    }

    await StoreRepository.saveDeliveryProvider(storeId, providerId, {
      credentials,
      connected: true,
      lastTestOk: true,
      lastTestAt: new Date().toISOString(),
      connectedAt: new Date().toISOString(),
    });
    logger.info('تم ربط شركة توصيل بنجاح', { storeId, providerId });
    return { ok: true, message: test.message };
  }

  async disconnectProvider(storeId, providerId) {
    await StoreRepository.removeDeliveryProvider(storeId, providerId);
    logger.info('تم فك ربط شركة توصيل', { storeId, providerId });
    return true;
  }

  // يجيب Adapter جاهز لمتجر معيّن انطلاقًا من بياناته المحفوظة (يُستعمل داخليًا فقط)
  async _getAdapterForStore(storeId, providerId) {
    const store = await StoreRepository.findByIdOrFail(storeId);
    const saved = store.deliveryProviders?.[providerId];
    if (!saved || !saved.connected) {
      throw new ValidationError(`المتجر غير مربوط بشركة "${providerId}"`);
    }
    return createAdapter(providerId, saved.credentials);
  }

  // ينشئ شحنة عند شركة التوصيل انطلاقًا من طلب موجود، ويحفظ بيانات الشحنة داخل الطلب (المتطلب #2)
  async createShipmentForOrder(storeId, orderId, providerId) {
    const order = await OrderRepository.findByIdOrFail(storeId, orderId, 'الطلب');
    if (order.shipmentTrackingNumber) {
      throw new ValidationError('هذا الطلب لديه شحنة بالفعل');
    }

    const adapter = await this._getAdapterForStore(storeId, providerId);
    const shipment = await adapter.createShipment({
      orderId: order.id,
      name: order.name,
      phone: order.phone,
      wilaya: order.wilaya,
      commune: order.commune,
      address: order.address,
      productName: order.productName,
      price: order.total ?? order.price,
      notes: order.notes,
    });

    await OrderRepository.update(storeId, orderId, {
      shipmentProvider: providerId,
      shipmentId: shipment.shipmentId,
      shipmentTrackingNumber: shipment.trackingNumber,
      shipmentTrackingUrl: shipment.trackingUrl,
      shipmentStatus: SHIPMENT_STATUS.CREATED,
      shipmentCreatedAt: new Date().toISOString(),
      shipmentHistory: [{ status: SHIPMENT_STATUS.CREATED, at: new Date().toISOString() }],
    });

    eventBus.emit(events.SHIPMENT_CREATED, { storeId, orderId, providerId, trackingNumber: shipment.trackingNumber });
    eventBus.emit(events.SHIPMENT_STATUS_CHANGED, { storeId, orderId, status: SHIPMENT_STATUS.CREATED });

    logger.info('تم إنشاء شحنة للطلب', { storeId, orderId, providerId, tracking: shipment.trackingNumber });
    return shipment;
  }

  // يسحب آخر حالة من شركة التوصيل ويحدّث الطلب إذا تغيّرت (المتطلب #3) - يُستعمل يدويًا من
  // لوحة التحكم أو دوريًا عبر src/jobs/deliveryStatusSyncJob.js
  async syncOrderStatus(storeId, orderId) {
    const order = await OrderRepository.findByIdOrFail(storeId, orderId, 'الطلب');
    if (!order.shipmentProvider || !order.shipmentTrackingNumber) {
      throw new NotFoundError('لا توجد شحنة لهذا الطلب');
    }

    const adapter = await this._getAdapterForStore(storeId, order.shipmentProvider);
    const result = await adapter.getShipmentStatus(order.shipmentTrackingNumber);

    if (result.status === order.shipmentStatus) {
      return { changed: false, status: result.status };
    }

    const history = Array.isArray(order.shipmentHistory) ? order.shipmentHistory : [];
    history.push({ status: result.status, at: new Date().toISOString() });

    await OrderRepository.update(storeId, orderId, {
      shipmentStatus: result.status,
      shipmentTrackingUrl: result.trackingUrl || order.shipmentTrackingUrl,
      shipmentHistory: history,
    });

    eventBus.emit(events.SHIPMENT_STATUS_CHANGED, { storeId, orderId, status: result.status });
    logger.info('تحديث حالة شحنة', { storeId, orderId, status: result.status });
    return { changed: true, status: result.status };
  }

  // يفحص كل الشحنات غير المنتهية عبر كل المتاجر النشطة (يُستدعى من الجدولة الدورية)
  async syncAllActiveShipmentsForStore(storeId) {
    const orders = await OrderRepository.findWithShipment(storeId);
    const active = orders.filter((o) => o.shipmentProvider && !TERMINAL_STATUSES.includes(o.shipmentStatus));
    let updated = 0;
    for (const order of active) {
      try {
        const result = await this.syncOrderStatus(storeId, order.id);
        if (result.changed) updated += 1;
      } catch (err) {
        logger.error('فشل مزامنة حالة شحنة', { storeId, orderId: order.id, error: err.message });
      }
    }
    return { checked: active.length, updated };
  }
}

module.exports = new DeliveryService();
