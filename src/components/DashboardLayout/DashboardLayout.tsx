import React, { useEffect, useState, useRef } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Tags,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  Bell,
  ChevronDown,
  MessageSquare,
  Truck,
  ExternalLink,
  Store,
  BellOff,
} from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "../../config/firebase";
import { useStore } from "../../store/useStore";
import { subscribeToOrders } from "../../services/firestore";
import type { FirestoreOrder } from "../../services/firestore";
import logoImage from "../../assets/logo.jpeg";
import "./DashboardLayout.css";

const menuItems = [
  {
    path: "/dashboard",
    icon: LayoutDashboard,
    label: "لوحة التحكم",
    exact: true,
  },
  { path: "/dashboard/products", icon: Package, label: "المنتجات" },
  { path: "/dashboard/orders", icon: ShoppingCart, label: "الطلبات" },
  { path: "/dashboard/categories", icon: Tags, label: "التصنيفات" },
  { path: "/dashboard/customers", icon: Users, label: "العملاء" },
  { path: "/dashboard/messages", icon: MessageSquare, label: "الرسائل" },
  { path: "/dashboard/analytics", icon: BarChart3, label: "التقارير" },
  { path: "/dashboard/settings", icon: Settings, label: "الإعدادات" },
];

const cjMenuItems = [
  { path: "/dashboard/cj-products", icon: Package, label: "منتجات CJ" },
  { path: "/dashboard/cj-orders", icon: Truck, label: "طلبات CJ" },
  { path: "/dashboard/cj-settings", icon: Settings, label: "إعدادات CJ" },
];

const DashboardLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { sidebarOpen, toggleSidebar, user, setUser } = useStore();
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingOrders, setPendingOrders] = useState<FirestoreOrder[]>([]);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // حساب عدد الطلبات الجديدة للجرس
  useEffect(() => {
    const unsubscribe = subscribeToOrders((orders: FirestoreOrder[]) => {
      const pending = orders.filter((o) => o.status === "pending");
      setPendingCount(pending.length);
      setPendingOrders(pending.slice(0, 5)); // آخر 5 طلبات
    });
    return () => unsubscribe();
  }, []);

  // إغلاق القوائم عند النقر خارجها
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setNotificationOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // حماية الداشبورد - فقط للأدمن
  useEffect(() => {
    if (!user) {
      navigate("/login");
    } else if (user.role !== "admin") {
      navigate("/account"); // توجيه العملاء لصفحة حسابهم
    }
  }, [user, navigate]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      navigate("/login");
    } catch (error) {
      console.error("Logout error:", error);
      setUser(null);
      navigate("/login");
    }
  };

  const isActive = (path: string, exact?: boolean) => {
    if (exact) {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "الآن";
    if (minutes < 60) return `منذ ${minutes} دقيقة`;
    if (hours < 24) return `منذ ${hours} ساعة`;
    return `منذ ${days} يوم`;
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("ar-SA", {
      style: "currency",
      currency: "SAR",
    }).format(price);
  };

  // إغلاق القائمة عند تغيير الصفحة على الجوال
  const handleNavClick = () => {
    if (window.innerWidth <= 992 && sidebarOpen) {
      toggleSidebar();
    }
  };

  // حماية من عرض المحتوى قبل التوجيه
  if (!user || user.role !== "admin") {
    return null;
  }

  return (
    <div
      className={`dashboard-layout ${sidebarOpen ? "sidebar-open" : "sidebar-collapsed"}`}
    >
      {/* Sidebar */}
      <aside className="dashboard-sidebar">
        <div className="sidebar-header">
          <Link to="/" className="sidebar-logo">
            <img src={logoImage} alt="جبوري" className="sidebar-logo-image" />
            <span className="logo-sub">لوحة التحكم</span>
          </Link>
        </div>

        <nav className="sidebar-nav">
          <ul>
            {menuItems.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`nav-link ${isActive(item.path, item.exact) ? "active" : ""}`}
                  onClick={handleNavClick}
                >
                  <item.icon size={20} />
                  <span>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>

          {/* CJ Dropshipping Section */}
          <div
            className="sidebar-section-title"
            style={{
              padding: "12px 20px 6px",
              fontSize: "11px",
              fontWeight: 700,
              color: "rgba(255,255,255,0.4)",
              textTransform: "uppercase",
              letterSpacing: "1px",
              marginTop: "8px",
              borderTop: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            CJ Dropshipping
          </div>
          <ul>
            {cjMenuItems.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`nav-link ${isActive(item.path) ? "active" : ""}`}
                  onClick={handleNavClick}
                >
                  <item.icon size={20} />
                  <span>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="sidebar-footer">
          <button className="logout-btn" onClick={handleLogout}>
            <LogOut size={20} />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="dashboard-main">
        {/* Top Bar */}
        <header className="dashboard-header">
          <div className="header-right">
            <button className="menu-toggle" onClick={toggleSidebar}>
              <Menu size={24} />
            </button>
            <h1 className="page-title">
              {[...menuItems, ...cjMenuItems].find((item) =>
                isActive(
                  item.path,
                  "exact" in item
                    ? (item as { exact?: boolean }).exact
                    : undefined,
                ),
              )?.label || "لوحة التحكم"}
            </h1>
          </div>

          <div className="header-left">
            {/* Notification Dropdown */}
            <div className="notification-wrapper" ref={notificationRef}>
              <button
                className={`notification-btn ${pendingCount > 0 ? "has-notifications" : ""}`}
                onClick={() => setNotificationOpen(!notificationOpen)}
              >
                <Bell size={22} />
                {pendingCount > 0 && (
                  <span className="notification-badge">{pendingCount}</span>
                )}
              </button>

              <div className={`notification-dropdown ${notificationOpen ? "open" : ""}`}>
                <div className="notification-header">
                  <h3>
                    <Bell size={18} />
                    الإشعارات
                  </h3>
                  <span className="count-badge">{pendingCount} جديد</span>
                </div>

                <div className="notification-list">
                  {pendingOrders.length > 0 ? (
                    pendingOrders.map((order) => (
                      <div
                        key={order.id}
                        className="notification-item"
                        onClick={() => {
                          navigate("/dashboard/orders");
                          setNotificationOpen(false);
                        }}
                      >
                        <div className="notification-icon order">
                          <ShoppingCart size={20} />
                        </div>
                        <div className="notification-content">
                          <div className="notification-title">
                            طلب جديد #{order.id.slice(-6)}
                          </div>
                          <div className="notification-text">
                            {order.customer} - {formatPrice(order.total)}
                          </div>
                          <div className="notification-time">
                            {formatTimeAgo(order.createdAt)}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="empty-notifications">
                      <BellOff size={40} />
                      <p>لا توجد إشعارات جديدة</p>
                    </div>
                  )}
                </div>

                {pendingOrders.length > 0 && (
                  <div className="notification-footer">
                    <Link
                      to="/dashboard/orders"
                      onClick={() => setNotificationOpen(false)}
                    >
                      عرض جميع الطلبات
                      <ExternalLink size={14} style={{ marginRight: "6px" }} />
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* User Menu Dropdown */}
            <div className="user-menu-wrapper" ref={userMenuRef}>
              <div
                className={`user-menu ${userMenuOpen ? "open" : ""}`}
                onClick={() => setUserMenuOpen(!userMenuOpen)}
              >
                <img
                  src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || "Admin")}&background=667eea&color=fff&bold=true`}
                  alt="Admin"
                  className="user-avatar"
                />
                <div className="user-info">
                  <span className="user-name">{user?.name || "المدير"}</span>
                  <span className="user-role">مدير النظام</span>
                </div>
                <ChevronDown size={16} className="chevron" />
              </div>

              <div className={`user-dropdown ${userMenuOpen ? "open" : ""}`}>
                <div className="user-dropdown-header">
                  <img
                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || "Admin")}&background=667eea&color=fff&bold=true&size=120`}
                    alt="Admin"
                    className="avatar-large"
                  />
                  <div className="name">{user?.name || "المدير"}</div>
                  <div className="email">{user?.email || "admin@jabory.com"}</div>
                </div>

                <div className="user-dropdown-menu">
                  <Link
                    to="/dashboard/settings"
                    className="user-dropdown-item"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <Settings size={18} />
                    <span>إعدادات الحساب</span>
                  </Link>

                  <Link
                    to="/"
                    className="user-dropdown-item"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <Store size={18} />
                    <span>عرض المتجر</span>
                  </Link>

                  <div className="user-dropdown-divider" />

                  <button
                    className="user-dropdown-item danger"
                    onClick={() => {
                      setUserMenuOpen(false);
                      handleLogout();
                    }}
                  >
                    <LogOut size={18} />
                    <span>تسجيل الخروج</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="dashboard-content">
          <Outlet />
        </main>
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={toggleSidebar} />
      )}
    </div>
  );
};

export default DashboardLayout;
