const AppError = require('./AppError');

class NotFoundError extends AppError {
  constructor(resource = 'العنصر', meta = {}) {
    super(`${resource} غير موجود`, 404, true, meta);
  }
}

module.exports = NotFoundError;
