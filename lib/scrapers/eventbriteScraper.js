// Eventbrite scraper for Sydney events with scrolling and category support

import { EventScraper } from './eventScraper.js';
import * as cheerio from 'cheerio';
import { logger } from '../../utils/logger.js';
import puppeteer from 'puppeteer';

export class EventbriteScraper extends EventScraper {
  constructor() {
    super();
    this.baseUrl = 'https://www.eventbrite.com.au';
    this.searchUrl = `${this.baseUrl}/d/australia--sydney/all-events/?_gl=1*1d0hbbh*_up*MQ..*_ga*NjY1ODI4ODQ5LjE3NjgwMjUzNTA.*_ga_TQVES5V6SH*czE3NjgwMjUzNTAkbzEkZzAkdTE3NjgwMjUzNTAkajYwJGwwJGgw`;
    this.originalUrl = `${this.baseUrl}/d/australia--sydney/events/`;
  }

  async scrape() {
    const events = [];
    let browser = null;
    
    try {
      logger.info('Starting Eventbrite scraping with Puppeteer');
      
      // Launch browser
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
        ],
      });

      const page = await browser.newPage();
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

      // Step 1: Scrape main page with scrolling
      logger.info(`Scraping main page: ${this.searchUrl}`);
      const mainEvents = await this.scrapePageWithScrolling(page, this.searchUrl);
      events.push(...mainEvents);
      logger.info(`Found ${mainEvents.length} events on main page`);

      // Step 2: Extract category links and scrape each category
      logger.info('Extracting category links...');
      const categoryUrls = await this.extractCategoryLinks(page, this.searchUrl);
      logger.info(`Found ${categoryUrls.length} categories to scrape`);

      // Step 3: Scrape each category with scrolling
      for (let i = 0; i < categoryUrls.length; i++) {
        const categoryUrl = categoryUrls[i];
        logger.info(`Scraping category ${i + 1}/${categoryUrls.length}: ${categoryUrl}`);
        
        try {
          const categoryEvents = await this.scrapePageWithScrolling(page, categoryUrl);
          events.push(...categoryEvents);
          logger.info(`Found ${categoryEvents.length} events in category ${i + 1}`);
          
          // Small delay between categories to avoid rate limiting
          await this.delay(2000);
        } catch (error) {
          logger.error(`Error scraping category ${categoryUrl}`, { error: error.message });
          continue;
        }
      }

      // Remove duplicates based on eventId or ticketUrl
      const uniqueEvents = this.deduplicateEvents(events);
      logger.info(`Total unique events found: ${uniqueEvents.length} (${events.length} before deduplication)`);

      return uniqueEvents;
    } catch (error) {
      logger.error('Error scraping Eventbrite', { error: error.message, stack: error.stack });
      return events;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  // scrape a page with infinite scrolling to load all events
  async scrapePageWithScrolling(page, url) {
    const events = [];
    const seenEventIds = new Set();

    try {
      logger.info(`Loading page: ${url}`);
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

      // Wait for initial content to load
      await this.delay(3000);

      let previousEventCount = 0;
      let scrollAttempts = 0;
      const maxScrollAttempts = 50; // Prevent infinite loops
      const scrollDelay = 2000; // 2 seconds between scrolls

      // Scroll to load all events
      while (scrollAttempts < maxScrollAttempts) {
        // Get current event count
        const currentEventCount = await page.evaluate(() => {
          return document.querySelectorAll('a.event-card-link[href*="/e/"], a[href*="/e/"]').length;
        });

        logger.debug(`Scroll attempt ${scrollAttempts + 1}: Found ${currentEventCount} events`);

        // If no new events loaded, try scrolling more
        if (currentEventCount === previousEventCount) {
          // Scroll to bottom
          await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight);
          });
          
          await this.delay(scrollDelay);

          // Check again after scroll
          const newEventCount = await page.evaluate(() => {
            return document.querySelectorAll('a.event-card-link[href*="/e/"], a[href*="/e/"]').length;
          });

          if (newEventCount === currentEventCount) {
            // No new events, try scrolling a bit more
            await page.evaluate(() => {
              window.scrollBy(0, 1000);
            });
            await this.delay(scrollDelay);

            const finalEventCount = await page.evaluate(() => {
              return document.querySelectorAll('a.event-card-link[href*="/e/"], a[href*="/e/"]').length;
            });

            if (finalEventCount === currentEventCount) {
              // No more events to load
              logger.info(`No more events to load after ${scrollAttempts + 1} scroll attempts`);
              break;
            }
          }

          previousEventCount = newEventCount;
        } else {
          previousEventCount = currentEventCount;
        }

        scrollAttempts++;

        // Scroll to bottom
        await page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
        });

        await this.delay(scrollDelay);
      }

      // Get final HTML after all scrolling
      const html = await page.content();
      const $ = cheerio.load(html);

      // Extract all events from the page
      const processedElements = new Set();
      let eventCards = $();

      // Primary method: Find all event card links
      $('a.event-card-link[href*="/e/"], a[href*="/e/"][class*="event"]').each((i, el) => {
        const $link = $(el);
        const eventId = $link.attr('data-event-id');
        
        // Skip if we've already seen this event
        if (eventId && seenEventIds.has(eventId)) {
          return;
        }
        if (eventId) {
          seenEventIds.add(eventId);
        }

        // Get the parent container
        const $card = $link.closest('div[class*="Stack"], div[class*="event-card"], div[class*="Discover"], article, div[class*="card"]');
        if ($card.length > 0 && !processedElements.has($card[0])) {
          processedElements.add($card[0]);
          eventCards = eventCards.add($card[0]);
        } else if (!processedElements.has(el)) {
          processedElements.add(el);
          eventCards = eventCards.add(el);
        }
      });

      // Fallback: Try other selectors
      if (eventCards.length === 0) {
        const allSelectors = [
          '[data-testid="event-card"]',
          '[data-testid="discover-event-card"]',
          '.event-card',
          '.discover-event-card',
          '.eds-event-card',
          'article[class*="event"]',
          'div[class*="event-card"]',
          'div[class*="discover-event"]',
        ];

        allSelectors.forEach(selector => {
          $(selector).each((i, el) => {
            const $el = $(el);
            const hasEventLink = $el.find('a[href*="/e/"]').length > 0;
            if (hasEventLink && !processedElements.has(el)) {
              const eventLink = $el.find('a[href*="/e/"]').first();
              const eventId = eventLink.attr('data-event-id');
              if (eventId && seenEventIds.has(eventId)) {
                return;
              }
              if (eventId) {
                seenEventIds.add(eventId);
              }
              processedElements.add(el);
              eventCards = eventCards.add(el);
            }
          });
        });
      }

      logger.info(`Found ${eventCards.length} event cards on page`);

      // Parse each event card
      eventCards.each((index, element) => {
        try {
          const event = this.parseEventCard($, $(element));
          if (event && event.title && event.title !== 'Untitled Event' && event.ticketUrl && event.ticketUrl !== '#' && !event.ticketUrl.includes(this.searchUrl)) {
            events.push(event);
          }
        } catch (error) {
          logger.error('Error parsing event card', { error: error.message });
        }
      });

      logger.info(`Parsed ${events.length} valid events from page`);
    } catch (error) {
      logger.error(`Error scraping page ${url}`, { error: error.message, stack: error.stack });
    }

    return events;
  }

  // extract category links from the main page
  async extractCategoryLinks(page, url) {
    const categoryUrls = [];

    try {
      logger.info(`Extracting categories from: ${url}`);
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
      await this.delay(3000);

      // Get HTML and parse with cheerio
      const html = await page.content();
      const $ = cheerio.load(html);

      // Find category links in the filter panel
      // Categories are typically in links like /d/australia--sydney/business--events/
      $('a[href*="/d/australia--sydney/"][href*="--events/"]').each((i, el) => {
        const href = $(el).attr('href');
        if (href && !categoryUrls.includes(href)) {
          // Make sure it's a full URL
          const fullUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
          if (fullUrl !== url && fullUrl !== this.searchUrl && fullUrl !== this.originalUrl) {
            categoryUrls.push(fullUrl);
          }
        }
      });

      // Also look for category links in the filter section
      $('[data-testid="category-filter"] a, .NestedCategoryFilters-module__categoryOption___3lHL4 a').each((i, el) => {
        const href = $(el).attr('href');
        if (href && href.includes('--events/')) {
          const fullUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
          if (!categoryUrls.includes(fullUrl) && fullUrl !== url && fullUrl !== this.searchUrl && fullUrl !== this.originalUrl) {
            categoryUrls.push(fullUrl);
          }
        }
      });

      logger.info(`Extracted ${categoryUrls.length} category URLs`);
    } catch (error) {
      logger.error('Error extracting category links', { error: error.message, stack: error.stack });
    }

    return categoryUrls;
  }

  // remove duplicate events based on eventId or ticketUrl
  deduplicateEvents(events) {
    const seen = new Map();
    const unique = [];

    for (const event of events) {
      const key = event.eventId || event.ticketUrl;
      if (key && !seen.has(key)) {
        seen.set(key, true);
        unique.push(event);
      } else if (!key) {
        // If no eventId or ticketUrl, check by title and date
        const titleDateKey = `${event.title}_${event.date?.getTime()}`;
        if (!seen.has(titleDateKey)) {
          seen.set(titleDateKey, true);
          unique.push(event);
        }
      }
    }

    return unique;
  }

  // delay helper
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  parseEventCard($, card) {
    try {
      // Find the main event link - this is the key element
      const eventLink = card.find('a.event-card-link[href*="/e/"], a[href*="/e/"]').first();
      
      // Extract all data attributes from the event link
      const eventId = eventLink.attr('data-event-id') || '';
      const paidStatus = eventLink.attr('data-event-paid-status') || '';
      const hasPromoCode = eventLink.attr('data-event-has-promo-code') === 'true';
      const hasBogoLabel = eventLink.attr('data-event-has-bogo-label') === 'true';
      
      // Check for urgency signals (Just added, etc.)
      let urgencySignal = '';
      const urgencyElem = card.find('.EventCardUrgencySignal').first();
      if (urgencyElem.length > 0) {
        urgencySignal = this.cleanText(urgencyElem.find('p').first().text() || urgencyElem.text());
      }
      
      // Check if event is promoted
      const isPromoted = card.find('[class*="promotedLabel"], [class*="Promoted"]').length > 0;
      
      // Title extraction - from h3 inside the link or link text
      let title = this.cleanText(
        eventLink.find('h3').first().text() ||
        eventLink.text() ||
        eventLink.attr('aria-label') ||
        card.find('h3, h2').first().text() ||
        card.find('[class*="title"]').first().text()
      );
      
      // Final fallback
      if (!title || title.length < 3) {
        title = 'Untitled Event';
      }

      // Date extraction - look for p tag after the link (Eventbrite structure)
      // Format: "Fri, 23 Jan, 10:00 pm"
      let dateStr = '';
      
      // Try to find date in the structure: link -> next p tag
      if (eventLink.length > 0) {
        const dateP = eventLink.parent().find('p').filter((i, el) => {
          const text = $(el).text().trim();
          // Check if it looks like a date (contains day name, month, or time)
          return /(Mon|Tue|Wed|Thu|Fri|Sat|Sun|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\d{1,2}:\d{2})/i.test(text);
        }).first();
        
        if (dateP.length > 0) {
          dateStr = dateP.text().trim();
        }
      }
      
      // Fallback: try other date selectors
      if (!dateStr) {
        const dateElem = card.find('time, [data-testid="event-date"]').first();
        if (dateElem.length > 0) {
          dateStr = dateElem.attr('datetime') || 
                   dateElem.attr('data-datetime') ||
                   dateElem.text();
        }
      }
      
      // Try finding any p tag that looks like a date
      if (!dateStr) {
        card.find('p').each((i, el) => {
          const text = $(el).text().trim();
          if (/(Mon|Tue|Wed|Thu|Fri|Sat|Sun|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(text) && 
              /(\d{1,2}:\d{2}|pm|am)/i.test(text)) {
            dateStr = text;
            return false; // break
          }
        });
      }
      
      const eventDate = this.parseDate(dateStr);

      // Location extraction - p tag after date
      let location = '';
      
      // Try data attribute first
      if (eventLink.length > 0) {
        location = eventLink.attr('data-event-location') || '';
      }
      
      // If not in data attribute, find p tag after date
      if (!location || location.length < 2) {
        if (eventLink.length > 0) {
          const locationP = eventLink.parent().find('p').filter((i, el) => {
            const text = $(el).text().trim();
            // Check if it looks like a location (not a date, not price)
            return text.length > 0 && 
                   !/(Mon|Tue|Wed|Thu|Fri|Sat|Sun|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\$|From|Free)/i.test(text) &&
                   !/(\d{1,2}:\d{2})/i.test(text);
          }).first();
          
          if (locationP.length > 0) {
            location = this.cleanText(locationP.text());
          }
        }
      }
      
      // Fallback: try other location selectors
      if (!location || location.length < 2) {
        location = this.cleanText(
          card.find('[data-testid="event-location"]').first().text() ||
          card.find('.event-location, .location, .venue, [class*="location"], [class*="venue"]').first().text()
        );
      }
      
      if (!location || location.length < 2) {
        location = 'Sydney, Australia';
      }
      
      // Price extraction - from priceWrapper div
      let price = '';
      const priceWrapper = card.find('[class*="priceWrapper"], [class*="price"]').first();
      if (priceWrapper.length > 0) {
        price = this.cleanText(priceWrapper.find('p').first().text() || priceWrapper.text());
      }

      // Image extraction - look for event-card-image specifically
      let imageUrl = '';
      
      // Try multiple strategies to find the image
      // Strategy 1: Look in image container
      const imageContainer = card.find('.event-card-image__aspect-container, [class*="image-container"], [class*="image__aspect"]').first();
      if (imageContainer.length > 0) {
        const imgElem = imageContainer.find('img.event-card-image, img').first();
        if (imgElem.length > 0) {
          imageUrl = imgElem.attr('src') || 
                     imgElem.attr('data-src') || 
                     imgElem.attr('data-lazy-src') ||
                     imgElem.attr('data-original') ||
                     '';
        }
      }
      
      // Strategy 2: Look inside event link (images are often inside the link)
      if (!imageUrl && eventLink.length > 0) {
        const linkImg = eventLink.find('img').first();
        if (linkImg.length > 0) {
          imageUrl = linkImg.attr('src') || 
                     linkImg.attr('data-src') || 
                     linkImg.attr('data-lazy-src') ||
                     linkImg.attr('data-original') ||
                     '';
        }
      }
      
      // Strategy 3: Find any img with class event-card-image
      if (!imageUrl) {
        const imgElem = card.find('img.event-card-image').first();
        if (imgElem.length > 0) {
          imageUrl = imgElem.attr('src') || 
                     imgElem.attr('data-src') || 
                     imgElem.attr('data-lazy-src') ||
                     imgElem.attr('data-original') ||
                     '';
        }
      }
      
      // Strategy 4: Fallback - find any img in the card
      if (!imageUrl) {
        const imgElem = card.find('img').first();
        if (imgElem.length > 0) {
          imageUrl = imgElem.attr('src') || 
                     imgElem.attr('data-src') || 
                     imgElem.attr('data-lazy-src') ||
                     imgElem.attr('data-original') ||
                     '';
        }
      }
      
      // Clean up and process image URL
      if (imageUrl) {
        try {
          // Step 1: Replace HTML entities
          imageUrl = imageUrl.replace(/&amp;/g, '&')
                            .replace(/&lt;/g, '<')
                            .replace(/&gt;/g, '>')
                            .replace(/&quot;/g, '"')
                            .replace(/&#39;/g, "'");
          
          // Step 2: Handle Eventbrite's proxy URL structure
          if (imageUrl.includes('img.evbuc.com') && imageUrl.includes('%')) {
            try {
              const proxyMatch = imageUrl.match(/img\.evbuc\.com\/(.+?)(?:\?|$)/);
              if (proxyMatch && proxyMatch[1]) {
                const decodedCdnUrl = decodeURIComponent(proxyMatch[1]);
                if (decodedCdnUrl.startsWith('http')) {
                  const originalUrl = new URL(imageUrl);
                  const queryParams = originalUrl.search;
                  imageUrl = decodedCdnUrl + queryParams;
                } else {
                  imageUrl = imageUrl.trim();
                }
              } else {
                imageUrl = decodeURIComponent(imageUrl);
              }
            } catch (decodeError) {
              logger.warn('Failed to decode proxy URL, keeping original', { 
                error: decodeError.message,
                preview: imageUrl.substring(0, 100) 
              });
            }
          } else if (imageUrl.includes('%')) {
            try {
              imageUrl = decodeURIComponent(imageUrl);
            } catch (e) {
              logger.warn('Failed to decode URL, keeping original', { 
                preview: imageUrl.substring(0, 100) 
              });
            }
          }
          
          // Step 3: Ensure it's a full URL
          if (!imageUrl.startsWith('http')) {
            if (imageUrl.startsWith('//')) {
              imageUrl = 'https:' + imageUrl;
            } else if (imageUrl.startsWith('/')) {
              imageUrl = this.baseUrl + imageUrl;
            } else {
              try {
                imageUrl = new URL(imageUrl, this.baseUrl).href;
              } catch (e) {
                logger.warn('Failed to construct full URL', { 
                  imageUrl: imageUrl.substring(0, 100) 
                });
              }
            }
          }
          
          imageUrl = imageUrl.trim();
        } catch (error) {
          logger.error('Error processing image URL', { 
            error: error.message,
            originalUrl: imageUrl.substring(0, 100) 
          });
        }
      }

      // Ticket URL extraction - from the event link
      let ticketUrl = '';
      if (eventLink.length > 0) {
        ticketUrl = eventLink.attr('href');
      } else {
        // Fallback: try other Eventbrite links
        const link = card.find('a[href*="/e/"], a[href*="eventbrite.com"]').first();
        if (link.length > 0) {
          ticketUrl = link.attr('href');
        }
      }
      
      // Normalize ticket URL
      if (ticketUrl) {
        const urlObj = new URL(ticketUrl, this.baseUrl);
        ticketUrl = `${urlObj.origin}${urlObj.pathname}${urlObj.search ? '?' + urlObj.searchParams.toString() : ''}`;
      } else {
        ticketUrl = this.searchUrl;
      }

      // Build description with available info
      let description = this.cleanText(
        card.find('[data-testid="event-description"]').first().text() ||
        card.find('[class*="description"]').first().text() ||
        card.find('p').not(eventLink.parent().find('p')).first().text()
      );
      
      // If we have price info, add it to description
      if (price && !description.includes(price)) {
        description = description ? `${description} | ${price}` : price;
      }
      
      if (description.length > 500) {
        description = description.substring(0, 500);
      }

      return {
        title: title.trim(),
        date: eventDate,
        location: location.trim(),
        description: description.trim(),
        imageUrl: imageUrl ? imageUrl.trim() : '',
        ticketUrl: ticketUrl.trim(),
        source: 'Eventbrite',
        eventId: eventId || '',
        price: price || '',
        paidStatus: paidStatus || '',
        isPromoted: isPromoted || false,
        urgencySignal: urgencySignal || '',
        hasPromoCode: hasPromoCode || false,
        hasBogoLabel: hasBogoLabel || false,
        lastUpdated: new Date(),
      };
    } catch (error) {
      logger.error('Error parsing event', { error: error.message, stack: error.stack });
      return null;
    }
  }
}
