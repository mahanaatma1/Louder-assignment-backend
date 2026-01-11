# Sydney Events Backend

Backend API for Sydney Events - Event scraping and management system.

## Structure

```
backend/
├── config/
│   └── database.js              # MongoDB connection
├── models/
│   ├── event.model.js          # Event model
│   └── subscription.model.js    # Subscription model
├── controllers/
│   ├── event.controller.js       # Event controller
│   └── subscription.controller.js # Subscription controller
├── routes/
│   ├── event.route.js           # Event routes
│   ├── subscription.route.js    # Subscription routes
│   └── index.js                # Routes index
├── lib/
│   └── scrapers/
│       ├── eventScraper.js     # Base scraper class
│       ├── eventbriteScraper.js # Eventbrite scraper
│       ├── timeoutScraper.js    # TimeOut scraper
│       ├── scraperManager.js    # Scraper manager
│       └── utils.js             # Scraper utilities
├── middleware/
│   ├── errorHandler.js          # Error handling middleware
│   └── validator.js             # Validation middleware
└── utils/
    ├── validation.js            # Validation utilities
    ├── errors.js                # Error handling utilities
    ├── logger.js                # Logger utility
    └── response.js              # Response utilities
```

## Models

### Event Model
- `title` (required) - Event title
- `date` (required) - Event date
- `location` (required) - Event location
- `description` - Event description
- `imageUrl` - Event image URL
- `ticketUrl` (required) - Ticket purchase URL
- `source` - Source website
- `lastUpdated` - Last update timestamp

### Subscription Model
- `email` (required) - User email
- `eventId` (required) - Reference to Event
- `optIn` (required) - Email opt-in preference
- `createdAt` - Creation timestamp

## Controllers

### Event Controller
- `getEvents(req, res)` - Get all events with optional filters
- `getEventById(req, res)` - Get single event by ID
- `scrapeEvents(req, res)` - Scrape and save events

### Subscription Controller
- `createSubscription(req, res)` - Create new subscription
- `getSubscriptions(req, res)` - Get all subscriptions

## Routes

### Event Routes
- `GET /events` - Get all events
  - Query params: `upcoming=true`, `limit=100`
- `GET /events/:id` - Get event by ID
- `POST /events/scrape` - Trigger event scraping

### Subscription Routes
- `POST /subscriptions` - Create subscription
- `GET /subscriptions` - Get all subscriptions

## Scrapers

### Eventbrite Scraper
Scrapes events from Eventbrite Sydney page.

### TimeOut Scraper
Scrapes events from TimeOut Sydney events page.

### Scraper Manager
Coordinates multiple scrapers and removes duplicates.

## Utilities

### Validation
- `isValidEmail(email)` - Validate email format
- `isValidObjectId(id)` - Validate MongoDB ObjectId
- `validateEventData(data)` - Validate event data
- `validateSubscriptionData(data)` - Validate subscription data

### Error Handling
- `APIError` - Custom error class
- `formatErrorResponse(error)` - Format error for response
- `asyncHandler(fn)` - Async error handler wrapper

### Logger
- `logger.error(message, data)`
- `logger.warn(message, data)`
- `logger.info(message, data)`
- `logger.debug(message, data)`

## Usage

This backend is designed to be used with Next.js API routes. The controllers use Express-style req/res objects, which can be adapted for Next.js API routes.

## Environment Variables

- `MONGODB_URI` - MongoDB connection string
- `NODE_ENV` - Environment (development/production)
- `LOG_LEVEL` - Logging level (ERROR/WARN/INFO/DEBUG)

