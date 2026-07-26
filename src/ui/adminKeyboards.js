const { Markup } = require('telegraf');

const mainMenu = Markup.keyboard([
  ['📦 المنتجات', '📋 الطلبات'],
  ['📊 الإحصائيات', '⚙️ الإعدادات'],
  ['🔗 رابط متجرك للزبائن', '👥 فريق العمل'],
  ['💳 الاشتراك والدفع', '🎟️ استعمال كود عرض'],
]).resize();

const staffMenu = Markup.keyboard([
  ['➕ إضافة عضو', '👥 قائمة الفريق'],
  ['🗑 حذف عضو'],
  ['⬅️ رجوع للقائمة الرئيسية'],
]).resize();

const productsMenu = Markup.keyboard([
  ['➕ إضافة منتج', '📂 كل المنتجات'],
  ['🎙️ صوت شرح لمنتج', '🗑 حذف منتج'],
  ['⬅️ رجوع للقائمة الرئيسية'],
]).resize();

const settingsMenu = Markup.keyboard([
  ['✏️ اسم المتجر', '✏️ رسالة الترحيب'],
  ['✏️ رقم التواصل', '✏️ مدة التوصيل'],
  ['📘 ربط صفحة فيسبوك الخاصة بي'],
  ['🔔 تأكيد الطلب للزبون'],
  ['🎙️ رسائل صوتية عامة'],
  ['⬅️ رجوع للقائمة الرئيسية'],
]).resize();

const cancelKeyboard = Markup.keyboard([['❌ إلغاء']]).resize();

// showConfirm: يظهر زر "تم التأكيد" فقط إذا كان المتجر مفعّل فيه "تأكيد الطلب للزبون" من الإعدادات.
// إذا كان معطّلاً، الطلب يظهر مباشرة والتاجر يجهزه بلا حاجة لتأكيده أولاً.
function orderStatusInline(orderId, showConfirm = true) {
  const firstRow = showConfirm
    ? [
        Markup.button.callback('✅ تم التأكيد', `order_confirm_${orderId}`),
        Markup.button.callback('🚚 تم الشحن', `order_shipped_${orderId}`),
      ]
    : [Markup.button.callback('🚚 تم الشحن', `order_shipped_${orderId}`)];

  return Markup.inlineKeyboard([
    firstRow,
    [
      Markup.button.callback('📦 تم التسليم', `order_delivered_${orderId}`),
      Markup.button.callback('❌ إلغاء', `order_cancel_${orderId}`),
    ],
  ]);
}

module.exports = { mainMenu, productsMenu, settingsMenu, staffMenu, cancelKeyboard, orderStatusInline };
