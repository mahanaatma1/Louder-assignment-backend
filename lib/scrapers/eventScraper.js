// Base event scraper class

import fetch from 'node-fetch';
import { logger } from '../../utils/logger.js';

export class EventScraper {
  constructor() {
    this.headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    };
  }

  async scrape() {
    throw new Error('Scrape method must be implemented by subclass');
  }

  cleanText(text) {
    if (!text) return '';
    return text.replace(/\s+/g, ' ').trim();
  }

  // parse date string as Sydney time (UTC+10 or UTC+11 for DST)
  // since events are in Sydney, we need to parse them as Sydney local time
  parseDateAsSydneyTime(year, month, day, hour, minute) {
    // Sydney timezone offset: UTC+10 (AEST) or UTC+11 (AEDT)
    const monthStr = String(month + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const hourStr = String(hour).padStart(2, '0');
    const minuteStr = String(minute).padStart(2, '0');
    
    const dateStr = `${year}-${monthStr}-${dayStr}T${hourStr}:${minuteStr}:00+10:00`;
    
    try {
      return new Date(dateStr);
    } catch (e) {
      return new Date(year, month, day, hour, minute, 0, 0);
    }
  }

  parseDate(dateStr) {
    if (!dateStr) return new Date();

    try { 
      const cleaned = dateStr.trim();
      
      let date = new Date(cleaned);
      if (!isNaN(date.getTime())) {
        return date;
      }
      
      // Handle Eventbrite format: "Fri, 23 Jan, 10:00 pm" or "Fri, Jan 23, 10:00 pm"
      const eventbritePattern = /(Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*,\s*(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*,?\s*(\d{1,2}:\d{2})\s*(am|pm)?/i;
      const eventbriteMatch = cleaned.match(eventbritePattern);
      if (eventbriteMatch) {
        const day = eventbriteMatch[2];
        const month = eventbriteMatch[3];
        const time = eventbriteMatch[4];
        const ampm = (eventbriteMatch[5] || '').toLowerCase();
        
        const now = new Date();
        let year = now.getFullYear();
        const monthIndex = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(month.toLowerCase());
        
        if (monthIndex < now.getMonth()) {
          year = year + 1;  
        }
        
        const [hours, minutes] = time.split(':');
        let hour24 = parseInt(hours);
        if (ampm === 'pm' && hour24 < 12) {
          hour24 += 12;
        } else if (ampm === 'am' && hour24 === 12) {
          hour24 = 0;
        }
        
        date = this.parseDateAsSydneyTime(year, monthIndex, parseInt(day), hour24, parseInt(minutes));
        
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
      
      const datePatterns = [
        /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})/i,
        /(\d{4})-(\d{2})-(\d{2})/,
        /(\d{2})\/(\d{2})\/(\d{4})/,
      ];
      
      for (const pattern of datePatterns) {
        const match = cleaned.match(pattern);
        if (match) {
          date = new Date(cleaned);
          if (!isNaN(date.getTime())) {
            return date;
          }
        }
      }
      
      date = new Date(cleaned);
      if (!isNaN(date.getTime())) {
        return date;
      }
      
      return new Date();
    } catch (error) {
      return new Date();
    }
  }

  async fetchPage(url) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const response = await fetch(url, {
        headers: this.headers,
        redirect: 'follow',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        logger.error(`HTTP error for ${url}`, { status: response.status, url });
        return null;
      }
      
      const text = await response.text();
      if (!text || text.length === 0) {
        logger.warn(`Empty response from ${url}`, { url });
        return null;
      }
      
      logger.debug(`Successfully fetched page`, { url, size: text.length });
      return text;
    } catch (error) {
      if (error.name === 'AbortError') {
        logger.error(`Timeout fetching ${url}`, { url, timeout: 30000 });
      } else {
        logger.error(`Error fetching ${url}`, { error: error.message, url, stack: error.stack });
      }
      return null;
    }
  }
}

