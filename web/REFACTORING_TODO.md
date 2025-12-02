# Code Refactoring TODO

## Phase 1: Modularization (Week 1)

### Objectives
- Break down 2754-line monolithic file into modular structure
- Improve code maintainability and testability
- Separate concerns (routes, middleware, utilities)

### Tasks
- [ ] Extract route handlers to `web/routes/` folder
  - [ ] `web/routes/products.js` - Product-related endpoints
  - [ ] `web/routes/variants.js` - Variant management endpoints
  - [ ] `web/routes/billing.js` - Billing API endpoints
  - [ ] `web/routes/analyze.js` - Image analysis endpoints
  - [ ] `web/routes/images.js` - Image upload/management endpoints
- [ ] Create `web/middleware/` folder
  - [ ] `web/middleware/auth.js` - Authentication middleware
  - [ ] `web/middleware/error-handler.js` - Error handling middleware
  - [ ] `web/middleware/validation.js` - Request validation middleware
  - [ ] `web/middleware/logging.js` - Request logging middleware
- [ ] Move utility functions to `web/utils/`
  - [ ] `web/utils/shopify.js` - Shopify API helpers
  - [ ] `web/utils/openai.js` - OpenAI integration helpers
  - [ ] `web/utils/helpers.js` - General utility functions
  - [ ] `web/utils/color.js` - Color normalization/processing utilities

### Expected Structure
```
web/
  ├── index.js (main entry point - ~200 lines, app initialization only)
  ├── routes/
  │   ├── index.js (route aggregator)
  │   ├── products.js
  │   ├── variants.js
  │   ├── billing.js
  │   ├── analyze.js
  │   └── images.js
  ├── middleware/
  │   ├── index.js (middleware aggregator)
  │   ├── auth.js
  │   ├── error-handler.js
  │   ├── validation.js
  │   └── logging.js
  └── utils/
      ├── index.js (utils aggregator)
      ├── shopify.js
      ├── openai.js
      ├── helpers.js
      └── color.js
```

### Benefits
- Each file < 500 lines (maintainable)
- Clear separation of concerns
- Easier to test individual modules
- Better code reusability

---

## Phase 2: Database (Week 2)

### Objectives
- Migrate from SQLite to PostgreSQL for Railway compatibility
- Improve database performance and scalability
- Implement proper session storage

### Tasks
- [ ] Set up PostgreSQL database on Railway
  - [ ] Create PostgreSQL service
  - [ ] Configure DATABASE_URL environment variable
- [ ] Update Prisma schema
  - [ ] Change provider from `sqlite` to `postgresql`
  - [ ] Update data types if needed
  - [ ] Add indexes for performance
- [ ] Run Prisma migrations
  - [ ] `prisma migrate dev` for initial schema
  - [ ] `prisma migrate deploy` for production
- [ ] Add database connection pooling
  - [ ] Configure Prisma connection pool size
  - [ ] Add connection retry logic
- [ ] Implement proper session storage
  - [ ] Use PostgreSQL for session storage instead of memory
  - [ ] Configure express-session with PostgreSQL store
  - [ ] Add session cleanup job

### Migration Steps
1. Backup SQLite database
2. Generate Prisma schema for PostgreSQL
3. Test migration locally
4. Deploy to staging environment
5. Migrate production data
6. Switch production to PostgreSQL
7. Remove SQLite files

### Benefits
- Railway-compatible (ephemeral storage works)
- Better concurrent connection handling
- Scalable for production workloads
- Persistent session storage

---

## Phase 3: Testing (Week 3)

### Objectives
- Add comprehensive test coverage
- Ensure code reliability
- Enable continuous integration

### Tasks
- [ ] Set up testing framework
  - [ ] Install Jest + Supertest
  - [ ] Configure test scripts in package.json
  - [ ] Set up test environment variables
- [ ] Write unit tests
  - [ ] Test utility functions (`web/utils/*.js`)
  - [ ] Test middleware functions (`web/middleware/*.js`)
  - [ ] Test color normalization logic
  - [ ] Test Shopify API helpers
  - [ ] Test OpenAI integration helpers
- [ ] Write integration tests
  - [ ] Test API endpoints (`web/routes/*.js`)
  - [ ] Test authentication flow
  - [ ] Test product creation flow
  - [ ] Test variant creation flow
  - [ ] Test image analysis flow
  - [ ] Test error handling
- [ ] Add test coverage reporting
  - [ ] Configure coverage thresholds
  - [ ] Add coverage badge to README
- [ ] Set up CI/CD with tests
  - [ ] GitHub Actions workflow
  - [ ] Run tests on every PR
  - [ ] Block merge if tests fail

### Test Structure
```
web/
  ├── __tests__/
  │   ├── utils/
  │   │   ├── shopify.test.js
  │   │   ├── openai.test.js
  │   │   └── helpers.test.js
  │   ├── middleware/
  │   │   ├── auth.test.js
  │   │   └── error-handler.test.js
  │   └── routes/
  │       ├── products.test.js
  │       ├── variants.test.js
  │       └── billing.test.js
```

### Benefits
- Catch bugs early
- Prevent regressions
- Increase confidence in code changes
- Enable refactoring with safety net

---

## Phase 4: Monitoring (Week 4)

### Objectives
- Implement comprehensive error tracking
- Add structured logging
- Monitor application performance

### Tasks
- [ ] Add Sentry.io error tracking
  - [ ] Install @sentry/node
  - [ ] Configure Sentry DSN
  - [ ] Add error tracking middleware
  - [ ] Add context to errors (user, shop, request)
  - [ ] Set up alerts for critical errors
- [ ] Implement structured logging
  - [ ] Choose logging library (Winston/Pino)
  - [ ] Replace console.log with structured logger
  - [ ] Add log levels (info, warn, error, debug)
  - [ ] Add request correlation IDs
  - [ ] Configure log rotation
- [ ] Add performance monitoring
  - [ ] Track API endpoint response times
  - [ ] Monitor database query performance
  - [ ] Track OpenAI API call latency
  - [ ] Monitor memory usage
  - [ ] Set up performance alerts
- [ ] Set up dashboards
  - [ ] Railway metrics dashboard
  - [ ] Sentry error dashboard
  - [ ] Custom performance dashboard

### Logging Structure
```javascript
// Example structured log
logger.info('API request', {
  method: req.method,
  path: req.path,
  statusCode: res.statusCode,
  duration: duration,
  shop: req.query.shop,
  correlationId: req.correlationId
});
```

### Benefits
- Quick error identification
- Performance bottleneck detection
- Better debugging in production
- Proactive issue resolution

---

## Priority Summary

### Critical (Do First)
- ✅ Phase 1: Modularization (improves maintainability)

### High Priority
- 🔄 Phase 2: Database migration (required for Railway stability)

### Medium Priority
- ⏳ Phase 3: Testing (improves code quality)

### Low Priority
- ⏳ Phase 4: Monitoring (improves observability)

---

## Notes

- Each phase should be completed before moving to the next
- All changes should be backward compatible
- Test thoroughly before deploying to production
- Document all changes in commit messages
- Update README.md with new structure

---

**Created:** 2 Aralık 2025  
**Last Updated:** 2 Aralık 2025  
**Status:** Planning Phase

