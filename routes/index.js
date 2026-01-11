// Routes Index - combines all routes

import express from 'express';
import eventRoutes from './event.route.js';
import subscriptionRoutes from './subscription.route.js';
import testRoutes from './test.route.js';

const router = express.Router();

// event routes
router.use('/events', eventRoutes);

// Subscription routes
router.use('/subscriptions', subscriptionRoutes);

// test routes (for debugging scrapers)
if (process.env.NODE_ENV !== 'production') {
  router.use('/test', testRoutes);
}

export default router;

