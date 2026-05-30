# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Jabori Electronics (جبوري للإلكترونيات) — an Arabic-first RTL e-commerce platform built with React 19 + TypeScript + Firebase, supporting multiple dropshipping suppliers (CJ Dropshipping, Yakkyofy) and payment gateways (PayPal, Tabby, Tamara).

## Commands

### Frontend
```bash
npm run dev        # Start Vite dev server with HMR
npm run build      # tsc -b && vite build (output: dist/)
npm run lint       # ESLint check
npm run preview    # Preview production build locally
```

### Backend (Cloud Functions)
```bash
cd functions
npm run build        # Compile TypeScript → lib/
npm run build:watch  # Watch mode
npm run serve        # Build + start Firebase emulator
npm run deploy       # Deploy Cloud Functions only
npm run logs         # Stream Cloud Function logs
```

### Firebase Deployment
```bash
firebase deploy --only hosting    # Deploy frontend
firebase deploy --only functions  # Deploy Cloud Functions
```

## Architecture

The app is split into two halves sharing a single React SPA:

**Customer store** — routes `/`, `/products`, `/product/:id`, `/cart`, `/checkout`, `/account`, `/login`, `/register`, `/contact`, `/about`, and legal pages. Wrapped in `StoreLayout` (Header + Footer).

**Admin dashboard** — routes `/dashboard/*`. Protected by `user?.role === 'admin'` check with redirect to `/login`. Uses `DashboardLayout` (sidebar + outlet). Contains ~30 pages covering products, orders, customers, analytics, settings, and per-supplier management panels.

### State & Data Flow

- **Zustand** (`src/store/useStore.ts`) — single store for cart, wishlist, user, products, categories, and UI state. Cart and wishlist persist to `localStorage`. Products and categories are synced via Firestore real-time listeners on app mount.
- **Firestore** — source of truth for all persistent data. Real-time subscriptions use the pattern: `useEffect(() => { const unsub = subscribeTo...(data => setState(data)); return () => unsub(); }, [])`.
- **Firebase Auth** — email/password + Google OAuth. User role (`customer` | `admin`) is stored as a field in Firestore, not in Auth claims.

### Services (`src/services/`)

Each file wraps a single external integration:
- `firestore.ts` — all Firestore CRUD (products, orders, users, categories)
- `storage.ts` — Firebase Storage uploads
- `paypal.ts`, `cjDropshipping.ts`, `yakkyofy.ts`, `tabby.ts`, `tamara.ts` — payment and dropshipping API clients
- `m5azn.ts` — WooCommerce REST API wrapper (for m5azn integration)
- `productScraper.ts` / `scraperService.ts` — Amazon and external product scraping

### Cloud Functions (`functions/src/index.ts`)

All function entry points live in one file. Supporting clients are in sibling files (`cjClient.ts`, `paypalClient.ts`, etc.). Key function groups:
- **Payment**: `paypalCreateOrder`, `paypalCaptureOrder`, `paypalGetOrderStatus`
- **CJ Dropshipping**: search, product detail, variants, order create/confirm/track, `cjSyncOrderStatuses`, `cjImageProxy` (CORS proxy)
- **WooCommerce compatibility**: `wcApi` HTTP function serves `/wp-json/**` routes
- **Triggers**: `onOrderCreated` auto-forwards orders to CJ when `autoForwardOrders: true` in settings
- **Email**: `sendOrderConfirmationEmail`, `sendOrderStatusUpdateEmail` via Nodemailer

### Routing & Code Splitting

`src/App.tsx` defines all ~40 routes. Pages are lazy-loaded using a `lazyWithRetry` wrapper that retries failed dynamic imports (chunk load failures). Firebase project is `jabouri-digital-library` (`.firebaserc`).

## Key Conventions

- **All user-facing text is in Arabic.** Products always have both `name` (Arabic) and `nameEn` (English) fields.
- **Currency**: SAR displayed with `Intl.NumberFormat('ar-SA')`. PayPal processes in USD at a 0.27 conversion rate.
- **RTL**: Enforced globally via CSS. Font is Tajawal (Google Fonts).
- **Admin check**: `user?.role === 'admin'` or `useStore().isAdmin()`.
- **Image uploads**: Firebase Storage. CJ product images are proxied via the `cjImageProxy` Cloud Function to avoid CORS.
- **PayPal is in live mode** — not sandbox.

## Data Models (Key Fields)

**Product**: `name` (ar), `nameEn`, `price`, `oldPrice`, `category`, `subcategory`, `images[]`, `stock`, `hasVariants`, `variants[]`. CJ products additionally carry `isCJProduct`, `cjProductId`, `cjSku`, `cjSourcePrice`.

**Order**: `status` (pending → processing → shipped → delivered → cancelled), `paymentStatus` (pending → paid), `paypalOrderId`, `paypalCaptureId`. CJ orders add `isCJOrder`, `cjOrderId`, `cjOrderNum`, `trackingNumber`.

**Category**: `name` (ar), `nameEn`, `icon` (Lucide icon name), `subcategories[]`, `order` (sort index).

## Environment

Copy `.env.example` to `.env` and fill in Firebase config keys + PayPal client ID before running locally. Firebase emulator (`npm run serve` in `functions/`) is used for local function development.
