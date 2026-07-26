// تعريف مركزي لبرنامج الإحالة (كود دعوة لكل تاجر + عمولات + سحب الرصيد).
// أي تعديل على النسب/الحد الأدنى للسحب يكون من هنا فقط.

const MIN_WITHDRAWAL_AMOUNT = 5000; // دج - الحد الأدنى لطلب السحب

const WITHDRAWAL_METHODS = ['ccp', 'baridimob'];

// شرائح العمولة حسب "رقم الدفعة" التي دفعها التاجر المدعو (1 = أول اشتراك مدفوع، 2..12 = الأشهر
// الموالية، وما فوق 12 = بدون عمولة). نعتمد على "رقم الدفعة" بدل التاريخ الفعلي حتى تبقى النتيجة
// صحيحة مهما كانت مدة الباقة (شهرية/سنوية...) أو لو تأخر التاجر فـ الدفع لبعض الوقت.
const COMMISSION_TIERS = [
  { fromPayment: 1, toPayment: 1, percent: 30 }, // الشهر 1 (أول اشتراك مدفوع)
  { fromPayment: 2, toPayment: 12, percent: 20 }, // الأشهر 2 إلى 12
];

// يرجع نسبة العمولة المطابقة لرقم دفعة معين، أو 0 إذا تجاوز 12 دفعة
function getCommissionPercent(paymentNumber) {
  const tier = COMMISSION_TIERS.find((t) => paymentNumber >= t.fromPayment && paymentNumber <= t.toPayment);
  return tier ? tier.percent : 0;
}

module.exports = {
  MIN_WITHDRAWAL_AMOUNT,
  WITHDRAWAL_METHODS,
  COMMISSION_TIERS,
  getCommissionPercent,
};
