// Base application error. Extend or instantiate this instead of throwing raw
// strings/native Errors so the global error handler can map failures to HTTP
// responses. See docs/error-handling.md.
class AppError extends Error {
  constructor(message, statusCode = 500, { cause, data } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.data = data;
    if (Error.captureStackTrace) Error.captureStackTrace(this, AppError);
  }
}

module.exports = { AppError };
