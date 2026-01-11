

import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';
import dotenv from 'dotenv';
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sydney_events';

if (!MONGODB_URI) {
  logger.error('MONGODB_URI is not defined');
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  // Check if already connected
  if (cached.conn) {
    logger.info('Database already connected', {
      state: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      db: mongoose.connection.db?.databaseName,
    });
    return cached.conn;
  }

  // Check connection state
  const currentState = mongoose.connection.readyState;
  const stateNames = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  
  logger.info('Connecting to MongoDB...', {
    uri: MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'), // Hide credentials in logs
    currentState: stateNames[currentState] || 'unknown',
  });

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts)
      .then((mongooseInstance) => {
        logger.info('✓ Database connected successfully', {
          db: mongooseInstance.connection.db?.databaseName,
          host: mongooseInstance.connection.host,
          port: mongooseInstance.connection.port,
        });
        return mongooseInstance;
      })
      .catch((error) => {
        logger.error('✗ Database connection failed', {
          error: error.message,
          uri: MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'),
        });
        throw error;
      });
  }

  try {
    cached.conn = await cached.promise;
    
    // Set up connection event listeners
    mongoose.connection.on('connected', () => {
      logger.info('✓ MongoDB connection established', {
        db: mongoose.connection.db?.databaseName,
      });
    });

    mongoose.connection.on('error', (err) => {
      logger.error('✗ MongoDB connection error', {
        error: err.message,
      });
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('⚠ MongoDB disconnected');
    });

    // Handle process termination
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed due to application termination');
      process.exit(0);
    });

    return cached.conn;
  } catch (e) {
    cached.promise = null;
    logger.error('✗ Failed to connect to database', {
      error: e.message,
      uri: MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'),
    });
    throw e;
  }
}

export default connectDB;

