/**
 * Express Server
 * Standalone server for the backend API
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import routes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { logger } from './utils/logger.js';

// Load environment variables
dotenv.config();

// Try to connect to database on startup
import('./config/database.js').then(({ default: connectDB }) => {
  connectDB()
    .then(() => {
      // Start the scraper scheduler after database connection
      import('./jobs/scraperScheduler.js').then(({ startScraperScheduler }) => {
        startScraperScheduler();
        logger.info('Scraper scheduler started');
      });
    })
    .catch((error) => {
      logger.error('Failed to connect to database on startup', {
        error: error.message,
      });
    });
});

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware - CORS configuration
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'https://louder-assignments.vercel.app',
  'http://localhost:3000',
].filter(Boolean); // Remove any undefined values

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // Allow the request (can be restricted later if needed)
      callback(null, true);
    }
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    method: req.method,
    path: req.path,
    ip: req.ip,
  });
  next();
});

// Health check endpoint
app.get('/health', async (req, res) => {
  const mongoose = (await import('mongoose')).default;
  const dbStatus = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  const dbState = dbStatus[mongoose.connection.readyState] || 'unknown';
  
  res.json({
    status: dbState === 'connected' ? 'ok' : 'error',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: {
      status: dbState,
      connected: mongoose.connection.readyState === 1,
      dbName: mongoose.connection.db?.databaseName || 'not connected',
      host: mongoose.connection.host || 'not connected',
    },
  });
});

// API Routes
app.use('/api', routes);

// Error handling (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  logger.info(`Backend server running on port ${PORT}`, {
    port: PORT,
    env: process.env.NODE_ENV || 'development',
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  process.exit(0);
});

export default app;

