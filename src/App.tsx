import React, { useEffect, useState, lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./config/firebase";
import {
  getUserById,
  createOrUpdateUser,
  subscribeToProducts,
  subscribeToCategories,
} from "./services/firestore";
import { useStore } from "./store/useStore";

// Layouts (loaded immediately - small components)
import Header from "./components/Header/Header";
import Footer from "./components/Footer/Footer";

const lazyWithRetry = <T extends React.ComponentType<any>>(
  importer: () => Promise<{ default: T }>,
  chunkKey: string,
) =>
  lazy(async () => {
    const storageKey = `lazy-retry:${chunkKey}`;

    try {
      const module = await importer();
      sessionStorage.removeItem(storageKey);
      return module;
    } catch (error) {
      const alreadyRetried = sessionStorage.getItem(storageKey) === "1";

      if (!alreadyRetried) {
        sessionStorage.setItem(storageKey, "1");
        window.location.reload();
      }

      throw error;
    }
  });

// Lazy loaded components
const DashboardLayout = lazyWithRetry(
  () => import("./components/DashboardLayout/DashboardLayout"),
  "DashboardLayout",
);

// Store Pages - Lazy Loaded
const Home = lazyWithRetry(() => import("./pages/Home/Home"), "Home");
const Cart = lazyWithRetry(() => import("./pages/Cart/Cart"), "Cart");
const Checkout = lazyWithRetry(
  () => import("./pages/Checkout/Checkout"),
  "Checkout",
);
const Login = lazyWithRetry(() => import("./pages/Login/Login"), "Login");
const Register = lazyWithRetry(
  () => import("./pages/Register/Register"),
  "Register",
);
const ProductsPage = lazyWithRetry(
  () => import("./pages/Products/Products"),
  "ProductsPage",
);
const ProductDetail = lazyWithRetry(
  () => import("./pages/ProductDetail/ProductDetail"),
  "ProductDetail",
);
const Account = lazyWithRetry(() => import("./pages/Account/Account"), "Account");
const Contact = lazyWithRetry(() => import("./pages/Contact/Contact"), "Contact");
const About = lazyWithRetry(() => import("./pages/About/About"), "About");
const ForgotPassword = lazyWithRetry(
  () => import("./pages/ForgotPassword/ForgotPassword"),
  "ForgotPassword",
);
const NotFound = lazyWithRetry(
  () => import("./pages/NotFound/NotFound"),
  "NotFound",
);
const Privacy = lazyWithRetry(() => import("./pages/Legal/Privacy"), "Privacy");
const Shipping = lazyWithRetry(() => import("./pages/Legal/Shipping"), "Shipping");
const Returns = lazyWithRetry(() => import("./pages/Legal/Returns"), "Returns");
const FAQ = lazyWithRetry(() => import("./pages/Legal/FAQ"), "FAQ");

// Dashboard Pages - Lazy Loaded
const DashboardHome = lazyWithRetry(
  () => import("./pages/Dashboard/DashboardHome"),
  "DashboardHome",
);
const Products = lazyWithRetry(
  () => import("./pages/Dashboard/Products"),
  "DashboardProducts",
);
const Categories = lazyWithRetry(
  () => import("./pages/Dashboard/Categories"),
  "Categories",
);
const Orders = lazyWithRetry(() => import("./pages/Dashboard/Orders"), "Orders");
const Customers = lazyWithRetry(
  () => import("./pages/Dashboard/Customers"),
  "Customers",
);
const Analytics = lazyWithRetry(
  () => import("./pages/Dashboard/Analytics"),
  "Analytics",
);
const Settings = lazyWithRetry(
  () => import("./pages/Dashboard/Settings"),
  "Settings",
);
const Messages = lazyWithRetry(
  () => import("./pages/Dashboard/Messages"),
  "Messages",
);
const CJProducts = lazyWithRetry(
  () => import("./pages/Dashboard/CJProducts"),
  "CJProducts",
);
const CJOrders = lazyWithRetry(
  () => import("./pages/Dashboard/CJOrders"),
  "CJOrders",
);
const CJSettings = lazyWithRetry(
  () => import("./pages/Dashboard/CJSettings"),
  "CJSettings",
);

// Styles
import "./styles/globals.css";

// Loading Spinner Component
const PageLoader: React.FC = () => (
  <div
    style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      height: "50vh",
      fontSize: "16px",
      color: "var(--gray)",
    }}
  >
    <div
      style={{
        width: "40px",
        height: "40px",
        border: "3px solid #f3f3f3",
        borderTop: "3px solid var(--primary)",
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }}
    />
  </div>
);

// Store Layout Component
const StoreLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <>
    <Header />
    <main style={{ minHeight: "60vh" }}>
      <Suspense fallback={<PageLoader />}>{children}</Suspense>
    </main>
    <Footer />
  </>
);

const App: React.FC = () => {
  const { setUser, setProducts, setCategories } = useStore();
  const [loading, setLoading] = useState(true);

  // الاشتراك المركزي في المنتجات والتصنيفات
  useEffect(() => {
    const unsubProducts = subscribeToProducts((products) =>
      setProducts(products),
    );
    const unsubCategories = subscribeToCategories((categories) =>
      setCategories(categories),
    );
    return () => {
      unsubProducts();
      unsubCategories();
    };
  }, [setProducts, setCategories]);

  // الحفاظ على جلسة المستخدم عند تحديث الصفحة
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // جلب بيانات المستخدم من Firestore
        let userData = await getUserById(firebaseUser.uid);

        if (!userData) {
          // إنشاء مستخدم جديد إذا لم يكن موجود
          userData = {
            id: firebaseUser.uid,
            email: firebaseUser.email || "",
            name: firebaseUser.displayName || "مستخدم",
            role: "customer",
            addresses: [],
            createdAt: new Date(),
          };
          await createOrUpdateUser(userData);
        }

        setUser(userData);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [setUser]);

  // شاشة التحميل
  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          fontSize: "18px",
          color: "var(--gray)",
        }}
      >
        جاري التحميل...
      </div>
    );
  }

  return (
    <Router>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Auth Routes */}
          <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        {/* Dashboard Routes */}
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<DashboardHome />} />
          <Route path="products" element={<Products />} />
          <Route path="categories" element={<Categories />} />
          <Route path="orders" element={<Orders />} />
          <Route path="customers" element={<Customers />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="settings" element={<Settings />} />
          <Route path="messages" element={<Messages />} />
          <Route path="cj-products" element={<CJProducts />} />
          <Route path="cj-orders" element={<CJOrders />} />
          <Route path="cj-settings" element={<CJSettings />} />
        </Route>

        {/* Store Routes */}
        <Route
          path="/"
          element={
            <StoreLayout>
              <Home />
            </StoreLayout>
          }
        />
        <Route
          path="/cart"
          element={
            <StoreLayout>
              <Cart />
            </StoreLayout>
          }
        />
        <Route path="/checkout" element={<Checkout />} />
        <Route
          path="/products"
          element={
            <StoreLayout>
              <ProductsPage />
            </StoreLayout>
          }
        />
        <Route
          path="/product/:id"
          element={
            <StoreLayout>
              <ProductDetail />
            </StoreLayout>
          }
        />
        <Route path="/account" element={<Account />} />
        <Route path="/wishlist" element={<Account />} />
        <Route
          path="/contact"
          element={
            <StoreLayout>
              <Contact />
            </StoreLayout>
          }
        />
        <Route
          path="/about"
          element={
            <StoreLayout>
              <About />
            </StoreLayout>
          }
        />

        {/* Legal Pages */}
        <Route
          path="/privacy"
          element={
            <StoreLayout>
              <Privacy />
            </StoreLayout>
          }
        />
        <Route
          path="/shipping"
          element={
            <StoreLayout>
              <Shipping />
            </StoreLayout>
          }
        />
        <Route
          path="/returns"
          element={
            <StoreLayout>
              <Returns />
            </StoreLayout>
          }
        />
        <Route
          path="/faq"
          element={
            <StoreLayout>
              <FAQ />
            </StoreLayout>
          }
        />

        {/* 404 */}
        <Route
          path="*"
          element={
            <StoreLayout>
              <NotFound />
            </StoreLayout>
          }
        />
        </Routes>
      </Suspense>
    </Router>
  );
};

export default App;
