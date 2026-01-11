/**
 * Test script to verify scraping works
 * Run with: node scripts/test-scraper.js
 */

import dotenv from 'dotenv';
import { ScraperManager } from '../lib/scrapers/scraperManager.js';
import connectDB from '../config/database.js';
import Event from '../models/event.model.js';

dotenv.config();

async function testScraper() {
  try {
    console.log('Connecting to database...');
    await connectDB();
    console.log('✓ Database connected');

    console.log('\nStarting scraper test...');
    const scraperManager = new ScraperManager();
    const events = await scraperManager.scrapeAll();

    console.log(`\n✓ Scraped ${events.length} events`);

    if (events.length > 0) {
      console.log('\nFirst event sample:');
      console.log(JSON.stringify(events[0], null, 2));

      console.log('\nSaving to database...');
      let saved = 0;
      for (const eventData of events.slice(0, 5)) {
        try {
          const eventDate = eventData.date instanceof Date 
            ? eventData.date 
            : new Date(eventData.date);

          const startOfDay = new Date(eventDate);
          startOfDay.setHours(0, 0, 0, 0);
          const endOfDay = new Date(eventDate);
          endOfDay.setHours(23, 59, 59, 999);

          const existing = await Event.findOne({
            title: { $regex: new RegExp(`^${eventData.title.trim()}$`, 'i') },
            date: { $gte: startOfDay, $lte: endOfDay },
          });

          if (existing) {
            await Event.updateOne({ _id: existing._id }, { $set: { ...eventData, date: eventDate } });
            console.log(`  Updated: ${eventData.title}`);
          } else {
            await Event.create({ ...eventData, date: eventDate });
            console.log(`  Created: ${eventData.title}`);
            saved++;
          }
        } catch (error) {
          console.error(`  Error saving ${eventData.title}:`, error.message);
        }
      }

      console.log(`\n✓ Saved ${saved} events to database`);
      
      const totalInDB = await Event.countDocuments();
      console.log(`\nTotal events in database: ${totalInDB}`);
    } else {
      console.log('\n⚠ No events scraped. Check the scraper selectors.');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testScraper();

