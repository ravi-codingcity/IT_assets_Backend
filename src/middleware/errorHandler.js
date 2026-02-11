module.exports = (err, req, res, next) => {
  let status = err.statusCode || 500;
  let message = err.message || 'Server Error';

  // Mongoose errors
  if (err.name === 'CastError') { status = 400; message = 'Invalid ID format'; }
  if (err.code === 11000) { status = 409; message = `Duplicate: ${Object.keys(err.keyValue)[0]}`; }
  if (err.name === 'ValidationError') { status = 400; message = Object.values(err.errors).map(e => e.message).join(', '); }

  res.status(status).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};
