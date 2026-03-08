import React, { useState, useEffect } from "react";
import {
  Search,
  Eye,
  Download,
  Truck,
  Package,
  CheckCircle,
  XCircle,
  Clock,
  Inbox,
  Loader,
  Trash2,
} from "lucide-react";
import {
  subscribeToOrders,
  updateOrderStatusInFirestore,
  deleteOrder,
} from "../../services/firestore";
import type { FirestoreOrder } from "../../services/firestore";
import "./Orders.css";

type Order = FirestoreOrder;

const statusConfig = {
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
  shipped: { label: "تم الشحن", icon: Truck, color: "#8b5cf6", bg: "#ede9fe" },
  delivered: {
    label: "تم التسليم",
    icon: CheckCircle,
    color: "#22c55e",
    bg: "#dcfce7",
  },
  cancelled: { label: "ملغي", icon: XCircle, color: "#ef4444", bg: "#fee2e2" },
};

const Orders: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [newStatus, setNewStatus] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // الاشتراك في الطلبات من Firestore
  useEffect(() => {
    const unsubscribe = subscribeToOrders((firestoreOrders) => {
      setOrders(firestoreOrders);
    });

    return () => unsubscribe();
  }, []);

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.id.includes(searchQuery) ||
      (order.customer || "").includes(searchQuery);
    const matchesStatus = !statusFilter || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("ar-SA").format(price);
  };

  const formatDate = (date: Date | string) => {
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString("ar-SA", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // حساب الإحصائيات الحقيقية
  const stats = {
    pending: orders.filter((o) => o.status === "pending").length,
    processing: orders.filter((o) => o.status === "processing").length,
    shipped: orders.filter((o) => o.status === "shipped").length,
    delivered: orders.filter((o) => o.status === "delivered").length,
  };

  const handleExportOrders = () => {
    const headers = [
      "رقم الطلب",
      "العميل",
      "البريد",
      "الإجمالي",
      "طريقة الدفع",
      "الحالة",
      "التاريخ",
    ];
    const statusLabels: Record<string, string> = {
      pending: "قيد الانتظار",
      processing: "قيد التجهيز",
      shipped: "تم الشحن",
      delivered: "تم التسليم",
      cancelled: "ملغي",
    };
    const rows = orders.map((o) => [
      o.id,
      o.customer || "عميل",
      o.email,
      o.total,
      o.paymentMethod === "cash"
        ? "الدفع عند الاستلام"
        : o.paymentMethod === "bank"
          ? "تحويل بنكي"
          : "بطاقة",
      statusLabels[o.status] || o.status,
      formatDate(o.createdAt),
    ]);
    const csvContent = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `طلبات_${new Date().toLocaleDateString("ar-SA")}.csv`;
    link.click();
  };

  const handleDeleteOrder = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا الطلب؟")) return;
    try {
      await deleteOrder(id);
      setSelectedOrder(null);
    } catch (error) {
      console.error("Error deleting order:", error);
      alert("حدث خطأ أثناء حذف الطلب");
    }
  };

  return (
    <div className="orders-page">
      {/* Stats */}
      <div className="orders-stats">
        <div className="stat-item">
          <div className="stat-icon pending">
            <Clock size={20} />
          </div>
          <div>
            <span className="stat-value">{stats.pending}</span>
            <span className="stat-label">قيد الانتظار</span>
          </div>
        </div>
        <div className="stat-item">
          <div className="stat-icon processing">
            <Package size={20} />
          </div>
          <div>
            <span className="stat-value">{stats.processing}</span>
            <span className="stat-label">قيد التجهيز</span>
          </div>
        </div>
        <div className="stat-item">
          <div className="stat-icon shipped">
            <Truck size={20} />
          </div>
          <div>
            <span className="stat-value">{stats.shipped}</span>
            <span className="stat-label">تم الشحن</span>
          </div>
        </div>
        <div className="stat-item">
          <div className="stat-icon delivered">
            <CheckCircle size={20} />
          </div>
          <div>
            <span className="stat-value">{stats.delivered}</span>
            <span className="stat-label">تم التسليم</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="search-box">
          <Search size={20} />
          <input
            type="text"
            placeholder="ابحث برقم الطلب أو اسم العميل..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="filter-buttons">
          <select
            className="filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">كل الحالات</option>
            <option value="pending">قيد الانتظار</option>
            <option value="processing">قيد التجهيز</option>
            <option value="shipped">تم الشحن</option>
            <option value="delivered">تم التسليم</option>
            <option value="cancelled">ملغي</option>
          </select>
          <button
            className="btn btn-outline btn-sm"
            onClick={handleExportOrders}
          >
            <Download size={16} />
            تصدير
          </button>
        </div>
      </div>

      {/* Orders Table */}
      <div className="table-card">
        {orders.length === 0 ? (
          <div className="empty-state">
            <Inbox size={48} />
            <p>لا توجد طلبات بعد</p>
            <span>سيتم عرض الطلبات هنا عند استقبالها من العملاء</span>
          </div>
        ) : (
          <>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>رقم الطلب</th>
                    <th>العميل</th>
                    <th>المنتجات</th>
                    <th>الإجمالي</th>
                    <th>طريقة الدفع</th>
                    <th>التاريخ</th>
                    <th>الحالة</th>
                    <th>الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedOrders.map((order) => {
                    const status = statusConfig[order.status];
                    const StatusIcon = status.icon;
                    return (
                      <tr key={order.id}>
                        <td>
                          <strong>{order.id.slice(-8)}</strong>
                        </td>
                        <td>
                          <div className="customer-cell">
                            <span className="customer-name">
                              {order.customer || "عميل"}
                            </span>
                            <span className="customer-email">
                              {order.email}
                            </span>
                          </div>
                        </td>
                        <td>{order.items.length} منتج</td>
                        <td>
                          <strong>{formatPrice(order.total)} ر.س</strong>
                        </td>
                        <td>
                          {order.paymentMethod === "cash"
                            ? "الدفع عند الاستلام"
                            : order.paymentMethod === "bank"
                              ? "تحويل بنكي"
                              : "بطاقة ائتمان"}
                        </td>
                        <td>{formatDate(order.createdAt)}</td>
                        <td>
                          <span
                            className="status-badge"
                            style={{
                              background: status.bg,
                              color: status.color,
                            }}
                          >
                            <StatusIcon size={14} />
                            {status.label}
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn btn-sm btn-outline"
                            onClick={() => setSelectedOrder(order)}
                          >
                            <Eye size={14} />
                            عرض
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="pagination">
              <span className="pagination-info">
                عرض {(currentPage - 1) * itemsPerPage + 1}-
                {Math.min(currentPage * itemsPerPage, filteredOrders.length)} من{" "}
                {filteredOrders.length} طلب
              </span>
              <div className="pagination-buttons">
                <button
                  className="pagination-btn"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                >
                  السابق
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (page) => (
                    <button
                      key={page}
                      className={`pagination-btn ${currentPage === page ? "active" : ""}`}
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </button>
                  ),
                )}
                <button
                  className="pagination-btn"
                  disabled={currentPage === totalPages || totalPages === 0}
                  onClick={() => setCurrentPage((p) => p + 1)}
                >
                  التالي
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>تفاصيل الطلب {selectedOrder.id}</h2>
              <button
                className="close-btn"
                onClick={() => setSelectedOrder(null)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="order-details">
                <div className="detail-section">
                  <h4>معلومات العميل</h4>
                  <div className="detail-row">
                    <span>الاسم:</span>
                    <strong>{selectedOrder.customer || "عميل"}</strong>
                  </div>
                  <div className="detail-row">
                    <span>البريد:</span>
                    <strong>{selectedOrder.email}</strong>
                  </div>
                  <div className="detail-row">
                    <span>الجوال:</span>
                    <strong>{selectedOrder.phone}</strong>
                  </div>
                </div>

                <div className="detail-section">
                  <h4>عنوان الشحن</h4>
                  {selectedOrder.address ? (
                    <>
                      <div className="detail-row">
                        <span>المدينة:</span>
                        <strong>{selectedOrder.address.city}</strong>
                      </div>
                      <div className="detail-row">
                        <span>الحي:</span>
                        <strong>{selectedOrder.address.district}</strong>
                      </div>
                      <div className="detail-row">
                        <span>الشارع:</span>
                        <strong>{selectedOrder.address.street}</strong>
                      </div>
                      {selectedOrder.address.building && (
                        <div className="detail-row">
                          <span>المبنى:</span>
                          <strong>{selectedOrder.address.building}</strong>
                        </div>
                      )}
                      {selectedOrder.address.nationalAddress && (
                        <div className="detail-row">
                          <span>العنوان الوطني:</span>
                          <strong>{selectedOrder.address.nationalAddress}</strong>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="detail-row">
                      <span>العنوان:</span>
                      <strong>{selectedOrder.shippingAddress}</strong>
                    </div>
                  )}
                </div>

                <div className="detail-section">
                  <h4>المنتجات ({selectedOrder.items.length})</h4>
                  <div className="order-items-list">
                    {selectedOrder.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="order-item-row"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          padding: "8px 0",
                          borderBottom: "1px solid #f1f5f9",
                        }}
                      >
                        {item.image && (
                          <img
                            src={item.image}
                            alt={item.name}
                            style={{
                              width: "48px",
                              height: "48px",
                              borderRadius: "8px",
                              objectFit: "cover",
                            }}
                          />
                        )}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: "14px" }}>
                            {item.name}
                          </div>
                          <div style={{ color: "#64748b", fontSize: "13px" }}>
                            الكمية: {item.quantity} × {formatPrice(item.price)}{" "}
                            ر.س
                          </div>
                        </div>
                        <strong style={{ fontSize: "14px" }}>
                          {formatPrice(item.quantity * item.price)} ر.س
                        </strong>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="detail-section">
                  <h4>ملخص الطلب</h4>
                  {selectedOrder.subtotal && (
                    <div className="detail-row">
                      <span>المجموع الفرعي:</span>
                      <strong>{formatPrice(selectedOrder.subtotal)} ر.س</strong>
                    </div>
                  )}
                  {selectedOrder.shippingCost !== undefined && (
                    <div className="detail-row">
                      <span>الشحن:</span>
                      <strong>
                        {selectedOrder.shippingCost === 0
                          ? "مجاني"
                          : `${formatPrice(selectedOrder.shippingCost)} ر.س`}
                      </strong>
                    </div>
                  )}
                  <div className="detail-row">
                    <span>الإجمالي:</span>
                    <strong style={{ color: "#22c55e", fontSize: "16px" }}>
                      {formatPrice(selectedOrder.total)} ر.س
                    </strong>
                  </div>
                  <div className="detail-row">
                    <span>طريقة الدفع:</span>
                    <strong>
                      {selectedOrder.paymentMethod === "cash"
                        ? "الدفع عند الاستلام"
                        : selectedOrder.paymentMethod === "bank"
                          ? "تحويل بنكي"
                          : "بطاقة ائتمان"}
                    </strong>
                  </div>
                  <div className="detail-row">
                    <span>التاريخ:</span>
                    <strong>{formatDate(selectedOrder.createdAt)}</strong>
                  </div>
                  {selectedOrder.notes && (
                    <div className="detail-row">
                      <span>ملاحظات:</span>
                      <strong>{selectedOrder.notes}</strong>
                    </div>
                  )}
                </div>

                <div className="detail-section">
                  <h4>تحديث الحالة</h4>
                  <select
                    className="form-select"
                    value={newStatus || selectedOrder.status}
                    onChange={(e) => setNewStatus(e.target.value)}
                  >
                    {Object.entries(statusConfig).map(([key, value]) => (
                      <option key={key} value={key}>
                        {value.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-outline"
                style={{ color: "#ef4444", borderColor: "#ef4444" }}
                onClick={() => handleDeleteOrder(selectedOrder.id)}
                disabled={loading}
              >
                <Trash2 size={16} />
                حذف الطلب
              </button>
              <button
                className="btn btn-outline"
                onClick={() => setSelectedOrder(null)}
                disabled={loading}
              >
                إغلاق
              </button>
              <button
                className="btn btn-primary"
                disabled={loading}
                onClick={async () => {
                  if (newStatus && newStatus !== selectedOrder.status) {
                    setLoading(true);
                    try {
                      await updateOrderStatusInFirestore(
                        selectedOrder.id,
                        newStatus as Order["status"],
                      );
                      setSelectedOrder(null);
                      setNewStatus("");
                    } catch (error) {
                      console.error("Error updating order status:", error);
                      alert("حدث خطأ أثناء تحديث حالة الطلب");
                    } finally {
                      setLoading(false);
                    }
                  } else {
                    setSelectedOrder(null);
                  }
                }}
              >
                {loading ? (
                  <Loader className="spinner" size={18} />
                ) : (
                  "حفظ التغييرات"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;
