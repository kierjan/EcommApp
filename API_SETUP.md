# API Setup

This project now includes a backend scaffold for marketplace integrations.

## Goal

Use a backend for:

- Shopee API credentials and signing
- Lazada API credentials and tokens
- future marketplace sync jobs
- writing normalized orders into Firestore

## Why a backend is required

Marketplace secrets should not be stored in the browser.

The current frontend remains the order dashboard.
The backend is where we will connect:

- Shopee
- Lazada
- future TikTok integration if needed

## Backend folder

- `backend/package.json`
- `backend/.env.example`
- `backend/src/server.js`
- `backend/src/config.js`
- `backend/src/lib/normalize-order.js`
- `backend/src/connectors/shopee.js`
- `backend/src/connectors/lazada.js`
- `backend/src/services/firestore-admin.js`

## What is already prepared

- health endpoint scaffold
- sync route scaffold
- marketplace connector placeholders
- normalized order shape for importing marketplace orders
- Firestore admin write placeholder

## Next steps

1. Install Node.js on the machine.
2. Run `npm install` inside `backend`.
3. Copy `.env.example` to `.env`.
4. Add Firebase Admin service-account credentials.
5. Add Shopee credentials.
6. Add Lazada credentials.
7. Start with Shopee sync first.

## Planned endpoints

- `GET /health`
- `POST /sync/shopee`
- `POST /sync/lazada`

## Current status

This is a scaffold only.
It is not live yet because this environment does not currently have a working local Node runtime.
