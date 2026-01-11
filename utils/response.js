// Response utility functions

// send success response
export const sendSuccess = (res, statusCode = 200, data = null, message = null, pagination = null) => {
  const response = {
    success: true,
  };

  if (message) {
    response.message = message;
  }

  if (data !== null) {
    response.data = data;
  }

  if (pagination) {
    response.page = pagination.page;
    response.limit = pagination.limit;
    response.total = pagination.total;
    response.totalPages = pagination.totalPages;
  }

  return res.status(statusCode).json(response);
};

// send error response
export const sendError = (res, statusCode = 500, error = 'Internal server error', details = null) => {
  const response = {
    success: false,
    error,
  };

  if (details) {
    response.details = details;
  }

  return res.status(statusCode).json(response);
};

