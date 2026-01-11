

// custom API error class
export class APIError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.name = 'APIError';
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

// error response formatter
export const formatErrorResponse = (error) => {
  if (error instanceof APIError) {
    return {
      success: false,
      error: error.message,
      details: error.details,
      statusCode: error.statusCode,
    };
  }

  // Mongoose validation error
  if (error.name === 'ValidationError') {
    const errors = Object.values(error.errors).map(err => err.message);
    return {
      success: false,
      error: 'Validation failed',
      details: errors,
      statusCode: 400,
    };
  }

  // Mongoose duplicate key error
  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern)[0];
    return {
      success: false,
      error: `${field} already exists`,
      details: `Duplicate ${field} value`,
      statusCode: 409,
    };
  }

  // Mongoose cast error (invalid ObjectId)
  if (error.name === 'CastError') {
    return {
      success: false,
      error: 'Invalid ID format',
      details: error.message,
      statusCode: 400,
    };
  }

  // Default error
  return {
    success: false,
    error: error.message || 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    statusCode: 500,
  };
};

// async error handler wrapper
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

