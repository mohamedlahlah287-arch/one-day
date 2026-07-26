const { ValidationError } = require('../errors');

function validatePrice(text) {
  const price = Number(String(text).trim());
  if (Number.isNaN(price) || price <= 0) {
    throw new ValidationError('السعر يجب أن يكون رقمًا أكبر من صفر', ['price']);
  }
  return price;
}

function validateProductName(text) {
  const name = String(text || '').trim();
  if (name.length < 2 || name.length > 100) {
    throw new ValidationError('اسم المنتج غير صحيح (بين 2 و 100 حرف)', ['name']);
  }
  return name;
}

module.exports = { validatePrice, validateProductName };
