import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Search,
  ShoppingCart,
  User,
  Menu,
  X,
  Heart,
  Phone,
  ChevronDown,
} from "lucide-react";
import { useStore } from "../../store/useStore";
import logoImage from "../../assets/logo.jpeg";
import "./Header.css";

const Header: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { cart, user, searchQuery, setSearchQuery, categories } = useStore();
  const navigate = useNavigate();

  const cartCount = cart.reduce((count, item) => count + item.quantity, 0);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchQuery)}`);
      setSearchOpen(false);
    }
  };

  return (
    <header className="header">
      {/* Top Bar */}
      <div className="header-top">
        <div className="container">
          <div className="header-top-content">
            <div className="header-contact">
              <Phone size={14} />
              <span>0556122411</span>
            </div>
            <div className="header-promo">
              🎉 شحن مجاني للطلبات فوق 200 ريال
            </div>
            <div className="header-links">
              {user ? (
                <Link to={user.role === "admin" ? "/dashboard" : "/account"}>
                  حسابي
                </Link>
              ) : (
                <>
                  <Link to="/login">تسجيل الدخول</Link>
                  <span>|</span>
                  <Link to="/register">حساب جديد</Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <div className="header-main">
        <div className="container">
          <div className="header-main-content">
            {/* Mobile Menu Toggle */}
            <button
              className="mobile-menu-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            {/* Logo */}
            <Link to="/" className="logo">
              <img
                src={logoImage}
                alt="جبوري للإلكترونيات"
                className="logo-image"
              />
            </Link>

            {/* Search Bar */}
            <form className="search-bar" onSubmit={handleSearch}>
              <input
                type="text"
                placeholder="ابحث عن منتجات..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button type="submit">
                <Search size={20} />
              </button>
            </form>

            {/* Header Actions */}
            <div className="header-actions">
              <button
                className="search-toggle"
                onClick={() => setSearchOpen(!searchOpen)}
              >
                <Search size={22} />
              </button>

              <Link to="/wishlist" className="action-btn">
                <Heart size={22} />
              </Link>

              <Link to="/cart" className="action-btn cart-btn">
                <ShoppingCart size={22} />
                {cartCount > 0 && (
                  <span className="cart-count">{cartCount}</span>
                )}
              </Link>

              <Link to={user ? "/account" : "/login"} className="action-btn">
                <User size={22} />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Search */}
      {searchOpen && (
        <div className="mobile-search">
          <form onSubmit={handleSearch}>
            <input
              type="text"
              placeholder="ابحث عن منتجات..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            <button type="submit">
              <Search size={20} />
            </button>
          </form>
        </div>
      )}

      {/* Navigation */}
      <nav className={`nav ${mobileMenuOpen ? "nav-open" : ""}`}>
        <div className="container">
          <ul className="nav-menu">
            <li className="nav-item">
              <Link to="/" className="nav-link">
                الرئيسية
              </Link>
            </li>
            <li className="nav-item has-dropdown">
              <span className="nav-link">
                التصنيفات <ChevronDown size={16} />
              </span>
              <div className="dropdown-menu">
                {categories.length > 0 ? (
                  categories.map((cat) => (
                    <Link key={cat.id} to={`/products?category=${cat.id}`}>
                      {cat.name}
                    </Link>
                  ))
                ) : (
                  <span style={{ padding: "10px", color: "var(--gray)" }}>
                    لا توجد تصنيفات
                  </span>
                )}
              </div>
            </li>
            <li className="nav-item">
              <Link to="/products?featured=true" className="nav-link">
                العروض
              </Link>
            </li>
            <li className="nav-item">
              <Link to="/products?new=true" className="nav-link">
                وصل حديثاً
              </Link>
            </li>
            <li className="nav-item">
              <Link to="/contact" className="nav-link">
                اتصل بنا
              </Link>
            </li>
          </ul>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="mobile-overlay"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </header>
  );
};

export default Header;
