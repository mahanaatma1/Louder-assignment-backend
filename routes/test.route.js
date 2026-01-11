/**
 * Test Routes
 * For testing scrapers
 */

import express from 'express';
import { EventbriteScraper } from '../lib/scrapers/eventbriteScraper.js';
import { TimeOutScraper } from '../lib/scrapers/timeoutScraper.js';
import { ScraperManager } from '../lib/scrapers/scraperManager.js';

const router = express.Router();

// Test Eventbrite scraper
router.get('/eventbrite', async (req, res) => {
  try {
    const scraper = new EventbriteScraper();
    const events = await scraper.scrape();
    return res.json({
      success: true,
      count: events.length,
      events: events.slice(0, 5), // Return first 5 for testing
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Test TimeOut scraper
router.get('/timeout', async (req, res) => {
  try {
    const scraper = new TimeOutScraper();
    const events = await scraper.scrape();
    return res.json({
      success: true,
      count: events.length,
      events: events.slice(0, 5), // Return first 5 for testing
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Test all scrapers
router.get('/all', async (req, res) => {
  try {
    const scraperManager = new ScraperManager();
    const events = await scraperManager.scrapeAll();
    return res.json({
      success: true,
      count: events.length,
      events: events.slice(0, 10), // Return first 10 for testing
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;

