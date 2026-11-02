# RideMate frontend updates

This package adds four browser-side features without changing backend APIs or database schemas:

1. Vehicle comparison: select up to three marketplace vehicles and compare type, price, brand, year, location, and description.
2. Wishlist/favorites: favorite vehicles from marketplace cards; IDs are stored in browser localStorage and shown in the customer dashboard.
3. Advanced search and filters: brand, minimum/maximum daily price, favorites-only, and sorting by price or name. Existing category and location filters remain.
4. Interactive dashboard: customer booking-status visualization and owner fleet/listing metrics with status visualization, based on currently loaded backend data.

## Setup

- Backend: copy `backend/.env.example` to `backend/.env` and enter your own credentials.
- Use the project's Node version in `backend/.nvmrc`.
- Install dependencies in `backend` and `frontend` with `npm install`.
- Start the backend and frontend using their package scripts.

The wishlist is browser-specific and is not synchronized across devices or accounts. Dashboard figures reflect records returned by the existing backend; they do not represent payment settlement or accounting data.
