import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Product, CartItem, User, Category } from "../types";

interface StoreState {
  // Cart (يبقى محلي لأنه خاص بالمستخدم الحالي)
  cart: CartItem[];
  addToCart: (product: Product & { selectedVariants?: Record<string, string> }, quantity?: number) => void;
  removeFromCart: (productId: string, selectedVariants?: Record<string, string>) => void;
  updateQuantity: (productId: string, quantity: number, selectedVariants?: Record<string, string>) => void;
  clearCart: () => void;
  getCartTotal: () => number;
  getCartCount: () => number;

  // User (يبقى محلي للجلسة الحالية)
  user: User | null;
  setUser: (user: User | null) => void;
  isAdmin: () => boolean;

  // Categories (من Firestore)
  categories: Category[];
  setCategories: (categories: Category[]) => void;

  // Products (من Firestore)
  products: Product[];
  setProducts: (products: Product[]) => void;
  productsLoaded: boolean;

  // Wishlist (المفضلة)
  wishlist: string[];
  toggleWishlist: (productId: string) => void;
  isInWishlist: (productId: string) => boolean;
  clearWishlist: () => void;

  // UI
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      // Cart
      cart: [],
      addToCart: (product, quantity = 1) => {
        const cart = get().cart;
        const { selectedVariants, ...productData } = product;
        
        // دالة للمقارنة بين المتغيرات المختارة
        const variantsMatch = (v1?: Record<string, string>, v2?: Record<string, string>) => {
          if (!v1 && !v2) return true;
          if (!v1 || !v2) return false;
          const keys1 = Object.keys(v1);
          const keys2 = Object.keys(v2);
          if (keys1.length !== keys2.length) return false;
          return keys1.every(key => v1[key] === v2[key]);
        };
        
        const existing = cart.find(
          (item) => item.product.id === productData.id && variantsMatch(item.selectedVariants, selectedVariants)
        );

        if (existing) {
          set({
            cart: cart.map((item) =>
              item.product.id === productData.id && variantsMatch(item.selectedVariants, selectedVariants)
                ? { ...item, quantity: item.quantity + quantity }
                : item,
            ),
          });
        } else {
          set({ cart: [...cart, { product: productData as Product, quantity, selectedVariants }] });
        }
      },
      removeFromCart: (productId, selectedVariants) => {
        const variantsMatch = (v1?: Record<string, string>, v2?: Record<string, string>) => {
          if (!v1 && !v2) return true;
          if (!v1 || !v2) return false;
          const keys1 = Object.keys(v1);
          const keys2 = Object.keys(v2);
          if (keys1.length !== keys2.length) return false;
          return keys1.every(key => v1[key] === v2[key]);
        };
        
        set({
          cart: get().cart.filter(
            (item) => !(item.product.id === productId && variantsMatch(item.selectedVariants, selectedVariants))
          ),
        });
      },
      updateQuantity: (productId, quantity, selectedVariants) => {
        if (quantity <= 0) {
          get().removeFromCart(productId, selectedVariants);
          return;
        }
        
        const variantsMatch = (v1?: Record<string, string>, v2?: Record<string, string>) => {
          if (!v1 && !v2) return true;
          if (!v1 || !v2) return false;
          const keys1 = Object.keys(v1);
          const keys2 = Object.keys(v2);
          if (keys1.length !== keys2.length) return false;
          return keys1.every(key => v1[key] === v2[key]);
        };
        
        set({
          cart: get().cart.map((item) =>
            item.product.id === productId && variantsMatch(item.selectedVariants, selectedVariants)
              ? { ...item, quantity }
              : item,
          ),
        });
      },
      clearCart: () => set({ cart: [] }),
      getCartTotal: () => {
        return get().cart.reduce(
          (total, item) => total + item.product.price * item.quantity,
          0,
        );
      },
      getCartCount: () => {
        return get().cart.reduce((count, item) => count + item.quantity, 0);
      },

      // User
      user: null,
      setUser: (user) => set({ user }),
      isAdmin: () => get().user?.role === "admin",

      // Categories
      categories: [],
      setCategories: (categories) => set({ categories }),

      // Products
      products: [],
      setProducts: (products) => set({ products, productsLoaded: true }),
      productsLoaded: false,

      // Wishlist
      wishlist: [],
      toggleWishlist: (productId) => {
        const wishlist = get().wishlist;
        if (wishlist.includes(productId)) {
          set({ wishlist: wishlist.filter((id) => id !== productId) });
        } else {
          set({ wishlist: [...wishlist, productId] });
        }
      },
      isInWishlist: (productId) => get().wishlist.includes(productId),
      clearWishlist: () => set({ wishlist: [] }),

      // UI
      sidebarOpen: true,
      toggleSidebar: () => set({ sidebarOpen: !get().sidebarOpen }),
      searchQuery: "",
      setSearchQuery: (query) => set({ searchQuery: query }),
    }),
    {
      name: "jabory-store",
      partialize: (state) => ({ cart: state.cart, wishlist: state.wishlist }),
    },
  ),
);
