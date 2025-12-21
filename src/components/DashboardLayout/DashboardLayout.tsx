import React, { useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
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
  ChevronDown
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../../config/firebase';
import { useStore } from '../../store/useStore';
import './DashboardLayout.css';

const menuItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'لوحة التحكم', exact: true },
  { path: '/dashboard/products', icon: Package, label: 'المنتجات' },
  { path: '/dashboard/orders', icon: ShoppingCart, label: 'الطلبات' },
  { path: '/dashboard/categories', icon: Tags, label: 'التصنيفات' },
  { path: '/dashboard/customers', icon: Users, label: 'العملاء' },
  { path: '/dashboard/analytics', icon: BarChart3, label: 'التقارير' },
  { path: '/dashboard/settings', icon: Settings, label: 'الإعدادات' },
];

const DashboardLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { sidebarOpen, toggleSidebar, user, setUser } = useStore();

  // حماية الداشبورد - توجيه للتسجيل إذا لم يكن مسجل دخول
  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      setUser(null);
      navigate('/login');
    }
  };

  const isActive = (path: string, exact?: boolean) => {
    if (exact) {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  // إغلاق القائمة عند تغيير الصفحة على الجوال
  const handleNavClick = () => {
    if (window.innerWidth <= 992 && sidebarOpen) {
      toggleSidebar();
    }
  };

  return (
    <div className={`dashboard-layout ${sidebarOpen ? 'sidebar-open' : 'sidebar-collapsed'}`}>
      {/* Sidebar */}
      <aside className="dashboard-sidebar">
        <div className="sidebar-header">
          <Link to="/" className="sidebar-logo">
            <span className="logo-text">جبوري</span>
            <span className="logo-sub">لوحة التحكم</span>
          </Link>
        </div>

        <nav className="sidebar-nav">
          <ul>
            {menuItems.map((item) => (
              <li key={item.path}>
                <Link 
                  to={item.path} 
                  className={`nav-link ${isActive(item.path, item.exact) ? 'active' : ''}`}
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
              {menuItems.find(item => isActive(item.path, item.exact))?.label || 'لوحة التحكم'}
            </h1>
          </div>

          <div className="header-left">
            <button className="notification-btn">
              <Bell size={22} />
              <span className="notification-badge">3</span>
            </button>

            <div className="user-menu">
              <img 
                src="https://ui-avatars.com/api/?name=Admin&background=2563eb&color=fff" 
                alt="Admin"
                className="user-avatar"
              />
              <div className="user-info">
                <span className="user-name">{user?.name || 'المدير'}</span>
                <span className="user-role">مدير</span>
              </div>
              <ChevronDown size={16} />
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
