const { ValidationError } = require('../errors');

// تحقق بسيط من رقم هاتف جزائري (يبدأ بـ 0 ويحتوي 9-10 أرقام)
const PHONE_REGEX = /^0[5-7][0-9]{8}$/;

function validatePhone(text) {
  const phone = String(text || '').trim().replace(/\s|-/g, '');
  if (!PHONE_REGEX.test(phone)) {
    throw new ValidationError('رقم الهاتف غير صحيح. مثال صحيح: 0555123456', ['phone']);
  }
  return phone;
}

function validateNonEmptyText(text, fieldName, maxLength = 200) {
  const value = String(text || '').trim();
  if (!value) throw new ValidationError(`${fieldName} مطلوب`, [fieldName]);
  if (value.length > maxLength) throw new ValidationError(`${fieldName} طويل جدًا`, [fieldName]);
  return value;
}

function validateQuantity(text) {
  const value = parseInt(String(text || '').trim(), 10);
  if (!Number.isInteger(value) || value < 1 || value > 999) {
    throw new ValidationError('الكمية غير صحيحة. اكتب رقم صحيح (مثال: 1 أو 2).', ['quantity']);
  }
  return value;
}

module.exports = { validatePhone, validateNonEmptyText, validateQuantity };
