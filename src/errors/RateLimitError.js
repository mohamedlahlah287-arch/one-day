const AppError = require('./AppError');

class RateLimitError extends AppError {
  constructor(message = 'طلبات كثيرة جدًا، من فضلك انتظر قليلاً') {
    super(message, 429, true);
  }
}

module.exports = RateLimitError;
