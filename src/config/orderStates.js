// خطوات تعبئة الطلب (بوت الزبائن فيسبوك) - ملف مشترك بلا اعتماد دائري بين orderController
// و FacebookSessionRepository/جوب متابعة السلة المتروكة.
const ORDER_STEPS = [
  'AWAITING_NAME',
  'AWAITING_PHONE',
  'AWAITING_WILAYA',
  'AWAITING_COMMUNE',
  'AWAITING_ADDRESS',
  'AWAITING_TIME',
  'AWAITING_NOTE',
  'AWAITING_COUPON',
  'AWAITING_CONFIRM',
];

module.exports = { ORDER_STEPS };
