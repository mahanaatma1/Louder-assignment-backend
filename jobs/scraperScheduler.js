/**
 * Scraper Scheduler
 * Runs event scraping job every hour
 */

import cron from 'node-cron';
import { logger } from '../utils/logger.js';
import { ScraperManager } from '../lib/scrapers/scraperManager.js';
import Event from '../models/event.model.js';
import connectDB from '../config/database.js';

// run the scraping job
async function runScrapingJob() {
  try {
    logger.info('=== Starting scheduled scraping job ===', {
      timestamp: new Date().toISOString(),
    });

    // Ensure database is connected
    await connectDB();
    logger.info('Database connected for scheduled job');

    // Initialize scraper manager
    const scraperManager = new ScraperManager();
    logger.info('ScraperManager initialized', {
      scraperCount: scraperManager.scrapers.length,
    });

    // Run scraping
    const events = await scraperManager.scrapeAll();
    logger.info(`Scrape completed, found ${events.length} events`);

    if (events.length === 0) {
      logger.warn('No events scraped in scheduled job');
      return;
    }

    // Save events to database
    let insertedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    for (const eventData of events) {
      try {
        const eventDate =
          eventData.date instanceof Date
            ? eventData.date
            : new Date(eventData.date);

        const eventToSave = {
          ...eventData,
          date: eventDate,
          title: eventData.title.trim(),
          ticketUrl: eventData.ticketUrl || '#',
          imageUrl: eventData.imageUrl || '',
        };

        let existingEvent = null;

        // Check by eventId first
        if (eventData.eventId && eventData.eventId.trim()) {
          existingEvent = await Event.findOne({
            eventId: eventData.eventId.trim(),
          });
        }

        // Check by ticketUrl if not found
        if (!existingEvent && eventData.ticketUrl && eventData.ticketUrl !== '#') {
          let normalizedTicketUrl = eventData.ticketUrl.trim();
          try {
            const urlObj = new URL(normalizedTicketUrl);
            normalizedTicketUrl = `${urlObj.origin}${urlObj.pathname}`.replace(/\/$/, '');
          } catch (e) {
            normalizedTicketUrl = normalizedTicketUrl.split('?')[0].replace(/\/$/, '');
          }

          existingEvent = await Event.findOne({
            ticketUrl: eventData.ticketUrl.trim(),
          });

          if (!existingEvent && normalizedTicketUrl) {
            const escapedUrl = normalizedTicketUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            existingEvent = await Event.findOne({
              ticketUrl: { $regex: new RegExp(`^${escapedUrl}(?:\\?|$)`, 'i') },
            });
          }
        }

        // Fallback: check by title and date
        if (!existingEvent) {
          const startOfDay = new Date(eventDate);
          startOfDay.setHours(0, 0, 0, 0);
          const endOfDay = new Date(eventDate);
          endOfDay.setHours(23, 59, 59, 999);

          existingEvent = await Event.findOne({
            title: {
              $regex: new RegExp(
                `^${eventData.title.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
                'i'
              ),
            },
            date: {
              $gte: startOfDay,
              $lte: endOfDay,
            },
          });
        }

        if (existingEvent) {
          // Preserve existing imageUrl if new one is empty
          if (!eventToSave.imageUrl && existingEvent.imageUrl) {
            eventToSave.imageUrl = existingEvent.imageUrl;
          }

          await Event.updateOne(
            { _id: existingEvent._id },
            {
              $set: {
                ...eventToSave,
                lastUpdated: new Date(),
              },
            }
          );
          updatedCount++;
        } else {
          await Event.create(eventToSave);
          insertedCount++;
        }
      } catch (error) {
        errorCount++;
        logger.error('Error saving event in scheduled job', {
          error: error.message,
          eventTitle: eventData.title,
        });
        continue;
      }
    }

    logger.info('=== Scheduled scraping job completed ===', {
      inserted: insertedCount,
      updated: updatedCount,
      errors: errorCount,
      total: events.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error in scheduled scraping job', {
      error: error.message,
      stack: error.stack,
    });
  }
}

// start the scheduler
export function startScraperScheduler() {
  // Run every hour at minute 0 (e.g., 1:00, 2:00, 3:00)
  // Cron format: minute hour day month day-of-week
  // '0 * * * *' means: at minute 0 of every hour
  const cronExpression = '0 * * * *';

  logger.info('Starting scraper scheduler', {
    schedule: 'Every hour at minute 0',
    cronExpression,
  });

  // Schedule the job
  cron.schedule(cronExpression, async () => {
    await runScrapingJob();
  });
}

