import React, { useState, useEffect, useCallback } from "react";
import {
  ShoppingCart,
  RefreshCw,
  Loader,
  Package,
  Truck,
  DollarSign,
  X,
  Check,
  Zap,
  ExternalLink,
} from "lucide-react";
import {
  getYakkyofyBalance,
  getYakkyofyTracking,
  syncYakkyofyOrderStatuses,
} from "../../services/yakkyofy";
import {
  subscribeToOrders,
  type FirestoreOrder,
} from "../../services/firestore";
import "./YakkyofyOrders.css";

const YAKKYOFY_STATUS_MAP: Record<string, string> = {
  pending: "قيد الانتظار",
  processing: "قيد المعالجة",
  shipped: "تم الشحن",
  delivered: "تم التسليم",
  cancelled: "ملغي",
  created: "تم الإنشاء",
  paid: "مدفوع",
};

const YakkyofyOrders: React.FC = () => {
  const [orders, setOrders] = useState<FirestoreOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [balance, setBalance] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [trackingModal, setTrackingModal] = useState(false);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingData, setTrackingData] = useState<any>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // الاشتراك في طلبات Yakkyofy من Firestore
  useEffect(() => {
    const unsubscribe = subscribeToOrders((allOrders) => {
      const yakOrders = allOrders.filter((o) => (o as any).isYakkyofyOrder);
      setOrders(yakOrders);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // جلب رصيد Yakkyofy
  const fetchBalance = useCallback(async () => {
    try {
      const result: any = await getYakkyofyBalance();
      if (result) {
        const amount = result?.data?.balance ?? result?.balance ?? result?.amount ?? result?.data;
        if (amount !== undefined) {
          setBalance(
            typeof amount === "number"
              ? amount.toFixed(2)
              : String(amount),
          );
        }
      }
    } catch {
      // تجاهل خطأ الرصيد
    }
  }, []);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  // مزامنة الحالات
  const handleSync = async () => {
    setSyncing(true);
    try {
      const result: any = await syncYakkyofyOrderStatuses();
      showToast(`تمت المزامنة: ${result?.synced || 0} طلب`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "خطأ في المزامنة";
      showToast(msg, "error");
    } finally {
      setSyncing(false);
    }
  };

  // تتبع الشحنة
  const handleTrack = async (order: FirestoreOrder) => {
    const yakkyofyOrderId = (order as any).yakkyofyOrderId;
    if (!yakkyofyOrderId) {
      showToast("لا يوجد معرف Yakkyofy لهذا الطلب", "error");
      return;
    }
    setTrackingLoading(true);
    setTrackingModal(true);
    setTrackingData(null);
    try {
      const result = await getYakkyofyTracking(yakkyofyOrderId);
      setTrackingData(result);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "خطأ في جلب التتبع";
      showToast(msg, "error");
      setTrackingModal(false);
    } finally {
      setTrackingLoading(false);
    }
  };

  const getStatusClass = (status: string) => {
    const s = status?.toLowerCase();
    if (s === "delivered") return "status-delivered";
    if (s === "shipped") return "status-shipped";
    if (s === "processing" || s === "paid" || s === "created") return "status-processing";
    if (s === "cancelled") return "status-cancelled";
    return "status-pending";
  };

  const formatDate = (date: any) => {
    if (!date) return "—";
    const d = date?.toDate ? date.toDate() : new Date(date);
    return new Intl.DateTimeFormat("ar-SA", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(d);
  };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR" }).format(price);

  if (loading) {
    return (
      <div className="yak-orders-loading">
        <Loader size={40} className="spinner" />
      </div>
    );
  }

  return (
    <div className="yak-orders-page">
      {toast && (
        <div className={`yak-toast ${toast.type}`}>
          {toast.type === "success" ? <Check size={16} /> : <X size={16} />}
          {toast.message}
        </div>
      )}

      <div className="page-header">
        <h2>
          <Zap size={24} />
          طلبات Yakkyofy
        </h2>

        <div className="header-actions">
          {balance !== null && (
            <div className="balance-badge">
              <DollarSign size={16} />
              الرصيد: ${balance}
            </div>
          )}
          <button
            className="btn-sync"
            onClick={handleSync}
            disabled={syncing}
          >
            {syncing ? (
              <Loader size={16} className="spinner" />
            ) : (
              <RefreshCw size={16} />
            )}
            مزامنة الحالات
          </button>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="yak-orders-empty">
          <ShoppingCart size={60} />
          <h3>لا توجد طلبات Yakkyofy بعد</h3>
          <p>
            الطلبات التي تحتوي على منتجات Yakkyofy ستظهر هنا تلقائياً
          </p>
        </div>
      ) : (
        <div className="yak-orders-table-wrap">
          <table className="yak-orders-table">
            <thead>
              <tr>
                <th>رقم الطلب</th>
                <th>العميل</th>
                <th>المنتجات</th>
                <th>الإجمالي</th>
                <th>الحالة</th>
                <th>معرف Yakkyofy</th>
                <th>التاريخ</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="order-id">#{order.id.slice(-6).toUpperCase()}</td>
                  <td>
                    <div className="customer-info">
                      <span className="customer-name">{order.customer}</span>
                      <span className="customer-email">{order.email}</span>
                    </div>
                  </td>
                  <td>
                    <div className="items-count">
                      <Package size={14} />
                      {order.items?.length || 0} منتج
                    </div>
                  </td>
                  <td>
                    <span className="order-total">{formatPrice(order.total)}</span>
                  </td>
                  <td>
                    <span className={`status-badge ${getStatusClass((order as any).yakkyofyStatus || order.status)}`}>
                      {YAKKYOFY_STATUS_MAP[(order as any).yakkyofyStatus?.toLowerCase() || ""] ||
                        YAKKYOFY_STATUS_MAP[order.status?.toLowerCase()] ||
                        order.status}
                    </span>
                  </td>
                  <td>
                    {(order as any).yakkyofyOrderId ? (
                      <span className="yak-id-badge">
                        {(order as any).yakkyofyOrderId}
                      </span>
                    ) : (
                      <span className="no-id">—</span>
                    )}
                  </td>
                  <td>{formatDate((order as any).createdAt)}</td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="btn-track"
                        onClick={() => handleTrack(order)}
                        title="تتبع الشحنة"
                      >
                        <Truck size={16} />
                      </button>
                      {order.trackingNumber && (
                        <a
                          className="btn-external"
                          href={order.trackingUrl || `https://www.17track.net/en?nums=${order.trackingNumber}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="رابط التتبع"
                        >
                          <ExternalLink size={16} />
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal التتبع */}
      {trackingModal && (
        <div className="yak-modal-overlay" onClick={() => setTrackingModal(false)}>
          <div className="yak-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <Truck size={20} />
                تتبع الشحنة
              </h3>
              <button className="modal-close" onClick={() => setTrackingModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              {trackingLoading ? (
                <div className="tracking-loading">
                  <Loader size={36} className="spinner" />
                  <p>جاري جلب بيانات التتبع...</p>
                </div>
              ) : trackingData ? (
                <div className="tracking-data">
                  <pre className="tracking-raw">
                    {JSON.stringify(trackingData, null, 2)}
                  </pre>
                </div>
              ) : (
                <div className="tracking-empty">
                  <Truck size={40} />
                  <p>لا تتوفر بيانات تتبع</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default YakkyofyOrders;
