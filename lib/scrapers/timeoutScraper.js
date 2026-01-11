// TimeOut Sydney scraper

import { EventScraper } from './eventScraper.js';
import * as cheerio from 'cheerio';
import { logger } from '../../utils/logger.js';

export class TimeOutScraper extends EventScraper {
  constructor() {
    super();
    this.baseUrl = 'https://www.timeout.com';
    this.searchUrl = `${this.baseUrl}/sydney/events`;
  }

  async scrape() {
    const events = [];
    
    try {
      logger.info(`Scraping TimeOut: ${this.searchUrl}`);
      const html = await this.fetchPage(this.searchUrl);
      if (!html) {
        logger.warn('No HTML content received from TimeOut');
        return events;
      }

      const $ = cheerio.load(html);
      
      // combine all possible selectors to find ALL event items
      const allSelectors = [
        'article.event',
        'article.listing',
        '[data-testid="event-card"]',
        'article[class*="event"]',
        'article[class*="listing"]',
        'div[class*="event"]',
        'div[class*="listing"]',
        '[class*="event-card"]',
        '[class*="event-item"]',
      ];
      
      // collect all unique event items using a Set to track processed elements
      const processedElements = new Set();
      let eventItems = $();
      
      // try all selectors
      allSelectors.forEach(selector => {
        $(selector).each((i, el) => {
          if (!processedElements.has(el)) {
            processedElements.add(el);
            eventItems = eventItems.add(el);
          }
        });
      });
      
      // Additional fallback: find all article elements  that might be events
      if (eventItems.length === 0) {
        $('article').each((i, el) => {
          if (!processedElements.has(el)) {
            processedElements.add(el);
            eventItems = eventItems.add(el);
          }
        });
      }
      
      logger.info(`Found ${eventItems.length} potential event items`);
      // Process all event items - no limit

      eventItems.each((index, element) => {
        try {
          const event = this.parseEventItem($, $(element));
          if (event && event.title && event.ticketUrl && event.ticketUrl !== '#') {
            events.push(event);
            logger.debug(`Parsed event: ${event.title}`);
          } else {
            logger.debug(`Skipped invalid event: ${event?.title || 'No title'}`);
          }
        } catch (error) {
          logger.error('Error parsing event item', { error: error.message, stack: error.stack });
        }
      });
      
      logger.info(`TimeOut scraper found ${events.length} valid events`);
    } catch (error) {
      logger.error('Error scraping TimeOut', { error: error.message, stack: error.stack });
    }

    return events;
  }

  parseEventItem($, item) {
    try {
      const title = this.cleanText(
        item.find('h2, h3, .title, .heading, [data-testid="event-title"]').first().text() ||
        item.find('a').first().text()
      ) || 'Untitled Event';

      const dateElem = item.find('time, .date, [data-testid="event-date"]').first();
      const dateStr = dateElem.attr('datetime') || dateElem.text();
      const eventDate = this.parseDate(dateStr);

      const location = this.cleanText(
        item.find('.location, .venue, .address, [data-testid="event-location"]').first().text()
      ) || 'Sydney, Australia';

      const description = this.cleanText(
        item.find('.description, .summary, .excerpt, p').first().text()
      ).substring(0, 500) || '';

      const imgElem = item.find('img').first();
      let imageUrl = imgElem.attr('src') || imgElem.attr('data-src') || '';
      if (imageUrl && !imageUrl.startsWith('http')) {
        imageUrl = new URL(imageUrl, this.baseUrl).href;
      }

      const linkElem = item.find('a[href]').first();
      let ticketUrl = linkElem.attr('href') || '';
      if (ticketUrl && !ticketUrl.startsWith('http')) {
        try {
          ticketUrl = new URL(ticketUrl, this.baseUrl).href;
        } catch (e) {
          ticketUrl = `${this.baseUrl}${ticketUrl}`;
        }
      }
      
      // Fallback to search URL if no ticket URL
      if (!ticketUrl) {
        ticketUrl = this.searchUrl;
      }

      return {
        title,
        date: eventDate,
        location,
        description,
        imageUrl,
        ticketUrl,
        source: 'TimeOut',
        lastUpdated: new Date(),
      };
    } catch (error) {
      logger.error('Error parsing event', { error: error.message, stack: error.stack });
      return null;
    }
  }
}

