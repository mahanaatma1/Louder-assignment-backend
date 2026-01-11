// Event Model

import mongoose from 'mongoose';

const EventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  date: {
    type: Date,
    required: true,
  },
  location: {
    type: String,
    required: true,
    trim: true,
    default: 'Sydney, Australia',
  },
  description: {
    type: String,
    trim: true,
    default: '',
  },
  imageUrl: {
    type: String,
    trim: true,
    default: '',
  },
  ticketUrl: {
    type: String,
    required: true,
    trim: true,
  },
  source: {
    type: String,
    trim: true,
    default: 'Unknown',
  },
  price: {
    type: String,
    trim: true,
    default: '',
  },
  eventId: {
    type: String,
    trim: true,
    default: '',
  },
  paidStatus: {
    type: String,
    trim: true,
    default: '',
  },
  isPromoted: {
    type: Boolean,
    default: false,
  },
  urgencySignal: {
    type: String,
    trim: true,
    default: '',
  },
  hasPromoCode: {
    type: Boolean,
    default: false,
  },
  hasBogoLabel: {
    type: Boolean,
    default: false,
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Indexes for faster queries
EventSchema.index({ date: 1 });
EventSchema.index({ title: 1, date: 1 }, { unique: true });
// Index for eventId lookups (sparse - only indexes documents with eventId)
EventSchema.index({ eventId: 1 }, { sparse: true });
// Index for ticketUrl lookups
EventSchema.index({ ticketUrl: 1 });

const Event = mongoose.models.Event || mongoose.model('Event', EventSchema);

export default Event;

