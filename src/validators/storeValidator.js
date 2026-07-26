const { ValidationError } = require('../errors');

function validateStoreName(name) {
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    throw new ValidationError('اسم المتجر يجب أن يكون حرفين على الأقل', ['storeName']);
  }
  if (name.trim().length > 60) {
    throw new ValidationError('اسم المتجر طويل جدًا', ['storeName']);
  }
  return name.trim();
}

module.exports = { validateStoreName };
