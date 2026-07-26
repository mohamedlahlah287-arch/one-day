class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true, meta = {}) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    // isOperational = true يعني خطأ متوقع (مثال: بيانات ناقصة) وليس خطأ برمجي حقيقي
    this.isOperational = isOperational;
    this.meta = meta;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
