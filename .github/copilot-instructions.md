# Copilot Instructions - جبوري للإلكترونيات

## Architecture Overview

This is an **Arabic RTL e-commerce platform** for electronics, built with React 19 + TypeScript + Vite, using Firebase (Firestore, Auth, Storage) as the backend.

### Core Structure
```
src/
├── components/     # Reusable UI (Header, Footer, ProductCard, DashboardLayout)
├── pages/          # Route-level components (Home, Cart, Login, Dashboard/*)
├── services/       # Firebase/Firestore CRUD operations (firestore.ts)
├── store/          # Zustand global state (useStore.ts)
├── config/         # Firebase initialization (firebase.ts)
├── types/          # TypeScript interfaces (Product, Category, Order, User)
└── styles/         # Global CSS with CSS variables
```

### Two Main Sections
1. **Store** (`/`, `/cart`, `/products`) - Uses `StoreLayout` with Header + Footer
2. **Dashboard** (`/dashboard/*`) - Admin panel using `DashboardLayout` with sidebar navigation

## Key Patterns

### State Management (Zustand)
- Global store in `src/store/useStore.ts` manages: cart (local), user session, products/categories (from Firestore), UI state
- Access via `useStore()` hook: `const { products, addToCart, user } = useStore()`
- Firestore data synced to store using `setProducts()`, `setCategories()`

### Firebase/Firestore Pattern
- Real-time subscriptions using `subscribeToProducts/Categories()` in `useEffect`:
```tsx
useEffect(() => {
  const unsubscribe = subscribeToProducts((products) => setProducts(products));
  return () => unsubscribe();
}, [setProducts]);
```
- CRUD operations in `src/services/firestore.ts` with Timestamp handling
- Auth via `firebase/auth`, storage via `firebase/storage`

### Component Structure
- Each component has its own folder: `ComponentName/ComponentName.tsx` + `.css`
- Dashboard pages in `src/pages/Dashboard/` share common layout via `<Outlet />`
- Use `lucide-react` for all icons

### Styling Conventions
- **Arabic RTL layout**: `direction: rtl` set in globals.css
- Font: `'Tajawal'` (Arabic-optimized)
- CSS variables in `:root` for colors (--primary, --secondary, --danger, etc.)
- Component-scoped CSS files, no CSS modules
- Currency formatted as SAR using `Intl.NumberFormat('ar-SA')`

## TypeScript Types
All types in `src/types/index.ts`:
- `Product`: id, name, nameEn (bilingual), price, oldPrice, category, images[], stock, featured
- `Category`: id, name, nameEn, icon, subcategories[], order
- `Order`: items, status ('pending'|'processing'|'shipped'|'delivered'|'cancelled')
- `User`: role ('customer'|'admin'), addresses[]

## Commands
```bash
npm run dev      # Start dev server (Vite)
npm run build    # TypeScript check + production build
npm run lint     # ESLint
npm run preview  # Preview production build
```

## Important Conventions
- All user-facing text in Arabic
- Admin check: `user?.role === 'admin'` or `useStore().isAdmin()`
- Dashboard protected by redirect to `/login` if no user
- Products have both `name` (Arabic) and `nameEn` (English) fields
- Image handling uses base64 data URLs for uploads
