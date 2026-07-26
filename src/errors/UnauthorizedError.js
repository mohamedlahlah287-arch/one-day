const AppError = require('./AppError');

class UnauthorizedError extends AppError {
  constructor(message = 'غير مصرح لك بهذا الإجراء') {
    super(message, 403, true);
  }
}

module.exports = UnauthorizedError;
