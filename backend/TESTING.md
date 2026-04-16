# Testing Strategy

This project was tested using a combination of manual QA, exploratory testing, and AI-assisted testing workflows.

## Manual QA
Core user flows were validated manually across the storefront, cart, checkout, authentication, and profile-related features.

## Exploratory Testing
Exploratory testing was used to uncover unexpected behavior across state-dependent flows, including:
- cart persistence after refresh
- login/logout transitions
- guest-to-user cart behavior
- checkout access and redirect logic
- gift option state handling

## AI-Assisted Testing
AI was used as a testing assistant to:
- generate edge-case scenarios
- simulate unusual user behavior
- identify state-transition risks
- validate conversational assistant responses
- expand exploratory test coverage for cart, checkout, and AI-driven flows

## Areas Tested

### Cart
- add/remove items
- update quantity
- refresh page cart persistence
- guest cart and authenticated cart behavior
- gift option toggle and persistence

### Checkout
- empty cart redirect
- shipping form validation
- refresh during checkout
- payment intent creation
- order summary accuracy

### Authentication
- login/logout transitions
- token persistence and expiration handling
- protected routes

### Lumière Assistant
- product recommendation relevance
- gift-related questions
- stock awareness
- conversational memory
- alignment with store policies


## Production Debugging & Fixes

### Cart Persistence Issue (Railway)

A production issue was identified where cart items were lost after page refresh.

**Root cause:**  
The deployed Railway database schema was out of sync with the application code.  
The backend had been updated to use a variant-based cart model, while the production database still reflected the legacy candle-based structure.

**Resolution:**  
The cart tables were reset and migrations were reapplied in the Railway environment to align the database schema with the current application model.

**Result:**  
Cart persistence was fully restored across refreshes and authenticated sessions.