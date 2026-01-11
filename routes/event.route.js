// Event Routes

import express from 'express';
import { getEvents, getEventById, scrapeEvents } from '../controllers/event.controller.js';
import connectDB from '../config/database.js';

const router = express.Router();

// middleware to connect to database before routes
router.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    const { logger } = await import('../utils/logger.js');
    logger.error('Database connection failed in route middleware', {
      error: error.message,
      path: req.path,
    });
    return res.status(500).json({
      success: false,
      error: 'Database connection failed',
      message: error.message,
    });
  }
});

// get all events
router.get('/', getEvents);

// scrape events (must be before /:id route)
router.post('/scrape', scrapeEvents);

// get event by ID (must be last to avoid matching /scrape)
router.get('/:id', getEventById);

export default router;

