import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Layouts
import Header from './components/Header/Header';
import Footer from './components/Footer/Footer';
import DashboardLayout from './components/DashboardLayout/DashboardLayout';

// Store Pages
import Home from './pages/Home/Home';
import Cart from './pages/Cart/Cart';
import Login from './pages/Login/Login';
import Register from './pages/Register/Register';

// Dashboard Pages
import DashboardHome from './pages/Dashboard/DashboardHome';
import Products from './pages/Dashboard/Products';
import Categories from './pages/Dashboard/Categories';
import Orders from './pages/Dashboard/Orders';

// Styles
import './styles/globals.css';

// Store Layout Component
const StoreLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <>
    <Header />
    <main style={{ minHeight: '60vh' }}>{children}</main>
    <Footer />
  </>
);

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        {/* Auth Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Dashboard Routes */}
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<DashboardHome />} />
          <Route path="products" element={<Products />} />
          <Route path="categories" element={<Categories />} />
          <Route path="orders" element={<Orders />} />
          <Route path="customers" element={<DashboardHome />} />
          <Route path="analytics" element={<DashboardHome />} />
          <Route path="settings" element={<DashboardHome />} />
        </Route>

        {/* Store Routes */}
        <Route path="/" element={<StoreLayout><Home /></StoreLayout>} />
        <Route path="/cart" element={<StoreLayout><Cart /></StoreLayout>} />
        <Route path="/products" element={<StoreLayout><Home /></StoreLayout>} />
        <Route path="/product/:id" element={<StoreLayout><Home /></StoreLayout>} />
      </Routes>
    </Router>
  );
};

export default App;
