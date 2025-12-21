import React, { useState } from 'react';
import { 
  Search, 
  Eye,
  Download,
  Truck,
  Package,
  CheckCircle,
  XCircle,
  Clock,
  Inbox
} from 'lucide-react';
import './Orders.css';

interface Order {
  id: string;
  customer: string;
  email: string;
  phone: string;
  items: number;
  total: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  paymentMethod: string;
  date: string;
}

const statusConfig = {
  pending: { label: 'قيد الانتظار', icon: Clock, color: '#f59e0b', bg: '#fef3c7' },
  processing: { label: 'قيد التجهيز', icon: Package, color: '#3b82f6', bg: '#dbeafe' },
  shipped: { label: 'تم الشحن', icon: Truck, color: '#8b5cf6', bg: '#ede9fe' },
  delivered: { label: 'تم التسليم', icon: CheckCircle, color: '#22c55e', bg: '#dcfce7' },
  cancelled: { label: 'ملغي', icon: XCircle, color: '#ef4444', bg: '#fee2e2' },
};

const Orders: React.FC = () => {
  const [orders] = useState<Order[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.id.includes(searchQuery) || order.customer.includes(searchQuery);
    const matchesStatus = !statusFilter || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ar-SA').format(price);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // حساب الإحصائيات الحقيقية
  const stats = {
    pending: orders.filter(o => o.status === 'pending').length,
    processing: orders.filter(o => o.status === 'processing').length,
    shipped: orders.filter(o => o.status === 'shipped').length,
    delivered: orders.filter(o => o.status === 'delivered').length,
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
          <button className="btn btn-outline btn-sm">
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
                  {filteredOrders.map((order) => {
                    const status = statusConfig[order.status];
                    const StatusIcon = status.icon;
                    return (
                      <tr key={order.id}>
                        <td><strong>{order.id}</strong></td>
                        <td>
                          <div className="customer-cell">
                            <span className="customer-name">{order.customer}</span>
                            <span className="customer-email">{order.email}</span>
                          </div>
                        </td>
                        <td>{order.items} منتج</td>
                        <td><strong>{formatPrice(order.total)} ر.س</strong></td>
                        <td>{order.paymentMethod}</td>
                        <td>{formatDate(order.date)}</td>
                        <td>
                          <span 
                            className="status-badge"
                            style={{ background: status.bg, color: status.color }}
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
              <span className="pagination-info">عرض 1-{filteredOrders.length} من {orders.length} طلب</span>
              <div className="pagination-buttons">
                <button className="pagination-btn" disabled>السابق</button>
                <button className="pagination-btn active">1</button>
                <button className="pagination-btn">التالي</button>
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
              <button className="close-btn" onClick={() => setSelectedOrder(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="order-details">
                <div className="detail-section">
                  <h4>معلومات العميل</h4>
                  <div className="detail-row">
                    <span>الاسم:</span>
                    <strong>{selectedOrder.customer}</strong>
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
                  <h4>معلومات الطلب</h4>
                  <div className="detail-row">
                    <span>عدد المنتجات:</span>
                    <strong>{selectedOrder.items}</strong>
                  </div>
                  <div className="detail-row">
                    <span>الإجمالي:</span>
                    <strong>{formatPrice(selectedOrder.total)} ر.س</strong>
                  </div>
                  <div className="detail-row">
                    <span>طريقة الدفع:</span>
                    <strong>{selectedOrder.paymentMethod}</strong>
                  </div>
                  <div className="detail-row">
                    <span>التاريخ:</span>
                    <strong>{formatDate(selectedOrder.date)}</strong>
                  </div>
                </div>

                <div className="detail-section">
                  <h4>تحديث الحالة</h4>
                  <select className="form-select">
                    {Object.entries(statusConfig).map(([key, value]) => (
                      <option key={key} value={key} selected={key === selectedOrder.status}>
                        {value.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setSelectedOrder(null)}>
                إغلاق
              </button>
              <button className="btn btn-primary">
                حفظ التغييرات
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;
