import React, { useEffect, useState } from 'react';
import { 
  DollarSign, 
  ShoppingCart, 
  Package, 
  Users,
  TrendingUp,
  TrendingDown,
  Inbox
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { 
  subscribeToProducts, 
  subscribeToCategories, 
  subscribeToOrders 
} from '../../services/firestore';
import type { Order } from '../../services/firestore';
import './DashboardHome.css';

const DashboardHome: React.FC = () => {
  const { products, categories, setProducts, setCategories } = useStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);

  // الاشتراك في البيانات من Firestore
  useEffect(() => {
    const unsubscribeProducts = subscribeToProducts((firestoreProducts) => {
      setProducts(firestoreProducts);
    });

    const unsubscribeCategories = subscribeToCategories((firestoreCategories) => {
      setCategories(firestoreCategories);
    });

    const unsubscribeOrders = subscribeToOrders((firestoreOrders) => {
      setOrders(firestoreOrders);
      // حساب الإيرادات من الطلبات المكتملة
      const revenue = firestoreOrders
        .filter(o => o.status === 'delivered')
        .reduce((sum, o) => sum + o.total, 0);
      setTotalRevenue(revenue);
    });

    return () => {
      unsubscribeProducts();
      unsubscribeCategories();
      unsubscribeOrders();
    };
  }, [setProducts, setCategories]);

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('ar-SA').format(num);
  };

  // حساب الإحصائيات الحقيقية من المتجر
  const stats = [
    {
      title: 'إجمالي الإيرادات',
      value: formatNumber(totalRevenue),
      unit: 'ر.س',
      change: '+0%',
      trend: 'up' as const,
      icon: DollarSign,
      color: '#22c55e'
    },
    {
      title: 'إجمالي الطلبات',
      value: orders.length.toString(),
      change: '+0%',
      trend: 'up' as const,
      icon: ShoppingCart,
      color: '#3b82f6'
    },
    {
      title: 'المنتجات',
      value: products.length.toString(),
      change: '+0%',
      trend: 'up' as const,
      icon: Package,
      color: '#8b5cf6'
    },
    {
      title: 'التصنيفات',
      value: categories.length.toString(),
      change: '+0%',
      trend: 'up' as const,
      icon: Users,
      color: '#f59e0b'
    }
  ];

  return (
    <div className="dashboard-home">
      {/* Stats Cards */}
      <div className="stats-grid">
        {stats.map((stat, index) => (
          <div key={index} className="stat-card">
            <div className="stat-icon" style={{ background: `${stat.color}20`, color: stat.color }}>
              <stat.icon size={24} />
            </div>
            <div className="stat-content">
              <span className="stat-title">{stat.title}</span>
              <div className="stat-value">
                <span className="value">{stat.value}</span>
                {stat.unit && <span className="unit">{stat.unit}</span>}
              </div>
              <div className={`stat-change ${stat.trend}`}>
                {stat.trend === 'up' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                <span>{stat.change}</span>
                <span className="period">من الشهر الماضي</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="charts-row">
        {/* Revenue Chart */}
        <div className="chart-card">
          <div className="chart-header">
            <h3>الإيرادات الشهرية</h3>
            <select className="chart-filter">
              <option>آخر 6 أشهر</option>
              <option>آخر سنة</option>
            </select>
          </div>
          <div className="chart-placeholder">
            <div className="empty-chart">
              <Inbox size={48} />
              <p>لا توجد بيانات إيرادات بعد</p>
              <span>ابدأ بإضافة المنتجات واستقبال الطلبات</span>
            </div>
          </div>
        </div>

        {/* Top Products */}
        <div className="chart-card">
          <div className="chart-header">
            <h3>المنتجات الأكثر مبيعاً</h3>
          </div>
          <div className="top-products">
            {products.length > 0 ? (
              products.slice(0, 5).map((product, index) => (
                <div key={product.id} className="product-item">
                  <div className="product-rank">{index + 1}</div>
                  <div className="product-info">
                    <span className="product-name">{product.name}</span>
                    <span className="product-sales">0 مبيعة</span>
                  </div>
                  <div className="product-revenue">{formatNumber(product.price)} ر.س</div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <Inbox size={48} />
                <p>لا توجد منتجات بعد</p>
                <span>اذهب لصفحة المنتجات لإضافة منتجات جديدة</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="orders-card">
        <div className="card-header">
          <h3>أحدث الطلبات</h3>
          <a href="/dashboard/orders" className="view-all">عرض الكل</a>
        </div>
        <div className="table-container">
          <div className="empty-state">
            <Inbox size={48} />
            <p>لا توجد طلبات بعد</p>
            <span>سيتم عرض الطلبات الجديدة هنا عند استقبالها</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardHome;
