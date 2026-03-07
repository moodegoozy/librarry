import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Package,
  Calendar,
  Download,
  BarChart3,
} from "lucide-react";
import { useStore } from "../../store/useStore";
import { subscribeToOrders } from "../../services/firestore";
import type { FirestoreOrder } from "../../services/firestore";
import "./Analytics.css";

interface MonthlyReport {
  month: string;
  monthName: string;
  revenue: number;
  orders: number;
  products: number;
}

const Analytics: React.FC = () => {
  const [orders, setOrders] = useState<FirestoreOrder[]>([]);
  const { products } = useStore();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    const unsubOrders = subscribeToOrders((firestoreOrders) => {
      setOrders(firestoreOrders);
    });

    return () => {
      unsubOrders();
    };
  }, []);

  // حساب التقارير الشهرية
  const getMonthlyReports = (): MonthlyReport[] => {
    const monthNames = [
      "يناير",
      "فبراير",
      "مارس",
      "أبريل",
      "مايو",
      "يونيو",
      "يوليو",
      "أغسطس",
      "سبتمبر",
      "أكتوبر",
      "نوفمبر",
      "ديسمبر",
    ];

    const reports: MonthlyReport[] = [];

    for (let month = 0; month < 12; month++) {
      const monthOrders = orders.filter((order) => {
        const orderDate = new Date(order.createdAt);
        return (
          orderDate.getFullYear() === selectedYear &&
          orderDate.getMonth() === month
        );
      });

      const revenue = monthOrders.reduce((sum, order) => sum + order.total, 0);
      const productsSold = monthOrders.reduce(
        (sum, order) =>
          sum +
          order.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
        0,
      );

      reports.push({
        month: `${selectedYear}-${String(month + 1).padStart(2, "0")}`,
        monthName: monthNames[month],
        revenue,
        orders: monthOrders.length,
        products: productsSold,
      });
    }

    return reports;
  };

  const monthlyReports = getMonthlyReports();
  const currentMonth = new Date().getMonth();
  const currentMonthReport = monthlyReports[currentMonth];
  const lastMonthReport =
    currentMonth > 0 ? monthlyReports[currentMonth - 1] : null;

  // حساب النسبة المئوية للتغيير
  const getPercentChange = (current: number, previous: number | null) => {
    if (!previous || previous === 0) return 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  const revenueChange = getPercentChange(
    currentMonthReport.revenue,
    lastMonthReport?.revenue ?? null,
  );
  const ordersChange = getPercentChange(
    currentMonthReport.orders,
    lastMonthReport?.orders ?? null,
  );

  // إجماليات السنة
  const yearlyRevenue = monthlyReports.reduce((sum, r) => sum + r.revenue, 0);
  const yearlyOrders = monthlyReports.reduce((sum, r) => sum + r.orders, 0);
  const yearlyProducts = monthlyReports.reduce((sum, r) => sum + r.products, 0);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("ar-SA", {
      style: "currency",
      currency: "SAR",
      minimumFractionDigits: 0,
    }).format(price);
  };

  const handleExportReport = () => {
    const csvContent = [
      ["الشهر", "الإيرادات", "عدد الطلبات", "المنتجات المباعة"],
      ...monthlyReports.map((r) => [
        r.monthName,
        r.revenue,
        r.orders,
        r.products,
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob(["\ufeff" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `تقرير_المبيعات_${selectedYear}.csv`;
    link.click();
  };

  return (
    <div className="analytics-page">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1>التقارير والإحصائيات</h1>
          <p>تقرير المبيعات الشهري - يتم تحديثه كل 30 يوم</p>
        </div>
        <div className="header-actions">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="year-select"
          >
            {[2024, 2025, 2026].map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={handleExportReport}>
            <Download size={18} />
            تصدير التقرير
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="summary-cards">
        <div className="summary-card">
          <div className="card-icon revenue">
            <DollarSign size={24} />
          </div>
          <div className="card-content">
            <span className="card-label">إيرادات هذا الشهر</span>
            <span className="card-value">
              {formatPrice(currentMonthReport.revenue)}
            </span>
            <span
              className={`card-change ${revenueChange >= 0 ? "positive" : "negative"}`}
            >
              {revenueChange >= 0 ? (
                <TrendingUp size={14} />
              ) : (
                <TrendingDown size={14} />
              )}
              {Math.abs(revenueChange)}% من الشهر السابق
            </span>
          </div>
        </div>

        <div className="summary-card">
          <div className="card-icon orders">
            <ShoppingCart size={24} />
          </div>
          <div className="card-content">
            <span className="card-label">طلبات هذا الشهر</span>
            <span className="card-value">{currentMonthReport.orders}</span>
            <span
              className={`card-change ${ordersChange >= 0 ? "positive" : "negative"}`}
            >
              {ordersChange >= 0 ? (
                <TrendingUp size={14} />
              ) : (
                <TrendingDown size={14} />
              )}
              {Math.abs(ordersChange)}% من الشهر السابق
            </span>
          </div>
        </div>

        <div className="summary-card">
          <div className="card-icon products">
            <Package size={24} />
          </div>
          <div className="card-content">
            <span className="card-label">إجمالي المنتجات</span>
            <span className="card-value">{products.length}</span>
            <span className="card-change neutral">منتج في المتجر</span>
          </div>
        </div>

        <div className="summary-card">
          <div className="card-icon yearly">
            <BarChart3 size={24} />
          </div>
          <div className="card-content">
            <span className="card-label">إجمالي السنة</span>
            <span className="card-value">{formatPrice(yearlyRevenue)}</span>
            <span className="card-change neutral">{yearlyOrders} طلب</span>
          </div>
        </div>
      </div>

      {/* Monthly Reports Table */}
      <div className="reports-section">
        <div className="section-header">
          <h2>
            <Calendar size={20} />
            التقارير الشهرية - {selectedYear}
          </h2>
        </div>

        <div className="table-container">
          <table className="reports-table">
            <thead>
              <tr>
                <th>الشهر</th>
                <th>الإيرادات</th>
                <th>عدد الطلبات</th>
                <th>المنتجات المباعة</th>
                <th>متوسط الطلب</th>
              </tr>
            </thead>
            <tbody>
              {monthlyReports.map((report, index) => (
                <tr
                  key={report.month}
                  className={index === currentMonth ? "current-month" : ""}
                >
                  <td>
                    <span className="month-name">{report.monthName}</span>
                    {index === currentMonth && (
                      <span className="current-badge">الشهر الحالي</span>
                    )}
                  </td>
                  <td className="revenue-cell">
                    {formatPrice(report.revenue)}
                  </td>
                  <td>{report.orders}</td>
                  <td>{report.products}</td>
                  <td>
                    {report.orders > 0
                      ? formatPrice(report.revenue / report.orders)
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>
                  <strong>الإجمالي</strong>
                </td>
                <td className="revenue-cell">
                  <strong>{formatPrice(yearlyRevenue)}</strong>
                </td>
                <td>
                  <strong>{yearlyOrders}</strong>
                </td>
                <td>
                  <strong>{yearlyProducts}</strong>
                </td>
                <td>
                  <strong>
                    {yearlyOrders > 0
                      ? formatPrice(yearlyRevenue / yearlyOrders)
                      : "-"}
                  </strong>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Chart Placeholder */}
      <div className="chart-section">
        <div className="section-header">
          <h2>
            <BarChart3 size={20} />
            رسم بياني للمبيعات
          </h2>
        </div>
        <div className="chart-container">
          <div className="chart-bars">
            {monthlyReports.map((report, index) => {
              const maxRevenue = Math.max(
                ...monthlyReports.map((r) => r.revenue),
                1,
              );
              const height = (report.revenue / maxRevenue) * 100;
              return (
                <div key={report.month} className="chart-bar-wrapper">
                  <div
                    className={`chart-bar ${index === currentMonth ? "current" : ""}`}
                    style={{ height: `${Math.max(height, 5)}%` }}
                  >
                    <span className="bar-value">
                      {report.revenue > 0 ? formatPrice(report.revenue) : ""}
                    </span>
                  </div>
                  <span className="bar-label">
                    {report.monthName.slice(0, 3)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
