import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  DollarSign,
  ShoppingCart,
  Package,
  Tags,
  TrendingUp,
  TrendingDown,
  Inbox,
  Clock,
  Truck,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { useStore } from "../../store/useStore";
import { subscribeToOrders } from "../../services/firestore";
import type { Order } from "../../services/firestore";
import "./DashboardHome.css";

const DashboardHome: React.FC = () => {
  const { products, categories } = useStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [chartRange, setChartRange] = useState<"6" | "12">("6");

  // الاشتراك في الطلبات فقط (المنتجات والتصنيفات تأتي من App.tsx)
  useEffect(() => {
    const unsubscribeOrders = subscribeToOrders((firestoreOrders) => {
      setOrders(firestoreOrders);
      const revenue = firestoreOrders
        .filter((o) => o.status === "delivered")
        .reduce((sum, o) => sum + o.total, 0);
      setTotalRevenue(revenue);
    });

    return () => {
      unsubscribeOrders();
    };
  }, []);

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("ar-SA").format(num);
  };

  // حساب التغيير الشهري الحقيقي
  const getMonthOverMonthChange = (
    currentMonthItems: Order[],
    prevMonthItems: Order[],
    key: "count" | "revenue",
  ): string => {
    const current =
      key === "count"
        ? currentMonthItems.length
        : currentMonthItems
            .filter((o) => o.status === "delivered")
            .reduce((s, o) => s + o.total, 0);
    const prev =
      key === "count"
        ? prevMonthItems.length
        : prevMonthItems
            .filter((o) => o.status === "delivered")
            .reduce((s, o) => s + o.total, 0);
    if (prev === 0) return current > 0 ? "+100%" : "0%";
    const change = Math.round(((current - prev) / prev) * 100);
    return `${change >= 0 ? "+" : ""}${change}%`;
  };

  const now = new Date();
  const thisMonthOrders = orders.filter((o) => {
    const d = new Date(o.createdAt);
    return (
      d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    );
  });
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthOrders = orders.filter((o) => {
    const d = new Date(o.createdAt);
    return (
      d.getMonth() === lastMonth.getMonth() &&
      d.getFullYear() === lastMonth.getFullYear()
    );
  });

  const revenueChange = getMonthOverMonthChange(
    thisMonthOrders,
    prevMonthOrders,
    "revenue",
  );
  const ordersChange = getMonthOverMonthChange(
    thisMonthOrders,
    prevMonthOrders,
    "count",
  );

  // حساب المنتجات الأكثر مبيعاً من الطلبات الحقيقية
  const productSalesMap = new Map<
    string,
    { name: string; totalSold: number; totalRevenue: number; image?: string }
  >();
  orders.forEach((order) => {
    order.items.forEach((item) => {
      const existing = productSalesMap.get(item.productId || item.name);
      if (existing) {
        existing.totalSold += item.quantity;
        existing.totalRevenue += item.quantity * item.price;
      } else {
        productSalesMap.set(item.productId || item.name, {
          name: item.name,
          totalSold: item.quantity,
          totalRevenue: item.quantity * item.price,
          image: item.image,
        });
      }
    });
  });
  const topProducts = Array.from(productSalesMap.values())
    .sort((a, b) => b.totalSold - a.totalSold)
    .slice(0, 5);

  // بيانات الرسم البياني
  const getChartData = () => {
    const months = parseInt(chartRange);
    const data: { label: string; revenue: number }[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthOrders = orders.filter((o) => {
        const od = new Date(o.createdAt);
        return (
          od.getMonth() === d.getMonth() && od.getFullYear() === d.getFullYear()
        );
      });
      const rev = monthOrders
        .filter((o) => o.status === "delivered")
        .reduce((s, o) => s + o.total, 0);
      data.push({
        label: d.toLocaleDateString("ar-SA", { month: "short" }),
        revenue: rev,
      });
    }
    return data;
  };
  const chartData = getChartData();
  const maxChartRevenue = Math.max(...chartData.map((d) => d.revenue), 1);

  // حساب الإحصائيات الحقيقية من المتجر
  const stats = [
    {
      title: "إجمالي الإيرادات",
      value: formatNumber(totalRevenue),
      unit: "ر.س",
      change: revenueChange,
      trend: revenueChange.startsWith("-")
        ? ("down" as const)
        : ("up" as const),
      icon: DollarSign,
      color: "#22c55e",
    },
    {
      title: "إجمالي الطلبات",
      value: orders.length.toString(),
      change: ordersChange,
      trend: ordersChange.startsWith("-") ? ("down" as const) : ("up" as const),
      icon: ShoppingCart,
      color: "#3b82f6",
    },
    {
      title: "المنتجات",
      value: products.length.toString(),
      change: "",
      trend: "up" as const,
      icon: Package,
      color: "#8b5cf6",
    },
    {
      title: "التصنيفات",
      value: categories.length.toString(),
      change: "",
      trend: "up" as const,
      icon: Tags,
      color: "#f59e0b",
    },
  ];

  return (
    <div className="dashboard-home">
      {/* Stats Cards */}
      <div className="stats-grid">
        {stats.map((stat, index) => (
          <div key={index} className="stat-card">
            <div
              className="stat-icon"
              style={{ background: `${stat.color}20`, color: stat.color }}
            >
              <stat.icon size={24} />
            </div>
            <div className="stat-content">
              <span className="stat-title">{stat.title}</span>
              <div className="stat-value">
                <span className="value">{stat.value}</span>
                {stat.unit && <span className="unit">{stat.unit}</span>}
              </div>
              <div className={`stat-change ${stat.trend}`}>
                {stat.change ? (
                  <>
                    {stat.trend === "up" ? (
                      <TrendingUp size={16} />
                    ) : (
                      <TrendingDown size={16} />
                    )}
                    <span>{stat.change}</span>
                    <span className="period">من الشهر الماضي</span>
                  </>
                ) : null}
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
            <select
              className="chart-filter"
              value={chartRange}
              onChange={(e) => setChartRange(e.target.value as "6" | "12")}
            >
              <option value="6">آخر 6 أشهر</option>
              <option value="12">آخر سنة</option>
            </select>
          </div>
          <div className="chart-placeholder">
            {chartData.every((d) => d.revenue === 0) ? (
              <div className="empty-chart">
                <Inbox size={48} />
                <p>لا توجد بيانات إيرادات بعد</p>
                <span>ابدأ بإضافة المنتجات واستقبال الطلبات</span>
              </div>
            ) : (
              <div
                className="mini-chart-bars"
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  gap: "8px",
                  height: "180px",
                  padding: "16px",
                }}
              >
                {chartData.map((d, i) => (
                  <div key={i} style={{ flex: 1, textAlign: "center" }}>
                    <div
                      style={{
                        height: `${Math.max((d.revenue / maxChartRevenue) * 140, 4)}px`,
                        background: "linear-gradient(180deg, #3b82f6, #2563eb)",
                        borderRadius: "6px 6px 0 0",
                        transition: "height 0.3s",
                      }}
                      title={`${formatNumber(d.revenue)} ر.س`}
                    />
                    <span
                      style={{
                        fontSize: "11px",
                        color: "#64748b",
                        marginTop: "6px",
                        display: "block",
                      }}
                    >
                      {d.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Top Products */}
        <div className="chart-card">
          <div className="chart-header">
            <h3>المنتجات الأكثر مبيعاً</h3>
          </div>
          <div className="top-products">
            {topProducts.length > 0 ? (
              topProducts.map((product, index) => (
                <div key={index} className="product-item">
                  <div className="product-rank">{index + 1}</div>
                  <div className="product-info">
                    <span className="product-name">{product.name}</span>
                    <span className="product-sales">
                      {product.totalSold} مبيعة
                    </span>
                  </div>
                  <div className="product-revenue">
                    {formatNumber(product.totalRevenue)} ر.س
                  </div>
                </div>
              ))
            ) : products.length > 0 ? (
              <div
                className="empty-state"
                style={{ padding: "32px", textAlign: "center" }}
              >
                <Inbox size={36} />
                <p>لا توجد مبيعات بعد</p>
              </div>
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
          <Link to="/dashboard/orders" className="view-all">
            عرض الكل
          </Link>
        </div>
        <div className="table-container">
          {orders.length === 0 ? (
            <div className="empty-state">
              <Inbox size={48} />
              <p>لا توجد طلبات بعد</p>
              <span>سيتم عرض الطلبات الجديدة هنا عند استقبالها</span>
            </div>
          ) : (
            <table className="recent-orders-table">
              <thead>
                <tr>
                  <th>رقم الطلب</th>
                  <th>العميل</th>
                  <th>الإجمالي</th>
                  <th>الحالة</th>
                  <th>التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {orders.slice(0, 5).map((order) => {
                  const statusMap: Record<
                    string,
                    {
                      label: string;
                      icon: React.ElementType;
                      color: string;
                      bg: string;
                    }
                  > = {
                    pending: {
                      label: "قيد الانتظار",
                      icon: Clock,
                      color: "#f59e0b",
                      bg: "#fef3c7",
                    },
                    processing: {
                      label: "قيد التجهيز",
                      icon: Package,
                      color: "#3b82f6",
                      bg: "#dbeafe",
                    },
                    shipped: {
                      label: "تم الشحن",
                      icon: Truck,
                      color: "#8b5cf6",
                      bg: "#ede9fe",
                    },
                    delivered: {
                      label: "تم التسليم",
                      icon: CheckCircle,
                      color: "#22c55e",
                      bg: "#dcfce7",
                    },
                    cancelled: {
                      label: "ملغي",
                      icon: XCircle,
                      color: "#ef4444",
                      bg: "#fee2e2",
                    },
                  };
                  const status = statusMap[order.status] || statusMap.pending;
                  const StatusIcon = status.icon;
                  return (
                    <tr key={order.id}>
                      <td>
                        <strong>#{order.id.slice(-8)}</strong>
                      </td>
                      <td>{order.customer || "عميل"}</td>
                      <td>{formatNumber(order.total)} ر.س</td>
                      <td>
                        <span
                          style={{
                            background: status.bg,
                            color: status.color,
                            padding: "4px 10px",
                            borderRadius: "12px",
                            fontSize: "12px",
                            fontWeight: 600,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <StatusIcon size={12} />
                          {status.label}
                        </span>
                      </td>
                      <td>
                        {order.createdAt instanceof Date
                          ? order.createdAt.toLocaleDateString("ar-SA")
                          : new Date(order.createdAt).toLocaleDateString(
                              "ar-SA",
                            )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardHome;
