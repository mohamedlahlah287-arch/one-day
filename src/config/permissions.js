// تعريف كل الصلاحيات الممكنة لأعضاء فريق المتجر (الموظفين الذين يضيفهم صاحب المتجر).
// صاحب المتجر (owner) عندو دائمًا صلاحية 'ALL' ولا يحتاج أن تُدرج له صراحة.

const PERMISSIONS = {
  ALL: 'ALL', // كل الصلاحيات (مخصص لصاحب المتجر فقط عادةً)
  VIEW_ORDERS: 'VIEW_ORDERS', // مشاهدة قائمة الطلبات
  MANAGE_ORDERS: 'MANAGE_ORDERS', // تحديث حالة الطلبات (تأكيد/شحن/تسليم/إلغاء)
  VIEW_STATS: 'VIEW_STATS', // مشاهدة الإحصائيات
  MANAGE_PRODUCTS: 'MANAGE_PRODUCTS', // إضافة/حذف المنتجات
  MANAGE_SETTINGS: 'MANAGE_SETTINGS', // تعديل إعدادات المتجر (الاسم، رسالة الترحيب...)
};

// تسميات عربية تُعرض للمستخدم عند اختيار الصلاحيات
const PERMISSION_LABELS = {
  [PERMISSIONS.VIEW_ORDERS]: '📋 مشاهدة الطلبات',
  [PERMISSIONS.MANAGE_ORDERS]: '✅ تحديث حالة الطلبات',
  [PERMISSIONS.VIEW_STATS]: '📊 مشاهدة الإحصائيات',
  [PERMISSIONS.MANAGE_PRODUCTS]: '📦 إضافة وحذف المنتجات',
  [PERMISSIONS.MANAGE_SETTINGS]: '⚙️ تعديل إعدادات المتجر',
};

// حزم جاهزة (roles) تسهّل الإضافة السريعة بدل اختيار كل صلاحية يدويًا
const PRESET_ROLES = {
  '👑 صلاحيات كاملة (كل شيء)': [PERMISSIONS.ALL],
  '📋 مسؤول طلبات (مشاهدة + تحديث الحالة)': [PERMISSIONS.VIEW_ORDERS, PERMISSIONS.MANAGE_ORDERS],
  '📦 مسؤول منتجات (إضافة وحذف)': [PERMISSIONS.MANAGE_PRODUCTS],
  '👀 مشاهدة فقط (طلبات + إحصائيات)': [PERMISSIONS.VIEW_ORDERS, PERMISSIONS.VIEW_STATS],
};

const CUSTOM_PERMISSION_LIST = Object.values(PERMISSIONS).filter((p) => p !== PERMISSIONS.ALL);

function hasPermission(permissions, permission) {
  if (!Array.isArray(permissions)) return false;
  return permissions.includes(PERMISSIONS.ALL) || permissions.includes(permission);
}

module.exports = { PERMISSIONS, PERMISSION_LABELS, PRESET_ROLES, CUSTOM_PERMISSION_LIST, hasPermission };
