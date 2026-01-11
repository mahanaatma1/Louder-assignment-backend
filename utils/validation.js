// Validation utilities

// validate email format
export const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') {
    return false;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

// validate MongoDB ObjectId
export const isValidObjectId = (id) => {
  if (!id || typeof id !== 'string') {
    return false;
  }
  // MongoDB ObjectId is 24 hex characters
  const objectIdRegex = /^[0-9a-fA-F]{24}$/;
  return objectIdRegex.test(id);
};

// validate event data
export const validateEventData = (eventData) => {
  const errors = [];

  if (!eventData.title || typeof eventData.title !== 'string' || eventData.title.trim().length === 0) {
    errors.push('Title is required');
  }

  if (!eventData.date) {
    errors.push('Date is required');
  } else {
    const date = new Date(eventData.date);
    if (isNaN(date.getTime())) {
      errors.push('Invalid date format');
    }
  }

  if (!eventData.ticketUrl || typeof eventData.ticketUrl !== 'string' || eventData.ticketUrl.trim().length === 0) {
    errors.push('Ticket URL is required');
  }

  if (eventData.location && typeof eventData.location !== 'string') {
    errors.push('Location must be a string');
  }

  if (eventData.description && typeof eventData.description !== 'string') {
    errors.push('Description must be a string');
  }

  if (eventData.imageUrl && typeof eventData.imageUrl !== 'string') {
    errors.push('Image URL must be a string');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// validate subscription data
export const validateSubscriptionData = (subscriptionData) => {
  const errors = [];

  if (!subscriptionData.email || !isValidEmail(subscriptionData.email)) {
    errors.push('Valid email is required');
  }

  if (!subscriptionData.eventId || !isValidObjectId(subscriptionData.eventId)) {
    errors.push('Valid event ID is required');
  }

  if (subscriptionData.optIn !== undefined && typeof subscriptionData.optIn !== 'boolean') {
    errors.push('Opt-in must be a boolean');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

