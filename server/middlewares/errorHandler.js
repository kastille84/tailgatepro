// Global error-handling middleware. Bind last, after all routes. Emits the
// documented response envelope { success: false, error }. 5xx errors are logged
// and their messages masked; 4xx pass the message (and any validation `data`)
// through to the client.
const errorHandler = (error, req, res, next) => {
  const statusCode = error.statusCode || 500;

  if (statusCode >= 500) {
    console.error("[error]", error);
  }

  return res.status(statusCode).json({
    success: false,
    error: statusCode >= 500 ? "Something went wrong." : error.message,
    ...(error.data ? { data: error.data } : {}),
  });
};

module.exports = { errorHandler };
