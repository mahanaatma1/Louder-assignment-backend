// Validation middleware

import { validateEventData, validateSubscriptionData } from '../utils/validation.js';

// validate event data middleware
export const validateEvent = (req, res, next) => {
  const validation = validateEventData(req.body);
  
  if (!validation.isValid) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: validation.errors,
    });
  }
  
  next();
};

// validate subscription data middleware
export const validateSubscription = (req, res, next) => {
  const validation = validateSubscriptionData(req.body);
  
  if (!validation.isValid) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: validation.errors,
    });
  }
  
  next();
};

