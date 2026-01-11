// Error handling middleware

import { formatErrorResponse } from '../utils/errors.js';

// global error handler middleware
export const errorHandler = (err, req, res, next) => {
  const errorResponse = formatErrorResponse(err);
  
  console.error('Error:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    url: req.url,
    method: req.method,
  });

  return res.status(errorResponse.statusCode || 500).json(errorResponse);
};

// 404 Not Found handler
export const notFoundHandler = (req, res, next) => {
  return res.status(404).json({
    success: false,
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.path}`,
  });
};

