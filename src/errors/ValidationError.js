const AppError = require('./AppError');

class ValidationError extends AppError {
  constructor(message = 'بيانات غير صحيحة', details = []) {
    super(message, 400, true, { details });
    this.details = details; // قائمة الأخطاء التفصيلية لكل حقل
  }
}

module.exports = ValidationError;
