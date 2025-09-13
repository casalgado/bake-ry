# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `npm run dev` - Start development server with nodemon
- `npm run serve` - Start Firebase emulators (functions, firestore, auth)

### Testing
- `npm test` - Run all tests with jest
- `npm run test:silent` - Run tests without output
- `npm run test:watch` - Run tests in watch mode

**Important:** Always ask for user permission before running any test commands.

### Deployment
- `npm run deploy` - Deploy functions to Firebase

### Seeding Data
- `npm run seed:setup` - Seed initial bakery setup
- `npm run seed:setup-pastellus` - Seed Pastellus bakery
- `npm run seed:setup-diana_lee` - Seed Diana Lee bakery
- `npm save:backup` - Create data backup

### Utilities
- `npm run logs` - View Firebase function logs

## Architecture

### Core Patterns

This is a Firebase Functions Express.js API for a bakery management system with a factory pattern architecture:

1. **Factory Pattern**: Controllers and services are created using factory functions
   - `src/controllers/base/controllerFactory.js` - Creates standardized CRUD controllers
   - `src/services/base/serviceFactory.js` - Creates standardized Firestore services

2. **Base Model System**: All models extend `BaseModel` which provides:
   - Automatic date field handling
   - Firestore serialization/deserialization
   - Common field management (id, createdAt, updatedAt)

3. **Multi-tenant Architecture**: Resources are scoped by bakery ID
   - Routes: `/bakeries/:bakeryId/products`
   - Collections: `bakeries/{bakeryId}/products`

### Authentication & Authorization

Role-based access control with middleware in `src/middleware/userAccess.js`:
- `system_admin` - Full system access
- `bakery_admin` - Bakery management
- `bakery_staff` - Operations
- `delivery_assistant`, `production_assistant`, `accounting_assistant` - Specialized roles

Each route uses appropriate middleware:
- `authenticateUser` - Verify Firebase token
- `hasBakeryAccess` - Verify bakery access permissions
- Role-specific middleware for operations

### Query System

Advanced query parsing via `QueryParser`:
- Pagination: `?page=1&per_page=10`
- Sorting: `?sort=createdAt` or `?sort=-createdAt`
- Date ranges: `?start_date=2024-01-01&end_date=2024-12-31`
- OR date ranges: `?or_date_fields=createdAt,updatedAt&or_start_date=2024-01-01`
- Filters: `?status=active&isDeleted=false`

### Data History

All model updates automatically track change history:
- Each document has an `updateHistory` subcollection
- Records editor information, timestamp, and field changes
- Implemented via transactions in service factory

### Key Domain Models

- **User** - System users with roles and bakery associations
- **Bakery** - Multi-tenant bakery entities
- **Product** - Bakery products with recipes and pricing
- **Order** - Customer orders with items and status tracking
- **Recipe** - Product recipes with ingredients and versioning
- **PayuCard/PayuTransaction** - Payment processing integration

### Testing Strategy

Jest configuration in `jest.config.js`:
- Tests in `src/__tests__/` mirroring source structure
- Setup files in `src/__tests__/setup/`
- Coverage reporting enabled
- Firebase emulator integration for testing

### Error Handling

Custom error classes in `src/utils/errors.js`:
- `BadRequestError` (400)
- `NotFoundError` (404) 
- `ForbiddenError` (403)
- `AuthenticationError` (401)

Controllers use factory-generated error handling that maps these to appropriate HTTP responses.