// Subscription Routes

import express from 'express';
import { createSubscription, getSubscriptions } from '../controllers/subscription.controller.js';
// OTP Flow Commented Out
// import { verifyOTP } from '../controllers/subscription.controller.js';
import connectDB from '../config/database.js';

const router = express.Router();

// middleware to connect to database before routes
router.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Database connection failed',
      message: error.message,
    });
  }
});

// create subscription (OTP disabled)
router.post('/', createSubscription);

// OTP Flow Commented Out
// verify OTP
// router.post('/verify', verifyOTP);

// get all subscriptions
router.get('/', getSubscriptions);

export default router;

