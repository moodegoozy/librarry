import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  User,
  MapPin,
  Phone,
  Edit,
  Save,
  Package,
  Heart,
  LogOut,
  ShoppingBag,
  Loader,
  Clock,
  Truck,
  CheckCircle,
  XCircle,
  Trash2,
} from "lucide-react";
import { signOut } from "firebase/auth";
import { auth, db } from "../../config/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { useStore } from "../../store/useStore";
import { getUserOrders } from "../../services/firestore";
import type { FirestoreOrder } from "../../services/firestore";
import Header from "../../components/Header/Header";
import Footer from "../../components/Footer/Footer";
import "./Account.css";

const Account: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setUser, wishlist, toggleWishlist, products } = useStore();
  const [activeTab, setActiveTab] = useState(() => {
    return location.pathname === "/wishlist" ? "wishlist" : "profile";
  });
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<FirestoreOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    city: "",
    district: "",
    street: "",
    building: "",
    nationalAddress: "",
  });

  // Status config for orders
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

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    // تعبئة البيانات الحالية
    setFormData({
      name: user.name || "",
      phone: user.phone || "",
      email: user.email || "",
      city: user.addresses?.[0]?.city || "",
      district: user.addresses?.[0]?.district || "",
      street: user.addresses?.[0]?.street || "",
      building: user.addresses?.[0]?.building || "",
      nationalAddress: user.addresses?.[0]?.nationalAddress || "",
    });
  }, [user, navigate]);

  // جلب طلبات المستخدم
  useEffect(() => {
    if (user && activeTab === "orders") {
      setOrdersLoading(true);
      getUserOrders(user.id)
        .then(setOrders)
        .catch(console.error)
        .finally(() => setOrdersLoading(false));
    }
  }, [user, activeTab]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("ar-SA", {
      style: "currency",
      currency: "SAR",
    }).format(price);
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("ar-SA", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      navigate("/");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const userRef = doc(db, "users", user.id);
      const updatedData = {
        name: formData.name,
        phone: formData.phone,
        addresses: [
          {
            fullName: formData.name,
            phone: formData.phone,
            city: formData.city,
            district: formData.district,
            street: formData.street,
            building: formData.building,
            nationalAddress: formData.nationalAddress,
          },
        ],
      };

      await updateDoc(userRef, updatedData);

      // تحديث الستور
      setUser({
        ...user,
        name: formData.name,
        phone: formData.phone,
        addresses: [updatedData.addresses[0]],
      });

      setEditing(false);
      alert("تم حفظ البيانات بنجاح");
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("حدث خطأ أثناء حفظ البيانات");
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <>
      <Header />
      <div className="account-page">
        <div className="container">
          <div className="account-layout">
            {/* Sidebar */}
            <aside className="account-sidebar">
              <div className="user-info">
                <div className="user-avatar">
                  <User size={40} />
                </div>
                <div className="user-details">
                  <h3>{user.name || "مستخدم"}</h3>
                  <p>{user.email}</p>
                </div>
              </div>

              <nav className="account-nav">
                <button
                  className={`nav-item ${activeTab === "profile" ? "active" : ""}`}
                  onClick={() => setActiveTab("profile")}
                >
                  <User size={20} />
                  <span>الملف الشخصي</span>
                </button>
                <button
                  className={`nav-item ${activeTab === "orders" ? "active" : ""}`}
                  onClick={() => setActiveTab("orders")}
                >
                  <Package size={20} />
                  <span>طلباتي</span>
                </button>
                <button
                  className={`nav-item ${activeTab === "addresses" ? "active" : ""}`}
                  onClick={() => setActiveTab("addresses")}
                >
                  <MapPin size={20} />
                  <span>عناويني</span>
                </button>
                <button
                  className={`nav-item ${activeTab === "wishlist" ? "active" : ""}`}
                  onClick={() => setActiveTab("wishlist")}
                >
                  <Heart size={20} />
                  <span>المفضلة</span>
                </button>
                <button className="nav-item logout" onClick={handleLogout}>
                  <LogOut size={20} />
                  <span>تسجيل الخروج</span>
                </button>
              </nav>
            </aside>

            {/* Main Content */}
            <main className="account-content">
              {/* Profile Tab */}
              {activeTab === "profile" && (
                <div className="content-card">
                  <div className="card-header">
                    <h2>الملف الشخصي</h2>
                    {!editing ? (
                      <button
                        className="btn btn-outline"
                        onClick={() => setEditing(true)}
                      >
                        <Edit size={18} />
                        تعديل
                      </button>
                    ) : (
                      <button
                        className="btn btn-primary"
                        onClick={handleSave}
                        disabled={loading}
                      >
                        {loading ? (
                          <Loader className="spinner" size={18} />
                        ) : (
                          <Save size={18} />
                        )}
                        حفظ
                      </button>
                    )}
                  </div>

                  <div className="profile-form">
                    <div className="form-section">
                      <h3>البيانات الشخصية</h3>
                      <div className="form-row">
                        <div className="form-group">
                          <label>الاسم الكامل</label>
                          <input
                            type="text"
                            value={formData.name}
                            onChange={(e) =>
                              setFormData({ ...formData, name: e.target.value })
                            }
                            disabled={!editing}
                          />
                        </div>
                        <div className="form-group">
                          <label>البريد الإلكتروني</label>
                          <input
                            type="email"
                            value={formData.email}
                            disabled
                            className="disabled"
                          />
                        </div>
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>رقم الجوال</label>
                          <input
                            type="tel"
                            value={formData.phone}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                phone: e.target.value,
                              })
                            }
                            disabled={!editing}
                            placeholder="05xxxxxxxx"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="form-section">
                      <h3>عنوان التوصيل</h3>
                      <div className="form-row">
                        <div className="form-group">
                          <label>المدينة</label>
                          <input
                            type="text"
                            value={formData.city}
                            onChange={(e) =>
                              setFormData({ ...formData, city: e.target.value })
                            }
                            disabled={!editing}
                            placeholder="مثال: الرياض"
                          />
                        </div>
                        <div className="form-group">
                          <label>الحي</label>
                          <input
                            type="text"
                            value={formData.district}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                district: e.target.value,
                              })
                            }
                            disabled={!editing}
                            placeholder="مثال: حي النرجس"
                          />
                        </div>
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>الشارع</label>
                          <input
                            type="text"
                            value={formData.street}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                street: e.target.value,
                              })
                            }
                            disabled={!editing}
                            placeholder="اسم الشارع"
                          />
                        </div>
                        <div className="form-group">
                          <label>رقم المبنى (اختياري)</label>
                          <input
                            type="text"
                            value={formData.building}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                building: e.target.value,
                              })
                            }
                            disabled={!editing}
                            placeholder="رقم المبنى أو الشقة"
                          />
                        </div>
                      </div>
                      <div className="form-group">
                        <label>العنوان الوطني (اختياري)</label>
                        <input
                          type="text"
                          value={formData.nationalAddress}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              nationalAddress: e.target.value,
                            })
                          }
                          disabled={!editing}
                          placeholder="مثال: RRRD2929"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Orders Tab */}
              {activeTab === "orders" && (
                <div className="content-card">
                  <div className="card-header">
                    <h2>طلباتي</h2>
                  </div>
                  {ordersLoading ? (
                    <div className="loading-state">
                      <Loader className="spinner" size={40} />
                      <p>جاري تحميل الطلبات...</p>
                    </div>
                  ) : orders.length === 0 ? (
                    <div className="empty-state">
                      <ShoppingBag size={60} />
                      <h3>لا توجد طلبات</h3>
                      <p>لم تقم بأي طلبات بعد</p>
                      <button
                        className="btn btn-primary"
                        onClick={() => navigate("/products")}
                      >
                        تسوق الآن
                      </button>
                    </div>
                  ) : (
                    <div className="orders-list">
                      {orders.map((order) => {
                        const status = statusConfig[order.status];
                        const StatusIcon = status.icon;
                        return (
                          <div key={order.id} className="order-card">
                            <div className="order-header">
                              <div className="order-info">
                                <span className="order-number">
                                  طلب #{order.id.slice(-8)}
                                </span>
                                <span className="order-date">
                                  {formatDate(order.createdAt)}
                                </span>
                              </div>
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
                            </div>
                            <div className="order-items">
                              {order.items.map((item, idx) => (
                                <div key={idx} className="order-item">
                                  {item.image && (
                                    <img
                                      src={item.image}
                                      alt={item.name}
                                      className="item-image"
                                    />
                                  )}
                                  <div className="item-details">
                                    <span className="item-name">
                                      {item.name}
                                    </span>
                                    <span className="item-qty">
                                      الكمية: {item.quantity}
                                    </span>
                                  </div>
                                  <span className="item-price">
                                    {formatPrice(item.price * item.quantity)}
                                  </span>
                                </div>
                              ))}
                            </div>
                            <div className="order-footer">
                              <div className="order-address">
                                <MapPin size={14} />
                                <span>{order.shippingAddress}</span>
                              </div>
                              <div className="order-total">
                                <span>الإجمالي:</span>
                                <strong>{formatPrice(order.total)}</strong>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Addresses Tab */}
              {activeTab === "addresses" && (
                <div className="content-card">
                  <div className="card-header">
                    <h2>عناويني</h2>
                  </div>
                  {user.addresses && user.addresses.length > 0 ? (
                    <div className="addresses-list">
                      {user.addresses.map((addr, idx) => (
                        <div key={idx} className="address-card">
                          <MapPin size={20} />
                          <div className="address-details">
                            <strong>{addr.city}</strong>
                            <p>
                              {addr.district}، {addr.street}
                            </p>
                            {addr.building && <p>مبنى: {addr.building}</p>}
                            <p>
                              <Phone size={14} /> {addr.phone}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state">
                      <MapPin size={60} />
                      <h3>لا توجد عناوين</h3>
                      <p>أضف عنوان التوصيل من الملف الشخصي</p>
                    </div>
                  )}
                </div>
              )}

              {/* Wishlist Tab */}
              {activeTab === "wishlist" && (
                <div className="content-card">
                  <div className="card-header">
                    <h2>المفضلة</h2>
                  </div>
                  {wishlist.length === 0 ? (
                    <div className="empty-state">
                      <Heart size={60} />
                      <h3>القائمة فارغة</h3>
                      <p>أضف منتجات للمفضلة لتجدها هنا</p>
                      <button
                        className="btn btn-primary"
                        onClick={() => navigate("/products")}
                      >
                        تصفح المنتجات
                      </button>
                    </div>
                  ) : (
                    <div className="wishlist-grid">
                      {wishlist.map((productId) => {
                        const product = products.find(
                          (p) => p.id === productId,
                        );
                        if (!product) return null;
                        return (
                          <div key={product.id} className="wishlist-item">
                            <img
                              src={product.images[0] || "/placeholder.jpg"}
                              alt={product.name}
                              className="wishlist-image"
                            />
                            <div className="wishlist-info">
                              <h4
                                onClick={() =>
                                  navigate(`/product/${product.id}`)
                                }
                                style={{ cursor: "pointer" }}
                              >
                                {product.name}
                              </h4>
                              <span className="wishlist-price">
                                {formatPrice(product.price)}
                              </span>
                            </div>
                            <button
                              className="wishlist-remove"
                              onClick={() => toggleWishlist(product.id)}
                              title="إزالة من المفضلة"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </main>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default Account;
