import React, { useState, useEffect } from "react";
import {
  Settings,
  Key,
  DollarSign,
  Truck,
  Save,
  Loader,
  CheckCircle,
  XCircle,
  Zap,
  Wifi,
} from "lucide-react";
import {
  testCJConnection,
  saveCJSettings,
  loadCJSettings,
} from "../../services/cjDropshipping";
import type { CJSettings as CJSettingsType } from "../../types";
import "./CJSettings.css";

const CJSettings: React.FC = () => {
  const [settings, setSettings] = useState<Partial<CJSettingsType>>({
    apiKey: "",
    email: "",
    defaultMarkup: 30,
    usdToSar: 3.75,
    autoForwardOrders: true,
    defaultWarehouse: "CN",
    defaultLogistic: "CJPacket",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "disconnected" | "rate-limited" | "testing" | null
  >(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const showToast = (
    message: string,
    type: "success" | "error" = "success",
  ) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // تحميل الإعدادات
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const saved = await loadCJSettings();
        if (saved) {
          setSettings((prev) => ({ ...prev, ...saved }));
          if (saved.accessToken) {
            setConnectionStatus("connected");
          }
        }
      } catch (error) {
        console.error("Error loading CJ settings:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  // حفظ الإعدادات
  const handleSave = async () => {
    if (!settings.apiKey?.trim()) {
      showToast("يجب إدخال مفتاح CJ API", "error");
      return;
    }
    setSaving(true);
    try {
      await saveCJSettings(settings);
      showToast("تم حفظ الإعدادات بنجاح");
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "خطأ في الحفظ";
      showToast(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  // اختبار الاتصال
  const handleTestConnection = async () => {
    if (!settings.email?.trim() || !settings.apiKey?.trim()) {
      showToast("يجب إدخال البريد ومفتاح API أولاً", "error");
      return;
    }

    setTesting(true);
    setConnectionStatus("testing");
    try {
      const result = await testCJConnection(settings.email, settings.apiKey);
      if (result.success) {
        setConnectionStatus("connected");
        showToast("تم الاتصال بنجاح مع CJ Dropshipping! ✓");
        // حفظ الإعدادات بعد نجاح الاتصال
        await saveCJSettings(settings);
      } else {
        const isRateLimit =
          result.message?.includes("Too Many Requests") ||
          result.message?.includes("1600200");
        if (isRateLimit) {
          setConnectionStatus("rate-limited");
          showToast(
            "تم تجاوز حد الطلبات - انتظر 5 دقائق ثم حاول مرة أخرى",
            "error",
          );
          setCooldown(300);
          const interval = setInterval(() => {
            setCooldown((prev) => {
              if (prev <= 1) {
                clearInterval(interval);
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        } else {
          setConnectionStatus("disconnected");
          showToast(result.message || "فشل الاتصال", "error");
        }
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "خطأ في الاتصال";
      const isRateLimit =
        msg.includes("Too Many Requests") || msg.includes("1600200");
      if (isRateLimit) {
        setConnectionStatus("rate-limited");
        showToast(
          "تم تجاوز حد الطلبات - انتظر 5 دقائق ثم حاول مرة أخرى",
          "error",
        );
        setCooldown(300);
        const interval = setInterval(() => {
          setCooldown((prev) => {
            if (prev <= 1) {
              clearInterval(interval);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        setConnectionStatus("disconnected");
        showToast(msg, "error");
      }
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="cj-loading">
        <Loader size={40} className="spinner" />
      </div>
    );
  }

  return (
    <div className="cj-settings-page">
      <div className="page-header">
        <h2>
          <Settings size={24} />
          إعدادات CJ Dropshipping
        </h2>
      </div>

      <div className="cj-settings-cards">
        {/* مفتاح API */}
        <div className="settings-card">
          <div className="card-title">
            <Key size={20} />
            الاتصال بـ CJ Dropshipping
          </div>
          <p className="card-desc">
            أدخل بريدك الإلكتروني ومفتاح API من لوحة تحكم CJ Dropshipping للربط
            مع متجرك
          </p>

          <div className="form-group">
            <label>البريد الإلكتروني لحساب CJ</label>
            <input
              type="email"
              value={settings.email || ""}
              onChange={(e) =>
                setSettings({ ...settings, email: e.target.value })
              }
              placeholder="example@email.com"
              dir="ltr"
            />
            <p className="form-hint">
              البريد الإلكتروني المسجل به في CJ Dropshipping (مطلوب للاتصال)
            </p>
          </div>

          <div className="form-group">
            <label>مفتاح API (API Key)</label>
            <input
              type="password"
              value={settings.apiKey || ""}
              onChange={(e) =>
                setSettings({ ...settings, apiKey: e.target.value })
              }
              placeholder="أدخل مفتاح CJ API..."
              dir="ltr"
            />
            <p className="form-hint">
              يمكنك الحصول على المفتاح من: CJ Dropshipping → My CJ → API
            </p>
          </div>

          <div className="settings-actions">
            <button
              className="btn-test"
              onClick={handleTestConnection}
              disabled={
                testing ||
                !settings.email?.trim() ||
                !settings.apiKey?.trim() ||
                cooldown > 0
              }
            >
              {testing ? (
                <>
                  <Loader size={16} className="spinner" />
                  جاري الاختبار...
                </>
              ) : (
                <>
                  <Wifi size={16} />
                  اختبار الاتصال
                </>
              )}
            </button>
          </div>

          {connectionStatus && (
            <div className={`connection-status ${connectionStatus}`}>
              {connectionStatus === "connected" && (
                <>
                  <CheckCircle size={18} />
                  متصل بنجاح مع CJ Dropshipping
                </>
              )}
              {connectionStatus === "disconnected" && (
                <>
                  <XCircle size={18} />
                  غير متصل - تحقق من مفتاح API
                </>
              )}
              {connectionStatus === "rate-limited" && (
                <>
                  <Loader size={18} className="spinner" />
                  تم تجاوز حد الطلبات -{" "}
                  {cooldown > 0
                    ? `انتظر ${Math.floor(cooldown / 60)}:${String(cooldown % 60).padStart(2, "0")} ثم حاول مرة أخرى`
                    : "يمكنك المحاولة الآن"}
                </>
              )}
              {connectionStatus === "testing" && (
                <>
                  <Loader size={18} className="spinner" />
                  جاري اختبار الاتصال...
                </>
              )}
            </div>
          )}
        </div>

        {/* إعدادات التسعير */}
        <div className="settings-card">
          <div className="card-title">
            <DollarSign size={20} />
            إعدادات التسعير
          </div>
          <p className="card-desc">
            حدد نسبة الربح وسعر تحويل العملات لتسعير المنتجات تلقائياً
          </p>

          <div className="form-row">
            <div className="form-group">
              <label>نسبة الربح الافتراضية (%)</label>
              <input
                type="number"
                value={settings.defaultMarkup || 30}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    defaultMarkup: Number(e.target.value),
                  })
                }
                min={0}
                max={500}
              />
              <p className="form-hint">
                مثال: 30% = منتج بتكلفة $10 يُباع بـ{" "}
                {(
                  10 *
                  (settings.usdToSar || 3.75) *
                  (1 + (settings.defaultMarkup || 30) / 100)
                ).toFixed(0)}{" "}
                ر.س
              </p>
            </div>
            <div className="form-group">
              <label>سعر تحويل الدولار (ر.س)</label>
              <input
                type="number"
                value={settings.usdToSar || 3.75}
                onChange={(e) =>
                  setSettings({ ...settings, usdToSar: Number(e.target.value) })
                }
                min={0}
                step={0.01}
              />
              <p className="form-hint">
                سعر الصرف الحالي: 1 USD = {settings.usdToSar || 3.75} SAR
              </p>
            </div>
          </div>
        </div>

        {/* إعدادات الشحن */}
        <div className="settings-card">
          <div className="card-title">
            <Truck size={20} />
            إعدادات الشحن والطلبات
          </div>
          <p className="card-desc">
            حدد المستودع الافتراضي وشركة الشحن للطلبات الجديدة
          </p>

          <div className="form-row">
            <div className="form-group">
              <label>المستودع الافتراضي</label>
              <select
                value={settings.defaultWarehouse || "CN"}
                onChange={(e) =>
                  setSettings({ ...settings, defaultWarehouse: e.target.value })
                }
              >
                <option value="CN">الصين (CN)</option>
                <option value="US">الولايات المتحدة (US)</option>
                <option value="TH">تايلاند (TH)</option>
                <option value="DE">ألمانيا (DE)</option>
                <option value="ID">إندونيسيا (ID)</option>
              </select>
            </div>
            <div className="form-group">
              <label>شركة الشحن الافتراضية</label>
              <select
                value={settings.defaultLogistic || "CJPacket"}
                onChange={(e) =>
                  setSettings({ ...settings, defaultLogistic: e.target.value })
                }
              >
                <option value="CJPacket">CJ Packet</option>
                <option value="ePacket">ePacket</option>
                <option value="USPS">USPS</option>
                <option value="YunExpress">Yun Express</option>
                <option value="CNE">CNE Express</option>
                <option value="Yanwen">Yanwen</option>
              </select>
            </div>
          </div>

          {/* التوغلات */}
          <div className="toggle-row">
            <div className="toggle-info">
              <div className="toggle-label">
                <Zap
                  size={14}
                  style={{ display: "inline", marginLeft: "4px" }}
                />
                إرسال الطلبات تلقائياً إلى CJ
              </div>
              <div className="toggle-desc">
                عند شراء العميل لمنتج CJ، يتم إرسال الطلب تلقائياً مع خصم من
                رصيدك
              </div>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.autoForwardOrders !== false}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    autoForwardOrders: e.target.checked,
                  })
                }
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>

        {/* زر الحفظ */}
        <div className="settings-actions">
          <button className="btn-save" onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader size={16} className="spinner" />
                جاري الحفظ...
              </>
            ) : (
              <>
                <Save size={16} />
                حفظ الإعدادات
              </>
            )}
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && <div className={`cj-toast ${toast.type}`}>{toast.message}</div>}
    </div>
  );
};

export default CJSettings;
