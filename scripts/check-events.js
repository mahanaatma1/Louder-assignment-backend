/**
 * Check events in database
 */

import dotenv from 'dotenv';
import connectDB from '../config/database.js';
import Event from '../models/event.model.js';

dotenv.config();

async function checkEvents() {
  try {
    await connectDB();
    console.log('Connected to database\n');

    const total = await Event.countDocuments();
    const now = new Date();
    const upcoming = await Event.countDocuments({ date: { $gte: now } });
    const past = await Event.countDocuments({ date: { $lt: now } });

    console.log(`Total events: ${total}`);
    console.log(`Upcoming events (date >= now): ${upcoming}`);
    console.log(`Past events (date < now): ${past}\n`);

    // Show sample events
    const sampleEvents = await Event.find({}).limit(10).sort({ date: 1 }).lean();
    console.log('Sample events (first 10):');
    sampleEvents.forEach((event, index) => {
      const eventDate = new Date(event.date);
      const isUpcoming = eventDate >= now;
      console.log(`${index + 1}. ${event.title}`);
      console.log(`   Date: ${eventDate.toISOString()}`);
      console.log(`   Is Upcoming: ${isUpcoming}`);
      console.log(`   Source: ${event.source}`);
      console.log('');
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkEvents();

