import React, { useEffect, useState } from "react";
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

// Layouts
import Header from "./components/Header/Header";
import Footer from "./components/Footer/Footer";
import DashboardLayout from "./components/DashboardLayout/DashboardLayout";

// Store Pages
import Home from "./pages/Home/Home";
import Cart from "./pages/Cart/Cart";
import Checkout from "./pages/Checkout/Checkout";
import Login from "./pages/Login/Login";
import Register from "./pages/Register/Register";
import ProductsPage from "./pages/Products/Products";
import ProductDetail from "./pages/ProductDetail/ProductDetail";
import Account from "./pages/Account/Account";
import Contact from "./pages/Contact/Contact";
import About from "./pages/About/About";
import ForgotPassword from "./pages/ForgotPassword/ForgotPassword";
import NotFound from "./pages/NotFound/NotFound";
import Privacy from "./pages/Legal/Privacy";
import Shipping from "./pages/Legal/Shipping";
import Returns from "./pages/Legal/Returns";
import FAQ from "./pages/Legal/FAQ";

// Dashboard Pages
import DashboardHome from "./pages/Dashboard/DashboardHome";
import Products from "./pages/Dashboard/Products";
import Categories from "./pages/Dashboard/Categories";
import Orders from "./pages/Dashboard/Orders";
import Customers from "./pages/Dashboard/Customers";
import Analytics from "./pages/Dashboard/Analytics";
import Settings from "./pages/Dashboard/Settings";
import Messages from "./pages/Dashboard/Messages";

// Styles
import "./styles/globals.css";

// Store Layout Component
const StoreLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <>
    <Header />
    <main style={{ minHeight: "60vh" }}>{children}</main>
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
    </Router>
  );
};

export default App;
