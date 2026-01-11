// Scraper manager - coordinates multiple scrapers

import { EventbriteScraper } from './eventbriteScraper.js';
import { TimeOutScraper } from './timeoutScraper.js';
import { logger } from '../../utils/logger.js';
import { removeDuplicates } from './utils.js';

export class ScraperManager {
  constructor() {
    this.scrapers = [
      new EventbriteScraper(),
      new TimeOutScraper(),
    ];
  }

  async scrapeAll() {
    const allEvents = [];
    
    logger.info('Starting scraping process', { scraperCount: this.scrapers.length });
    
    const results = await Promise.allSettled(
      this.scrapers.map(scraper => scraper.scrape())
    );

    results.forEach((result, index) => {
      const scraperName = this.scrapers[index].constructor.name;
      if (result.status === 'fulfilled') {
        const eventCount = result.value.length;
        allEvents.push(...result.value);
        logger.info(`Scraper completed`, { scraper: scraperName, eventCount });
      } else {
        logger.error(`Scraper failed`, { 
          scraper: scraperName, 
          error: result.reason?.message || 'Unknown error' 
        });
      }
    });

    // remove duplicates
    const uniqueEvents = removeDuplicates(allEvents, (event) => {
      return `${event.title.toLowerCase()}_${event.date.toISOString().split('T')[0]}`;
    });

    logger.info('Scraping completed', { 
      total: allEvents.length, 
      unique: uniqueEvents.length 
    });

    return uniqueEvents;
  }
}

