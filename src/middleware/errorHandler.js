const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Default error
  let error = { ...err };
  error.message = err.message;

  // SQLite constraint errors
  if (err.code === 'SQLITE_CONSTRAINT') {
    const message = 'Database constraint error';
    error = { message, statusCode: 400 };
  }

  // SQLite busy errors
  if (err.code === 'SQLITE_BUSY') {
    const message = 'Database is busy, please try again';
    error = { message, statusCode: 503 };
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = { message, statusCode: 400 };
  }

  res.status(error.statusCode || 500).json({
    success: false,
    error: error.message || 'Server Error'
  });
};

module.exports = errorHandler;