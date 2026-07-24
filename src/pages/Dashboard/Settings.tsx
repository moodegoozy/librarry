import React, { useState, useEffect } from "react";
import {
  Store,
  Bell,
  CreditCard,
  Truck,
  Shield,
  Save,
  Loader,
  Clock,
  Mail,
} from "lucide-react";
import { useStore } from "../../store/useStore";
import { getSettings, updateSettings } from "../../services/firestore";
import { saveTamaraSettings, testTamaraConnection } from "../../services/tamara";
import { saveTabbySettings, testTabbyConnection } from "../../services/tabby";
import {
  saveTapSettings,
  testTapConnection,
  getTapSettings,
} from "../../services/tap";
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
    storeEmail: "jaboor1994@gmail.com",
    storePhone: "0556122411",
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
    { id: "tamara", name: "تمارا - قسّمها على 3", enabled: true },
    { id: "tabby", name: "تابي - قسّمها على 4", enabled: true },
    { id: "tap", name: "تاب - مدى وبطاقات ومحافظ", enabled: true },
  ]);

  const [bankSettings, setBankSettings] = useState({
    bankName: "",
    accountName: "",
    iban: "",
    note: "يرجى إرسال إيصال التحويل عبر الواتساب",
  });

  const [tamaraSettings, setTamaraSettings] = useState({
    apiToken: "",
    isConnected: false,
  });
  const [tamaraLoading, setTamaraLoading] = useState(false);

  const [tabbySettings, setTabbySettings] = useState({
    publicKey: "",
    secretKey: "",
    isConnected: false,
  });
  const [tabbyLoading, setTabbyLoading] = useState(false);

  const [tapSettings, setTapSettings] = useState({
    publicKey: "",
    secretKey: "",
    isConnected: false,
  });
  const [tapLoading, setTapLoading] = useState(false);
  // معلومات المفتاح السري المحفوظ (مُقنّع — لا يُعاد إرساله للمتصفح)
  const [tapSaved, setTapSaved] = useState({
    hasSecretKey: false,
    secretKeyMasked: "",
    isLive: false,
  });

  const [emailSettings, setEmailSettings] = useState({
    smtpHost: "",
    smtpPort: 587,
    smtpUser: "",
    smtpPassword: "",
    fromEmail: "",
    fromName: "متجر جبوري",
  });
  const [emailLoading, setEmailLoading] = useState(false);

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
          if (settings.bank) setBankSettings(settings.bank);
          if (settings.email) setEmailSettings(settings.email);
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      }
    };
    fetchSettings();

    // مفاتيح تاب مخزّنة في مستند منفصل (settings/tap) — نجلبها لتعبئة النموذج
    const fetchTap = async () => {
      try {
        const tap = await getTapSettings();
        setTapSettings((prev) => ({ ...prev, publicKey: tap.publicKey || "" }));
        setTapSaved({
          hasSecretKey: tap.hasSecretKey,
          secretKeyMasked: tap.secretKeyMasked || "",
          isLive: !!tap.isLive,
        });
      } catch (error) {
        console.error("Error fetching Tap settings:", error);
      }
    };
    fetchTap();
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      const settingsData: StoreSettings = {
        store: storeSettings,
        shipping: shippingSettings,
        notifications: notificationSettings,
        payment: { methods: paymentMethods },
        bank: bankSettings,
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

  // اختبار وحفظ إعدادات تمارا
  const handleTestTamara = async () => {
    if (!tamaraSettings.apiToken) {
      alert("يرجى إدخال مفتاح API");
      return;
    }
    setTamaraLoading(true);
    try {
      const result = await testTamaraConnection(tamaraSettings.apiToken);
      if (result.success) {
        setTamaraSettings((prev) => ({ ...prev, isConnected: true }));
        alert("تم الاتصال بتمارا بنجاح!");
      }
    } catch (error: any) {
      console.error("Tamara test error:", error);
      alert(`فشل الاتصال: ${error.message || "خطأ غير معروف"}`);
      setTamaraSettings((prev) => ({ ...prev, isConnected: false }));
    } finally {
      setTamaraLoading(false);
    }
  };

  const handleSaveTamara = async () => {
    if (!tamaraSettings.apiToken) {
      alert("يرجى إدخال مفتاح API");
      return;
    }
    setTamaraLoading(true);
    try {
      await saveTamaraSettings(tamaraSettings.apiToken);
      alert("تم حفظ إعدادات تمارا بنجاح");
    } catch (error: any) {
      console.error("Tamara save error:", error);
      alert(`فشل الحفظ: ${error.message || "خطأ غير معروف"}`);
    } finally {
      setTamaraLoading(false);
    }
  };

  // اختبار وحفظ إعدادات تابي
  const handleTestTabby = async () => {
    if (!tabbySettings.publicKey || !tabbySettings.secretKey) {
      alert("يرجى إدخال مفاتيح API");
      return;
    }
    setTabbyLoading(true);
    try {
      const result = await testTabbyConnection(tabbySettings.publicKey, tabbySettings.secretKey);
      if (result.success) {
        setTabbySettings((prev) => ({ ...prev, isConnected: true }));
        alert("تم الاتصال بتابي بنجاح!");
      }
    } catch (error: any) {
      console.error("Tabby test error:", error);
      alert(`فشل الاتصال: ${error.message || "خطأ غير معروف"}`);
      setTabbySettings((prev) => ({ ...prev, isConnected: false }));
    } finally {
      setTabbyLoading(false);
    }
  };

  const handleSaveTabby = async () => {
    if (!tabbySettings.publicKey || !tabbySettings.secretKey) {
      alert("يرجى إدخال مفاتيح API");
      return;
    }
    setTabbyLoading(true);
    try {
      await saveTabbySettings(tabbySettings.publicKey, tabbySettings.secretKey);
      alert("تم حفظ إعدادات تابي بنجاح");
    } catch (error: any) {
      console.error("Tabby save error:", error);
      alert(`فشل الحفظ: ${error.message || "خطأ غير معروف"}`);
    } finally {
      setTabbyLoading(false);
    }
  };

  // اختبار وحفظ إعدادات تاب
  const handleTestTap = async () => {
    // إن كان هناك مفتاح محفوظ، نختبره دون الحاجة لإعادة كتابته
    if (!tapSettings.secretKey && !tapSaved.hasSecretKey) {
      alert("يرجى إدخال المفتاح السري");
      return;
    }
    setTapLoading(true);
    try {
      const result = await testTapConnection(
        tapSettings.secretKey,
        tapSettings.publicKey,
      );
      if (result.success) {
        setTapSettings((prev) => ({ ...prev, isConnected: true }));
        alert("تم الاتصال بتاب بنجاح!");
      }
    } catch (error: any) {
      console.error("Tap test error:", error);
      alert(`فشل الاتصال: ${error.message || "خطأ غير معروف"}`);
      setTapSettings((prev) => ({ ...prev, isConnected: false }));
    } finally {
      setTapLoading(false);
    }
  };

  const handleSaveTap = async () => {
    // يكفي وجود مفتاح محفوظ مسبقاً — لا نُجبر على إعادة كتابته
    if (!tapSettings.secretKey && !tapSaved.hasSecretKey) {
      alert("يرجى إدخال المفتاح السري");
      return;
    }
    setTapLoading(true);
    try {
      await saveTapSettings(tapSettings.secretKey, tapSettings.publicKey);
      // نعيد الجلب ليعكس النموذج ما هو محفوظ فعلاً
      const tap = await getTapSettings();
      setTapSaved({
        hasSecretKey: tap.hasSecretKey,
        secretKeyMasked: tap.secretKeyMasked || "",
        isLive: !!tap.isLive,
      });
      setTapSettings((prev) => ({ ...prev, secretKey: "" }));
      alert("تم حفظ إعدادات تاب بنجاح");
    } catch (error: any) {
      console.error("Tap save error:", error);
      alert(`فشل الحفظ: ${error.message || "خطأ غير معروف"}`);
    } finally {
      setTapLoading(false);
    }
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
    { id: "email", label: "البريد الإلكتروني", icon: Mail },
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
                          {method.id === "tamara" && "اشترِ الآن وادفع لاحقاً"}
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

                {/* Bank Transfer Settings */}
                <div className="bank-settings">
                  <h3>
                    <CreditCard size={18} />
                    بيانات الحساب البنكي (التحويل البنكي)
                  </h3>
                  <p className="settings-description">
                    تظهر هذه البيانات للعميل عند اختياره "التحويل البنكي" في صفحة
                    الدفع
                  </p>
                  <div className="form-row">
                    <div className="form-group">
                      <label>اسم البنك</label>
                      <input
                        type="text"
                        value={bankSettings.bankName}
                        onChange={(e) =>
                          setBankSettings((prev) => ({
                            ...prev,
                            bankName: e.target.value,
                          }))
                        }
                        placeholder="مثال: البنك الأهلي"
                      />
                    </div>
                    <div className="form-group">
                      <label>اسم صاحب الحساب</label>
                      <input
                        type="text"
                        value={bankSettings.accountName}
                        onChange={(e) =>
                          setBankSettings((prev) => ({
                            ...prev,
                            accountName: e.target.value,
                          }))
                        }
                        placeholder="مثال: جبوري للإلكترونيات"
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>رقم الآيبان (IBAN)</label>
                    <input
                      type="text"
                      value={bankSettings.iban}
                      onChange={(e) =>
                        setBankSettings((prev) => ({
                          ...prev,
                          iban: e.target.value.toUpperCase().replace(/\s/g, ""),
                        }))
                      }
                      placeholder="SA0000000000000000000000"
                      dir="ltr"
                    />
                  </div>
                  <div className="form-group">
                    <label>ملاحظة للعميل (اختياري)</label>
                    <input
                      type="text"
                      value={bankSettings.note}
                      onChange={(e) =>
                        setBankSettings((prev) => ({
                          ...prev,
                          note: e.target.value,
                        }))
                      }
                      placeholder="مثال: يرجى إرسال إيصال التحويل عبر الواتساب"
                    />
                  </div>
                </div>

                {/* Tamara Settings */}
                <div className="tamara-settings">
                  <h3>
                    <Clock size={18} />
                    إعدادات تمارا
                  </h3>
                  <div className="form-group">
                    <label>مفتاح API</label>
                    <input
                      type="password"
                      value={tamaraSettings.apiToken}
                      onChange={(e) =>
                        setTamaraSettings((prev) => ({
                          ...prev,
                          apiToken: e.target.value,
                          isConnected: false,
                        }))
                      }
                      placeholder="أدخل مفتاح API من تمارا"
                    />
                  </div>
                  <div className="tamara-actions">
                    <button
                      className="btn btn-outline"
                      onClick={handleTestTamara}
                      disabled={tamaraLoading}
                    >
                      {tamaraLoading ? (
                        <Loader className="spinner" size={16} />
                      ) : (
                        "اختبار الاتصال"
                      )}
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={handleSaveTamara}
                      disabled={tamaraLoading}
                    >
                      {tamaraLoading ? (
                        <Loader className="spinner" size={16} />
                      ) : (
                        "حفظ الإعدادات"
                      )}
                    </button>
                  </div>
                  {tamaraSettings.isConnected && (
                    <p className="success-text">✓ متصل بتمارا</p>
                  )}
                </div>

                {/* Tabby Settings */}
                <div className="tabby-settings">
                  <h3>
                    <Clock size={18} />
                    إعدادات تابي
                  </h3>
                  <div className="form-group">
                    <label>المفتاح العام (Public Key)</label>
                    <input
                      type="text"
                      value={tabbySettings.publicKey}
                      onChange={(e) =>
                        setTabbySettings((prev) => ({
                          ...prev,
                          publicKey: e.target.value,
                          isConnected: false,
                        }))
                      }
                      placeholder="pk_xxxxx..."
                    />
                  </div>
                  <div className="form-group">
                    <label>المفتاح السري (Secret Key)</label>
                    <input
                      type="password"
                      value={tabbySettings.secretKey}
                      onChange={(e) =>
                        setTabbySettings((prev) => ({
                          ...prev,
                          secretKey: e.target.value,
                          isConnected: false,
                        }))
                      }
                      placeholder="sk_xxxxx..."
                    />
                  </div>
                  <div className="tabby-actions">
                    <button
                      className="btn btn-outline"
                      onClick={handleTestTabby}
                      disabled={tabbyLoading}
                    >
                      {tabbyLoading ? (
                        <Loader className="spinner" size={16} />
                      ) : (
                        "اختبار الاتصال"
                      )}
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={handleSaveTabby}
                      disabled={tabbyLoading}
                    >
                      {tabbyLoading ? (
                        <Loader className="spinner" size={16} />
                      ) : (
                        "حفظ الإعدادات"
                      )}
                    </button>
                  </div>
                  {tabbySettings.isConnected && (
                    <p className="success-text">✓ متصل بتابي</p>
                  )}
                </div>

                {/* Tap Settings */}
                <div className="tabby-settings">
                  <h3>
                    <CreditCard size={18} />
                    إعدادات تاب (Tap)
                  </h3>
                  <p className="settings-hint">
                    تعرض صفحة تاب جميع وسائل الدفع المفعّلة في حسابك تلقائياً
                    (مدى، فيزا، ماستركارد، أمريكان إكسبريس، آبل باي، KNET...).
                    فعّل الوسائل التي تريدها من لوحة تحكم تاب.
                  </p>
                  <div className="form-group">
                    <label>المفتاح العام (Public Key)</label>
                    <input
                      type="text"
                      value={tapSettings.publicKey}
                      onChange={(e) =>
                        setTapSettings((prev) => ({
                          ...prev,
                          publicKey: e.target.value.trim(),
                          isConnected: false,
                        }))
                      }
                      placeholder="pk_live_xxxxx..."
                      dir="ltr"
                    />
                  </div>
                  <div className="form-group">
                    <label>المفتاح السري (Secret Key)</label>
                    <input
                      type="password"
                      value={tapSettings.secretKey}
                      onChange={(e) =>
                        setTapSettings((prev) => ({
                          ...prev,
                          secretKey: e.target.value.trim(),
                          isConnected: false,
                        }))
                      }
                      placeholder={
                        tapSaved.hasSecretKey
                          ? tapSaved.secretKeyMasked
                          : "sk_live_xxxxx..."
                      }
                      dir="ltr"
                    />
                    {tapSaved.hasSecretKey && (
                      <small
                        style={{
                          display: "block",
                          marginTop: "6px",
                          color: "var(--success)",
                          fontWeight: 600,
                        }}
                      >
                        ✓ مفتاح محفوظ ({tapSaved.isLive ? "Live" : "Test"}) —
                        اتركه فارغاً للإبقاء عليه، أو اكتب مفتاحاً جديداً
                        لاستبداله
                      </small>
                    )}
                  </div>
                  <div className="tabby-actions">
                    <button
                      className="btn btn-outline"
                      onClick={handleTestTap}
                      disabled={tapLoading}
                    >
                      {tapLoading ? (
                        <Loader className="spinner" size={16} />
                      ) : (
                        "اختبار الاتصال"
                      )}
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={handleSaveTap}
                      disabled={tapLoading}
                    >
                      {tapLoading ? (
                        <Loader className="spinner" size={16} />
                      ) : (
                        "حفظ الإعدادات"
                      )}
                    </button>
                  </div>
                  {tapSettings.isConnected && (
                    <p className="success-text">✓ متصل بتاب</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Email Settings */}
          {activeTab === "email" && (
            <div className="settings-card">
              <div className="card-header">
                <Mail size={22} />
                <h2>إعدادات البريد الإلكتروني</h2>
              </div>
              <p className="section-desc" style={{ marginBottom: "20px", color: "#64748b" }}>
                إعداد SMTP لإرسال إشعارات الطلبات للعملاء تلقائياً
              </p>
              <div className="settings-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>خادم SMTP</label>
                    <input
                      type="text"
                      value={emailSettings.smtpHost}
                      onChange={(e) =>
                        setEmailSettings({ ...emailSettings, smtpHost: e.target.value })
                      }
                      placeholder="smtp.gmail.com"
                    />
                  </div>
                  <div className="form-group">
                    <label>منفذ SMTP</label>
                    <input
                      type="number"
                      value={emailSettings.smtpPort}
                      onChange={(e) =>
                        setEmailSettings({ ...emailSettings, smtpPort: parseInt(e.target.value) || 587 })
                      }
                      placeholder="587"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>اسم المستخدم / البريد</label>
                    <input
                      type="email"
                      value={emailSettings.smtpUser}
                      onChange={(e) =>
                        setEmailSettings({ ...emailSettings, smtpUser: e.target.value })
                      }
                      placeholder="your@email.com"
                    />
                  </div>
                  <div className="form-group">
                    <label>كلمة مرور التطبيق</label>
                    <input
                      type="password"
                      value={emailSettings.smtpPassword}
                      onChange={(e) =>
                        setEmailSettings({ ...emailSettings, smtpPassword: e.target.value })
                      }
                      placeholder="••••••••••••••••"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>بريد المرسل</label>
                    <input
                      type="email"
                      value={emailSettings.fromEmail}
                      onChange={(e) =>
                        setEmailSettings({ ...emailSettings, fromEmail: e.target.value })
                      }
                      placeholder="noreply@jabory.com"
                    />
                  </div>
                  <div className="form-group">
                    <label>اسم المرسل</label>
                    <input
                      type="text"
                      value={emailSettings.fromName}
                      onChange={(e) =>
                        setEmailSettings({ ...emailSettings, fromName: e.target.value })
                      }
                      placeholder="متجر جبوري"
                    />
                  </div>
                </div>
                <div className="info-box" style={{ marginTop: "20px", padding: "15px", background: "#f1f5f9", borderRadius: "8px" }}>
                  <h4 style={{ marginBottom: "10px", fontSize: "14px" }}>💡 إعدادات Gmail</h4>
                  <ul style={{ fontSize: "13px", color: "#64748b", paddingRight: "20px" }}>
                    <li>خادم SMTP: <code>smtp.gmail.com</code></li>
                    <li>المنفذ: <code>587</code></li>
                    <li>يجب تفعيل المصادقة الثنائية وإنشاء "كلمة مرور التطبيق" من حسابك</li>
                  </ul>
                </div>
                <div className="form-actions" style={{ marginTop: "20px" }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={async () => {
                      setEmailLoading(true);
                      try {
                        await updateSettings({ email: emailSettings });
                        alert("تم حفظ إعدادات البريد بنجاح");
                      } catch (error) {
                        console.error("Error saving email settings:", error);
                        alert("حدث خطأ أثناء الحفظ");
                      } finally {
                        setEmailLoading(false);
                      }
                    }}
                    disabled={emailLoading}
                  >
                    {emailLoading ? <Loader className="spinner" size={18} /> : <Save size={18} />}
                    حفظ إعدادات البريد
                  </button>
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
