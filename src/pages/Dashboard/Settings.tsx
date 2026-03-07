import React, { useState, useEffect } from "react";
import {
  Store,
  Bell,
  CreditCard,
  Truck,
  Shield,
  Save,
  Loader,
} from "lucide-react";
import { useStore } from "../../store/useStore";
import { getSettings, updateSettings } from "../../services/firestore";
import {
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";
import { auth } from "../../config/firebase";
import type { StoreSettings } from "../../services/firestore";
import "./Settings.css";

const Settings: React.FC = () => {
  const { user } = useStore();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("store");

  const [storeSettings, setStoreSettings] = useState({
    storeName: "جبوري للإلكترونيات",
    storeEmail: "info@jaboory.com",
    storePhone: "920000000",
    storeAddress: "المملكة العربية السعودية",
    currency: "SAR",
    language: "ar",
  });

  const [shippingSettings, setShippingSettings] = useState({
    freeShippingThreshold: 200,
    defaultShippingCost: 25,
    enableFreeShipping: true,
    estimatedDays: "3-5",
  });

  const [notificationSettings, setNotificationSettings] = useState({
    orderNotifications: true,
    lowStockAlert: true,
    customerMessages: true,
    marketingEmails: false,
    lowStockThreshold: 5,
  });

  const [paymentMethods, setPaymentMethods] = useState([
    { id: "cash", name: "الدفع عند الاستلام", enabled: true },
    { id: "bank", name: "التحويل البنكي", enabled: true },
    { id: "card", name: "بطاقة ائتمان (قريباً)", enabled: false },
  ]);

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    current: "",
    newPass: "",
    confirm: "",
  });
  const [passwordLoading, setPasswordLoading] = useState(false);

  // جلب الإعدادات من Firestore
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settings = await getSettings();
        if (settings) {
          if (settings.store) setStoreSettings(settings.store);
          if (settings.shipping) setShippingSettings(settings.shipping);
          if (settings.notifications)
            setNotificationSettings(settings.notifications);
          if (settings.payment?.methods)
            setPaymentMethods(settings.payment.methods);
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      const settingsData: StoreSettings = {
        store: storeSettings,
        shipping: shippingSettings,
        notifications: notificationSettings,
        payment: { methods: paymentMethods },
      };
      await updateSettings(settingsData);
      alert("تم حفظ الإعدادات بنجاح");
    } catch (error) {
      console.error("Error saving settings:", error);
      alert("حدث خطأ أثناء حفظ الإعدادات");
    } finally {
      setLoading(false);
    }
  };

  const togglePaymentMethod = (id: string) => {
    setPaymentMethods((prev) =>
      prev.map((method) =>
        method.id === id ? { ...method, enabled: !method.enabled } : method,
      ),
    );
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPass !== passwordForm.confirm) {
      alert("كلمتا المرور غير متطابقتين");
      return;
    }
    if (passwordForm.newPass.length < 6) {
      alert("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }
    setPasswordLoading(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser || !currentUser.email)
        throw new Error("لم يتم العثور على المستخدم");
      const credential = EmailAuthProvider.credential(
        currentUser.email,
        passwordForm.current,
      );
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, passwordForm.newPass);
      alert("تم تغيير كلمة المرور بنجاح");
      setShowPasswordModal(false);
      setPasswordForm({ current: "", newPass: "", confirm: "" });
    } catch (error: unknown) {
      console.error("Password change error:", error);
      const msg =
        (error as { code?: string })?.code === "auth/wrong-password"
          ? "كلمة المرور الحالية غير صحيحة"
          : "حدث خطأ أثناء تغيير كلمة المرور";
      alert(msg);
    } finally {
      setPasswordLoading(false);
    }
  };

  const lastLogin = auth.currentUser?.metadata?.lastSignInTime
    ? new Date(auth.currentUser.metadata.lastSignInTime).toLocaleString("ar-SA")
    : "غير متوفر";

  const tabs = [
    { id: "store", label: "المتجر", icon: Store },
    { id: "shipping", label: "الشحن", icon: Truck },
    { id: "notifications", label: "الإشعارات", icon: Bell },
    { id: "payment", label: "الدفع", icon: CreditCard },
    { id: "security", label: "الأمان", icon: Shield },
  ];

  return (
    <div className="settings-page">
      {/* Page Header */}
      <div className="page-header">
        <h1>الإعدادات</h1>
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
          حفظ التغييرات
        </button>
      </div>

      <div className="settings-layout">
        {/* Tabs */}
        <div className="settings-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`tab-btn ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <tab.icon size={20} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="settings-content">
          {/* Store Settings */}
          {activeTab === "store" && (
            <div className="settings-card">
              <div className="card-header">
                <Store size={22} />
                <h2>إعدادات المتجر</h2>
              </div>
              <div className="settings-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>اسم المتجر</label>
                    <input
                      type="text"
                      value={storeSettings.storeName}
                      onChange={(e) =>
                        setStoreSettings({
                          ...storeSettings,
                          storeName: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>البريد الإلكتروني</label>
                    <input
                      type="email"
                      value={storeSettings.storeEmail}
                      onChange={(e) =>
                        setStoreSettings({
                          ...storeSettings,
                          storeEmail: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>رقم الهاتف</label>
                    <input
                      type="tel"
                      value={storeSettings.storePhone}
                      onChange={(e) =>
                        setStoreSettings({
                          ...storeSettings,
                          storePhone: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>العنوان</label>
                    <input
                      type="text"
                      value={storeSettings.storeAddress}
                      onChange={(e) =>
                        setStoreSettings({
                          ...storeSettings,
                          storeAddress: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>العملة</label>
                    <select
                      value={storeSettings.currency}
                      onChange={(e) =>
                        setStoreSettings({
                          ...storeSettings,
                          currency: e.target.value,
                        })
                      }
                    >
                      <option value="SAR">ريال سعودي (SAR)</option>
                      <option value="AED">درهم إماراتي (AED)</option>
                      <option value="KWD">دينار كويتي (KWD)</option>
                      <option value="USD">دولار أمريكي (USD)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>اللغة</label>
                    <select
                      value={storeSettings.language}
                      onChange={(e) =>
                        setStoreSettings({
                          ...storeSettings,
                          language: e.target.value,
                        })
                      }
                    >
                      <option value="ar">العربية</option>
                      <option value="en">English</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Shipping Settings */}
          {activeTab === "shipping" && (
            <div className="settings-card">
              <div className="card-header">
                <Truck size={22} />
                <h2>إعدادات الشحن</h2>
              </div>
              <div className="settings-form">
                <div className="form-group checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={shippingSettings.enableFreeShipping}
                      onChange={(e) =>
                        setShippingSettings({
                          ...shippingSettings,
                          enableFreeShipping: e.target.checked,
                        })
                      }
                    />
                    <span>تفعيل الشحن المجاني</span>
                  </label>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>الحد الأدنى للشحن المجاني (ر.س)</label>
                    <input
                      type="number"
                      value={shippingSettings.freeShippingThreshold}
                      onChange={(e) =>
                        setShippingSettings({
                          ...shippingSettings,
                          freeShippingThreshold: Number(e.target.value),
                        })
                      }
                      disabled={!shippingSettings.enableFreeShipping}
                    />
                  </div>
                  <div className="form-group">
                    <label>تكلفة الشحن الافتراضية (ر.س)</label>
                    <input
                      type="number"
                      value={shippingSettings.defaultShippingCost}
                      onChange={(e) =>
                        setShippingSettings({
                          ...shippingSettings,
                          defaultShippingCost: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>مدة التوصيل المتوقعة</label>
                  <input
                    type="text"
                    value={shippingSettings.estimatedDays}
                    onChange={(e) =>
                      setShippingSettings({
                        ...shippingSettings,
                        estimatedDays: e.target.value,
                      })
                    }
                    placeholder="مثال: 3-5 أيام"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Notification Settings */}
          {activeTab === "notifications" && (
            <div className="settings-card">
              <div className="card-header">
                <Bell size={22} />
                <h2>إعدادات الإشعارات</h2>
              </div>
              <div className="settings-form">
                <div className="form-group checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={notificationSettings.orderNotifications}
                      onChange={(e) =>
                        setNotificationSettings({
                          ...notificationSettings,
                          orderNotifications: e.target.checked,
                        })
                      }
                    />
                    <span>إشعارات الطلبات الجديدة</span>
                  </label>
                </div>
                <div className="form-group checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={notificationSettings.lowStockAlert}
                      onChange={(e) =>
                        setNotificationSettings({
                          ...notificationSettings,
                          lowStockAlert: e.target.checked,
                        })
                      }
                    />
                    <span>تنبيه انخفاض المخزون</span>
                  </label>
                </div>
                {notificationSettings.lowStockAlert && (
                  <div className="form-group sub-setting">
                    <label>الحد الأدنى للتنبيه</label>
                    <input
                      type="number"
                      value={notificationSettings.lowStockThreshold}
                      onChange={(e) =>
                        setNotificationSettings({
                          ...notificationSettings,
                          lowStockThreshold: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                )}
                <div className="form-group checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={notificationSettings.customerMessages}
                      onChange={(e) =>
                        setNotificationSettings({
                          ...notificationSettings,
                          customerMessages: e.target.checked,
                        })
                      }
                    />
                    <span>رسائل العملاء</span>
                  </label>
                </div>
                <div className="form-group checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={notificationSettings.marketingEmails}
                      onChange={(e) =>
                        setNotificationSettings({
                          ...notificationSettings,
                          marketingEmails: e.target.checked,
                        })
                      }
                    />
                    <span>رسائل تسويقية</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Payment Settings */}
          {activeTab === "payment" && (
            <div className="settings-card">
              <div className="card-header">
                <CreditCard size={22} />
                <h2>إعدادات الدفع</h2>
              </div>
              <div className="settings-form">
                <p className="settings-description">
                  اختر طرق الدفع المتاحة للعملاء في المتجر
                </p>
                <div className="payment-methods">
                  {paymentMethods.map((method) => (
                    <div key={method.id} className="payment-method">
                      <div className="method-info">
                        <span className="method-name">{method.name}</span>
                        <span className="method-desc">
                          {method.id === "cash" &&
                            "يدفع العميل عند استلام الطلب"}
                          {method.id === "bank" && "تحويل مباشر للحساب البنكي"}
                          {method.id === "card" && "Visa, Mastercard, Mada"}
                        </span>
                      </div>
                      <label className="toggle">
                        <input
                          type="checkbox"
                          checked={method.enabled}
                          onChange={() => togglePaymentMethod(method.id)}
                          disabled={method.id === "card"}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Security Settings */}
          {activeTab === "security" && (
            <div className="settings-card">
              <div className="card-header">
                <Shield size={22} />
                <h2>إعدادات الأمان</h2>
              </div>
              <div className="settings-form">
                <div className="security-info">
                  <p>
                    <strong>البريد الإلكتروني:</strong> {user?.email}
                  </p>
                  <p>
                    <strong>الدور:</strong>{" "}
                    {user?.role === "admin" ? "مدير النظام" : "عميل"}
                  </p>
                  <p>
                    <strong>آخر تسجيل دخول:</strong> {lastLogin}
                  </p>
                </div>
                <div className="form-group">
                  <button
                    className="btn btn-outline"
                    onClick={() => setShowPasswordModal(true)}
                  >
                    تغيير كلمة المرور
                  </button>
                </div>
                <div className="form-group">
                  <button
                    className="btn btn-outline"
                    disabled
                    onClick={() => alert("هذه الميزة ستكون متاحة قريباً")}
                  >
                    تفعيل المصادقة الثنائية (قريباً)
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowPasswordModal(false)}
        >
          <div className="modal small" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>تغيير كلمة المرور</h2>
              <button
                className="close-btn"
                onClick={() => setShowPasswordModal(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleChangePassword}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">كلمة المرور الحالية</label>
                  <input
                    type="password"
                    className="form-input"
                    value={passwordForm.current}
                    onChange={(e) =>
                      setPasswordForm({
                        ...passwordForm,
                        current: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">كلمة المرور الجديدة</label>
                  <input
                    type="password"
                    className="form-input"
                    value={passwordForm.newPass}
                    onChange={(e) =>
                      setPasswordForm({
                        ...passwordForm,
                        newPass: e.target.value,
                      })
                    }
                    required
                    minLength={6}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">تأكيد كلمة المرور</label>
                  <input
                    type="password"
                    className="form-input"
                    value={passwordForm.confirm}
                    onChange={(e) =>
                      setPasswordForm({
                        ...passwordForm,
                        confirm: e.target.value,
                      })
                    }
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowPasswordModal(false)}
                  disabled={passwordLoading}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={passwordLoading}
                >
                  {passwordLoading ? (
                    <Loader className="spinner" size={18} />
                  ) : (
                    "تغيير كلمة المرور"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
