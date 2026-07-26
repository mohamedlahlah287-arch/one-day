const ExcelJS = require('exceljs');
const OrderRepository = require('../repositories/OrderRepository');

// ExcelExportService: تصدير احترافي للطلبات (المتطلب #6). ملاحظة صريحة: نظام الحالات
// الحالي فـ المشروع يحتوي 5 حالات فقط (جديد/تم التأكيد/تم الشحن/تم التسليم/ملغى) + حالة
// شحن منفصلة من شركة التوصيل (SHIPMENT_STATUS). لذلك "قيد التجهيز" و"غير مقروءة" (من الخطة
// الأصلية) غير متاحين حاليًا كحقلين حقيقيين فـ قاعدة البيانات - تصفية بهما ستحتاج أولاً
// إضافة حالة "قيد التجهيز" لدورة حياة الطلب، أو حقل "seen" منفصل. تُركا خارج القائمة أدناه
// عمدًا بدل تزييف تصفية لا تُطابق شيئًا فعليًا.
const STATUS_GROUPS = {
  all: null,
  new: 'جديد',
  confirmed: 'تم التأكيد',
  shipped: 'تم الشحن',
  delivered: 'تم التسليم',
  cancelled: 'ملغى',
};

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function resolveDateRange(dateRange, customFrom, customTo) {
  const now = new Date();
  const today = startOfDay(now);
  switch (dateRange) {
    case 'today':
      return { from: today, to: new Date(today.getTime() + 24 * 60 * 60 * 1000) };
    case 'yesterday': {
      const y = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      return { from: y, to: today };
    }
    case 'last7':
      return { from: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000), to: null };
    case 'last30':
      return { from: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000), to: null };
    case 'thisMonth':
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: null };
    case 'lastMonth':
      return { from: new Date(now.getFullYear(), now.getMonth() - 1, 1), to: new Date(now.getFullYear(), now.getMonth(), 1) };
    case 'custom':
      return { from: customFrom ? new Date(customFrom) : null, to: customTo ? new Date(new Date(customTo).getTime() + 24 * 60 * 60 * 1000) : null };
    default:
      return { from: null, to: null };
  }
}

function orderDate(o) {
  if (!o.createdAt) return null;
  return o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
}

const SHIPMENT_STATUS_LABEL_AR = {
  created: 'تم إنشاء الشحنة', received_by_carrier: 'استلمها المندوب', in_transit: 'في الطريق',
  out_for_delivery: 'خرج للتوزيع', delivered: 'تم التسليم', customer_refused: 'رفض الزبون',
  returned_to_store: 'راجع للتاجر', cancelled: 'ملغاة',
};

class ExcelExportService {
  async buildOrdersWorkbook(storeId, filters = {}) {
    const orders = await OrderRepository.findAll(storeId, { limit: 5000 });

    const statusValue = STATUS_GROUPS[filters.statusGroup] ?? undefined;
    const { from, to } = resolveDateRange(filters.dateRange, filters.dateFrom, filters.dateTo);

    const filtered = orders.filter((o) => {
      if (statusValue && o.status !== statusValue) return false;
      if (from || to) {
        const d = orderDate(o);
        if (!d) return false;
        if (from && d < from) return false;
        if (to && d >= to) return false;
      }
      if (filters.wilaya && o.wilaya !== filters.wilaya) return false;
      if (filters.product && o.productName !== filters.product) return false;
      if (filters.deliveryProvider && o.shipmentProvider !== filters.deliveryProvider) return false;
      return true;
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'RedonBot';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('الطلبات', { views: [{ rightToLeft: true }] });

    const columns = [
      { header: 'رقم الطلب', key: 'id', width: 14 },
      { header: 'اسم الزبون', key: 'name', width: 20 },
      { header: 'الهاتف', key: 'phone', width: 16 },
      { header: 'الولاية', key: 'wilaya', width: 14 },
      { header: 'البلدية', key: 'commune', width: 16 },
      { header: 'العنوان', key: 'address', width: 26 },
      { header: 'المنتج', key: 'productName', width: 20 },
      { header: 'الكمية', key: 'quantity', width: 9 },
      { header: 'السعر', key: 'price', width: 12 },
      { header: 'الإجمالي', key: 'total', width: 12 },
      { header: 'الخصم', key: 'discount', width: 10 },
      { header: 'شركة التوصيل', key: 'shipmentProvider', width: 14 },
      { header: 'رقم التتبع', key: 'shipmentTrackingNumber', width: 16 },
      { header: 'حالة الشحنة', key: 'shipmentStatusLabel', width: 14 },
      { header: 'حالة الطلب', key: 'status', width: 12 },
      { header: 'تاريخ الإنشاء', key: 'createdAtLabel', width: 18 },
      { header: 'الملاحظات', key: 'notes', width: 24 },
    ];
    sheet.columns = columns;

    // تنسيق احترافي للعناوين (المتطلب: "تنسيق احترافي للعناوين والخلايا")
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 22;

    filtered.forEach((o) => {
      const d = orderDate(o);
      sheet.addRow({
        id: o.id,
        name: o.name,
        phone: o.phone,
        wilaya: o.wilaya,
        commune: o.commune,
        address: o.address,
        productName: o.productName,
        quantity: o.quantity || 1,
        price: o.price,
        total: o.total,
        discount: o.discount || 0,
        shipmentProvider: o.shipmentProvider || '—',
        shipmentTrackingNumber: o.shipmentTrackingNumber || '—',
        shipmentStatusLabel: SHIPMENT_STATUS_LABEL_AR[o.shipmentStatus] || '—',
        status: o.status,
        createdAtLabel: d ? d.toLocaleString('ar-DZ') : '—',
        notes: o.notes || '',
      });
    });

    // حدود خفيفة لكل الخلايا + محاذاة وسط للأرقام
    sheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        };
      });
      if (rowNumber > 1) row.alignment = { vertical: 'middle' };
    });
    sheet.autoFilter = { from: 'A1', to: `Q1` };

    return { buffer: await workbook.xlsx.writeBuffer(), count: filtered.length };
  }
}

module.exports = new ExcelExportService();
