# Copilot Instructions - جبوري للإلكترونيات

## Architecture Overview

This is an **Arabic RTL e-commerce platform** for electronics, built with React 19 + TypeScript + Vite 7.3, using Firebase (Firestore, Auth, Storage, Functions) as the backend.

### Tech Stack
- **Frontend**: React 19 + TypeScript + Vite 7.3
- **Backend**: Firebase Functions (Node.js 20)
- **Database**: Firestore
- **Auth**: Firebase Authentication (Email + Google)
- **Storage**: Firebase Storage (for images)
- **Payments**: PayPal (Live mode, USD currency)
- **Dropshipping**: CJ Dropshipping API integration
- **State Management**: Zustand (with localStorage persistence)
- **Styling**: CSS with CSS variables, RTL layout
- **Font**: Tajawal (Arabic-optimized)

### Core Structure
```
src/
├── components/     # Reusable UI components
│   ├── Header/           # Site header with search, cart, user menu
│   ├── Footer/           # Site footer with social links
│   ├── ProductCard/      # Product display card
│   ├── DashboardLayout/  # Admin dashboard layout with sidebar
│   ├── PayPalCardForm/   # PayPal payment form
│   └── ErrorBoundary/    # Error handling component
├── pages/          # Route-level components
│   ├── Home/             # Landing page with featured products
│   ├── Products/         # Product listing with filters
│   ├── ProductDetail/    # Single product page
│   ├── Cart/             # Shopping cart
│   ├── Checkout/         # Checkout with payment options
│   ├── Login/            # Login page (email + Google)
│   ├── Register/         # Registration page
│   ├── Account/          # User account (profile, orders, addresses)
│   ├── Contact/          # Contact form
│   ├── About/            # About page
│   ├── ForgotPassword/   # Password reset
│   ├── Legal/            # Privacy, Shipping, Returns, FAQ
│   ├── NotFound/         # 404 page
│   └── Dashboard/        # Admin pages (see below)
├── services/       # Firebase/API operations
│   ├── firestore.ts      # Firestore CRUD operations
│   ├── storage.ts        # Firebase Storage uploads
│   ├── paypal.ts         # PayPal integration
│   ├── cjDropshipping.ts # CJ Dropshipping API
│   ├── apiIntegration.ts # External API helpers
│   └── productScraper.ts # Product scraping utilities
├── store/          # Zustand global state
│   └── useStore.ts       # Cart, user, products, wishlist, UI state
├── config/         # Firebase initialization
│   └── firebase.ts
├── types/          # TypeScript interfaces
│   └── index.ts          # Product, Category, Order, User, CartItem
└── styles/         # Global CSS with CSS variables
    └── globals.css

functions/
├── src/
│   ├── index.ts          # All Cloud Functions
│   ├── cjClient.ts       # CJ Dropshipping API client
│   └── paypalClient.ts   # PayPal API client
└── lib/                  # Compiled JS output
```

## Two Main Sections

### 1. Store (Customer-facing)
Routes: `/`, `/products`, `/product/:id`, `/cart`, `/checkout`, `/account`, `/login`, `/register`, `/contact`, `/about`, `/privacy`, `/shipping`, `/returns`, `/faq`

Uses `StoreLayout` pattern with Header + Footer.

### 2. Dashboard (Admin Panel)
Routes: `/dashboard/*` - Protected, requires `user.role === 'admin'`

| Page | Route | Purpose |
|------|-------|---------|
| DashboardHome | `/dashboard` | Stats, analytics overview |
| Products | `/dashboard/products` | Product CRUD |
| Categories | `/dashboard/categories` | Category management |
| Orders | `/dashboard/orders` | Order management with status updates |
| Customers | `/dashboard/customers` | Customer management |
| Analytics | `/dashboard/analytics` | Sales analytics |
| Settings | `/dashboard/settings` | Store settings |
| Messages | `/dashboard/messages` | Customer messages |
| CJProducts | `/dashboard/cj-products` | Import from CJ Dropshipping |
| CJOrders | `/dashboard/cj-orders` | CJ order management |
| CJSettings | `/dashboard/cj-settings` | CJ API configuration |

## Key Patterns

### State Management (Zustand)
```tsx
const useStore = create((set, get) => ({
  // Cart (persisted to localStorage)
  cart: CartItem[],
  addToCart(product, quantity?),
  removeFromCart(productId),
  updateQuantity(productId, quantity),
  clearCart(),
  getCartTotal(),
  getCartCount(),

  // User
  user: User | null,
  setUser(user),
  isAdmin() → boolean,

  // Products & Categories (synced from Firestore)
  products: Product[],
  setProducts(products),
  categories: Category[],
  setCategories(categories),

  // Wishlist (persisted to localStorage)
  wishlist: string[],
  toggleWishlist(productId),
  isInWishlist(productId),

  // UI State
  sidebarOpen: boolean,
  toggleSidebar(),
  searchQuery: string,
  setSearchQuery(query),
}))
```

### Firebase/Firestore Pattern
Real-time subscriptions using `subscribeToProducts/Categories/Orders()`:
```tsx
useEffect(() => {
  const unsubscribe = subscribeToProducts((products) => setProducts(products));
  return () => unsubscribe();
}, [setProducts]);
```

### Payment System (PayPal)
- **Mode**: Live (production)
- **Currency**: USD (SAR converted at 0.27 rate)
- **Flow**: SDK Card buttons → createPayPalOrder → capturePayPalOrder
- **Fields tracked**: `paymentStatus: "pending" | "paid"`, `paypalOrderId`, `paypalCaptureId`, `paidAt`

### CJ Dropshipping Integration
- **API Client**: `functions/src/cjClient.ts`
- **Product Import**: Search CJ → Import with markup → Auto-forward orders
- **Order Flow**: Customer order → Auto-create CJ order → Track shipping
- **Settings**: `defaultMarkup`, `usdToSar`, `autoForwardOrders`, `defaultWarehouse`

## Firebase Functions

### PayPal Functions
| Function | Type | Purpose |
|----------|------|---------|
| `paypalCreateOrder` | onCall | Create PayPal order |
| `paypalCaptureOrder` | onCall | Capture payment |
| `paypalGetOrderStatus` | onCall | Check order status |

### CJ Dropshipping Functions
| Function | Type | Purpose |
|----------|------|---------|
| `cjTestConnection` | onCall | Test API connection |
| `cjSearchProducts` | onCall | Search CJ products |
| `cjGetProductDetail` | onCall | Get product details |
| `cjGetProductVariants` | onCall | Get product variants |
| `cjCreateOrder` | onCall | Create CJ order |
| `cjConfirmOrder` | onCall | Confirm CJ order |
| `cjGetTracking` | onCall | Get tracking info |
| `cjSyncOrderStatuses` | onCall | Sync order statuses |
| `cjImageProxy` | onRequest | Proxy CJ images |

### Firestore Triggers
| Function | Type | Purpose |
|----------|------|---------|
| `onOrderCreated` | onCreate | Auto-forward order to CJ |

## TypeScript Types

### Product
```typescript
interface Product {
  id: string;
  name: string;           // Arabic
  nameEn: string;         // English
  description: string;
  price: number;
  oldPrice?: number;
  category: string;
  subcategory?: string;
  images: string[];
  stock: number;
  featured: boolean;
  specs?: Record<string, string>;
  // CJ fields
  isCJProduct?: boolean;
  cjProductId?: string;
  cjVariantId?: string;
  cjSourcePrice?: number;
  supplierPrice?: number;
  profitMargin?: number;
}
```

### Order
```typescript
interface FirestoreOrder {
  id: string;
  userId?: string;
  customer: string;
  email: string;
  phone: string;
  items: OrderItem[];
  total: number;
  subtotal?: number;
  shippingCost?: number;
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
  paymentMethod: string;
  paymentStatus?: "pending" | "paid";
  paypalOrderId?: string;
  paypalCaptureId?: string;
  paidAt?: Date;
  shippingAddress: string;
  address?: AddressDetails;
  notes?: string;
  // CJ fields
  isCJOrder?: boolean;
  cjOrderId?: string;
  cjOrderNum?: string;
  trackingNumber?: string;
  trackingUrl?: string;
}
```

### Category
```typescript
interface Category {
  id: string;
  name: string;           // Arabic
  nameEn: string;         // English
  icon: string;           // Lucide icon name
  subcategories?: Subcategory[];
  order: number;
}
```

### User
```typescript
interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: "customer" | "admin";
  addresses?: Address[];
}
```

## Commands
```bash
npm run dev      # Start dev server (Vite)
npm run build    # TypeScript check + production build
npm run lint     # ESLint
npm run preview  # Preview production build

# Firebase
firebase deploy --only hosting    # Deploy frontend
firebase deploy --only functions  # Deploy Cloud Functions
firebase functions:log            # View function logs
```

## Environment Variables

### Frontend (.env)
```
VITE_PAYPAL_CLIENT_ID=<paypal-live-client-id>
```

### Functions (functions/.env)
```
PAYPAL_CLIENT_ID=<paypal-live-client-id>
PAYPAL_SECRET=<paypal-live-secret>
PAYPAL_MODE=live
```

## Important Conventions
- All user-facing text in **Arabic**
- Admin check: `user?.role === 'admin'` or `useStore().isAdmin()`
- Dashboard protected by redirect to `/login` if no user
- Products have both `name` (Arabic) and `nameEn` (English) fields
- Currency formatted as SAR: `Intl.NumberFormat('ar-SA')`
- Image uploads use Firebase Storage (base64 data URLs)
- RTL layout: `direction: rtl` in globals.css
