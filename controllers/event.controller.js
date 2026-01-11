

import Event from '../models/event.model.js';
import { ScraperManager } from '../lib/scrapers/scraperManager.js';
import { logger } from '../utils/logger.js';
import { sendSuccess, sendError } from '../utils/response.js';

// get all events
export const getEvents = async (req, res) => {
  try {
    const { upcoming, limit = 12, page = 1, startDate, endDate } = req.query;

    let query = {};
    
    // Date range filter
    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        // Parse date string (YYYY-MM-DD) - create date at midnight UTC to avoid timezone issues
        const [year, month, day] = startDate.split('-').map(Number);
        const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
        query.date.$gte = start;
        logger.info('Date filter - startDate', { startDate, parsed: start, iso: start.toISOString() });
      }
      if (endDate) {
        // Parse date string (YYYY-MM-DD) - create date at end of day UTC
        const [year, month, day] = endDate.split('-').map(Number);
        const end = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
        query.date.$lte = end;
        logger.info('Date filter - endDate', { endDate, parsed: end, iso: end.toISOString() });
      }
    } else if (upcoming === 'true') {
      query.date = { $gte: new Date() };
    }
    
    logger.info('Event query filter', { 
      hasDateFilter: !!query.date, 
      startDate, 
      endDate, 
      upcoming,
      query: JSON.stringify(query)
    });

    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Get total count for pagination
    const total = await Event.countDocuments(query);
    const totalPages = total > 0 ? Math.ceil(total / limitNum) : 1;
    
    // Ensure totalPages is at least 1
    const finalTotalPages = Math.max(1, totalPages);

    // Fetch events with pagination
    const events = await Event.find(query)
      .sort({ date: 1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    const formattedEvents = events.map(event => ({
      ...event,
      _id: event._id.toString(),
      date: event.date.toISOString(),
      createdAt: event.createdAt?.toISOString(),
      updatedAt: event.updatedAt?.toISOString(),
      lastUpdated: event.lastUpdated?.toISOString(),
    }));

    logger.info('Events fetched', { 
      count: formattedEvents.length, 
      page: pageNum,
      totalPages: finalTotalPages,
      total,
      limit: limitNum,
      upcoming 
    });
    
    return sendSuccess(res, 200, formattedEvents, null, {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: finalTotalPages,
    });
  } catch (error) {
    logger.error('Error fetching events', { error: error.message, stack: error.stack });
    return sendError(res, 500, 'Failed to fetch events', error.message);
  }
};

// get event by id
export const getEventById = async (req, res) => {
  try {
    const { id } = req.params;

    const event = await Event.findById(id).lean();

    if (!event) {
      return sendError(res, 404, 'Event not found');
    }

    const formattedEvent = {
      ...event,
      _id: event._id.toString(),
      date: event.date.toISOString(),
      createdAt: event.createdAt?.toISOString(),
      updatedAt: event.updatedAt?.toISOString(),
      lastUpdated: event.lastUpdated?.toISOString(),
    };

    logger.info('Event fetched', { eventId: id });
    return sendSuccess(res, 200, formattedEvent);
  } catch (error) {
    logger.error('Error fetching event', { error: error.message, eventId: id });
    return sendError(res, 500, 'Failed to fetch event', error.message);
  }
};


 // scrape and save events
 
export const scrapeEvents = async (req, res) => {
  try {
    logger.info('Starting scrape process', { timestamp: new Date().toISOString() });
    
    // Ensure database is connected
    const connectDB = (await import('../config/database.js')).default;
    await connectDB();
    logger.info('Database connected', { 
      readyState: (await import('mongoose')).default.connection.readyState 
    });

    logger.info('Initializing ScraperManager...');
    const scraperManager = new ScraperManager();
    logger.info('ScraperManager initialized', { scraperCount: scraperManager.scrapers.length });
    
    logger.info('Starting scrapeAll()...');
    const events = await scraperManager.scrapeAll();
    
    logger.info(`Scrape completed, found ${events.length} events`, { 
      eventCount: events.length,
      events: events.map(e => ({ title: e.title, source: e.source }))
    });
    
    logger.info('Starting to save events...');

    if (events.length === 0) {
      logger.warn('No events scraped');
      return sendSuccess(res, 200, {
        inserted: 0,
        updated: 0,
        total: 0,
      }, 'No events found to scrape');
    }

    let insertedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    for (const eventData of events) {
      try {
        // Ensure date is a Date object
        const eventDate = eventData.date instanceof Date 
          ? eventData.date 
          : new Date(eventData.date);

        // Prepare event data with proper date
        const eventToSave = {
          ...eventData,
          date: eventDate,
          title: eventData.title.trim(),
          ticketUrl: eventData.ticketUrl || '#',
          imageUrl: eventData.imageUrl || '', // Explicitly include imageUrl
        };
        
        // Log imageUrl for debugging
        if (eventData.imageUrl) {
          logger.debug('Event has imageUrl', { 
            title: eventData.title.substring(0, 50),
            imageUrl: eventData.imageUrl.substring(0, 100) + (eventData.imageUrl.length > 100 ? '...' : ''),
            imageUrlLength: eventData.imageUrl.length
          });
        } else {
          logger.warn('Event missing imageUrl', { 
            title: eventData.title.substring(0, 50)
          });
        }

        let existingEvent = null;

        // Priority 1: Check by eventId if available (most reliable)
        if (eventData.eventId && eventData.eventId.trim()) {
          existingEvent = await Event.findOne({
            eventId: eventData.eventId.trim(),
          });
          if (existingEvent) {
            logger.debug(`Found existing event by eventId: ${eventData.eventId} - ${eventData.title}`);
          }
        }

        // Priority 2: Check by ticketUrl if eventId not found or not available
        if (!existingEvent && eventData.ticketUrl && eventData.ticketUrl !== '#') {
          // Normalize ticket URL - extract base URL without query params
          let normalizedTicketUrl = eventData.ticketUrl.trim();
          try {
            const urlObj = new URL(normalizedTicketUrl);
            normalizedTicketUrl = `${urlObj.origin}${urlObj.pathname}`.replace(/\/$/, '');
          } catch (e) {
            normalizedTicketUrl = normalizedTicketUrl.split('?')[0].replace(/\/$/, '');
          }
          
          // Try exact match first
          existingEvent = await Event.findOne({
            ticketUrl: eventData.ticketUrl.trim()
          });
          
          // If not found, try matching the base URL (without query params)
          if (!existingEvent && normalizedTicketUrl) {
            // Use regex to match URLs that start with the normalized base URL
            const escapedUrl = normalizedTicketUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            existingEvent = await Event.findOne({
              ticketUrl: { $regex: new RegExp(`^${escapedUrl}(?:\\?|$)`, 'i') }
            });
          }
          
          if (existingEvent) {
            logger.debug(`Found existing event by ticketUrl: ${eventData.ticketUrl} - ${eventData.title}`);
          }
        }

        // Priority 3: Fallback to title and date if neither eventId nor ticketUrl found a match
        if (!existingEvent) {
          const startOfDay = new Date(eventDate);
          startOfDay.setHours(0, 0, 0, 0);
          const endOfDay = new Date(eventDate);
          endOfDay.setHours(23, 59, 59, 999);

          existingEvent = await Event.findOne({
            title: { $regex: new RegExp(`^${eventData.title.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
            date: {
              $gte: startOfDay,
              $lte: endOfDay,
            },
          });
          if (existingEvent) {
            logger.debug(`Found existing event by title and date: ${eventData.title}`);
          }
        }

        if (existingEvent) {
          // Preserve existing imageUrl if new one is empty
          if (!eventToSave.imageUrl || eventToSave.imageUrl.trim() === '') {
            if (existingEvent.imageUrl) {
              eventToSave.imageUrl = existingEvent.imageUrl;
              logger.debug('Preserving existing imageUrl', { 
                existingImageUrl: existingEvent.imageUrl.substring(0, 100) 
              });
            }
          }
          
          // Update existing event
          const updateResult = await Event.updateOne(
            { _id: existingEvent._id },
            { 
              $set: {
                ...eventToSave,
                lastUpdated: new Date(),
              }
            }
          );
          updatedCount++;
          logger.debug(`Updated event: ${eventData.title} (ID: ${existingEvent._id})`, {
            hasImageUrl: !!eventToSave.imageUrl,
            imageUrlLength: eventToSave.imageUrl?.length || 0,
            imageUrlPreview: eventToSave.imageUrl ? eventToSave.imageUrl.substring(0, 100) : 'N/A',
            modifiedCount: updateResult.modifiedCount
          });
        } else {
          // Create new event
          const newEvent = await Event.create(eventToSave);
          insertedCount++;
          logger.debug(`Inserted new event: ${eventData.title}`, {
            eventId: newEvent._id,
            hasImageUrl: !!newEvent.imageUrl,
            imageUrlLength: newEvent.imageUrl?.length || 0,
            imageUrl: newEvent.imageUrl?.substring(0, 100) || 'N/A'
          });
        }
      } catch (error) {
        errorCount++;
        logger.error('Error saving event', { 
          error: error.message, 
          eventTitle: eventData.title,
          eventId: eventData.eventId,
          ticketUrl: eventData.ticketUrl,
          stack: error.stack 
        });
        continue;
      }
    }

    logger.info('Scraping completed', { 
      inserted: insertedCount, 
      updated: updatedCount,
      errors: errorCount,
      total: events.length 
    });
    
    return sendSuccess(res, 200, {
      inserted: insertedCount,
      updated: updatedCount,
      errors: errorCount,
      total: events.length,
    }, 'Scraping completed');
  } catch (error) {
    logger.error('Error during scraping', { error: error.message, stack: error.stack });
    return sendError(res, 500, 'Failed to scrape events', error.message);
  }
};

