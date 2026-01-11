

import Subscription from '../models/subscription.model.js';
import Event from '../models/event.model.js';
import { logger } from '../utils/logger.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { isValidEmail, isValidObjectId } from '../utils/validation.js';

export const createSubscription = async (req, res) => {
  try {
    const { email, eventId, optIn = true } = req.body;

    // Validate email
    if (!email || !isValidEmail(email)) {
      return sendError(res, 400, 'Please enter a valid email address');
    }

    if (!eventId || !isValidObjectId(eventId)) {
      return sendError(res, 400, 'Valid event ID is required');
    }

    // Verify event exists
    const event = await Event.findById(eventId);
    if (!event) {
      logger.warn('Event not found for subscription', { eventId, email });
      return sendError(res, 404, 'Event not found');
    }

    
    let subscription = await Subscription.findOne({
      email: email.toLowerCase(),
      eventId,
    });

    if (subscription) {
      
      subscription.optIn = optIn;
      
      subscription.isVerified = true; // Auto-verify without OTP
      await subscription.save();
    } else {
      // Create new subscription
      subscription = await Subscription.create({
        email: email.toLowerCase(),
        eventId,
        optIn,
       
        isVerified: true, // Auto-verify without OTP
      });
    }

   

    logger.info('Subscription created/updated (OTP disabled)', { email, eventId });
    return sendSuccess(res, 201, {
      email: subscription.email,
      eventId: subscription.eventId.toString(),
      optIn: subscription.optIn,
      ticketUrl: event.ticketUrl, // Return ticket URL directly
      requiresVerification: false, // No verification needed
      verified: true,
    }, 'Subscription created successfully');
  } catch (error) {
    logger.error('Error creating subscription', { error: error.message, email, eventId });
    return sendError(res, 500, 'Failed to create subscription', error.message);
  }
};



export const getSubscriptions = async (req, res) => {
  try {
    const { limit = 1000 } = req.query;

    const subscriptions = await Subscription.find()
      .populate('eventId', 'title date location')
      .limit(parseInt(limit))
      .lean();

    const formattedSubscriptions = subscriptions.map(sub => ({
      ...sub,
      _id: sub._id.toString(),
      eventId: sub.eventId._id ? sub.eventId._id.toString() : sub.eventId.toString(),
      createdAt: sub.createdAt?.toISOString(),
      updatedAt: sub.updatedAt?.toISOString(),
    }));

    logger.info('Subscriptions fetched', { count: formattedSubscriptions.length });
    return sendSuccess(res, 200, formattedSubscriptions);
  } catch (error) {
    logger.error('Error fetching subscriptions', { error: error.message, stack: error.stack });
    return sendError(res, 500, 'Failed to fetch subscriptions', error.message);
  }
};

