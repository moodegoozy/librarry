import React, { useState, useEffect } from "react";
import { Settings, Key, DollarSign, RefreshCw, Loader, Check, X, Zap } from "lucide-react";
import {
  loadYakkyofySettings,
  saveYakkyofySettings,
  testYakkyofyConnection,
  type YakkyofySettings,
} from "../../services/yakkyofy";
import "./YakkyofySettings.css";

type ConnectionStatus = "idle" | "testing" | "connected" | "disconnected";

const DEFAULT_SETTINGS: YakkyofySettings = {
  apiKey: "40f39e7b-fe1c-4c44-b0c7-8e3300ab3784",
  defaultMarkup: 30,
  usdToSar: 3.75,
  autoForwardOrders: false,
};

const YakkyofySettings: React.FC = () => {
  const [settings, setSettings] = useState<YakkyofySettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const saved = await loadYakkyofySettings();
        if (saved) {
          setSettings({ ...DEFAULT_SETTINGS, ...saved });
          if (saved.apiKey) setConnectionStatus("connected");
        }
      } catch (error) {
        console.error("Error loading Yakkyofy settings:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    if (!settings.apiKey?.trim()) {
      showToast("يجب إدخال مفتاح Yakkyofy API", "error");
      return;
    }
    setSaving(true);
    try {
      await saveYakkyofySettings(settings);
      showToast("تم حفظ الإعدادات بنجاح ✓");
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "خطأ في الحفظ";
      showToast(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!settings.apiKey?.trim()) {
      showToast("يجب إدخال مفتاح API أولاً", "error");
      return;
    }
    setTesting(true);
    setConnectionStatus("testing");
    try {
      const result = await testYakkyofyConnection(settings.apiKey);
      if (result.success) {
        setConnectionStatus("connected");
        showToast("تم الاتصال بـ Yakkyofy بنجاح! ✓");
        await saveYakkyofySettings(settings);
      } else {
        setConnectionStatus("disconnected");
        showToast(result.message || "فشل الاتصال", "error");
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "خطأ في الاتصال";
      setConnectionStatus("disconnected");
      showToast(msg, "error");
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="yakkyofy-loading">
        <Loader size={40} className="spinner" />
      </div>
    );
  }

  return (
    <div className="yakkyofy-settings-page">
      {toast && (
        <div className={`yak-toast ${toast.type}`}>
          {toast.type === "success" ? <Check size={16} /> : <X size={16} />}
          {toast.message}
        </div>
      )}

      <div className="page-header">
        <h2>
          <Zap size={24} />
          إعدادات Yakkyofy
        </h2>
      </div>

      <div className="yak-settings-cards">
        {/* بطاقة مفتاح API */}
        <div className="settings-card">
          <div className="card-title">
            <Key size={20} />
            الاتصال بـ Yakkyofy
          </div>
          <p className="card-desc">
            أدخل مفتاح API الخاص بك من لوحة تحكم Yakkyofy لربطه بمتجرك
          </p>

          <div className="form-group">
            <label>مفتاح API</label>
            <input
              type="text"
              value={settings.apiKey}
              onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              dir="ltr"
            />
            <span className="form-hint">يمكنك إيجاده في إعدادات حسابك على Yakkyofy</span>
          </div>

          <div className="connection-status-row">
            <div className={`connection-badge ${connectionStatus}`}>
              {connectionStatus === "testing" && <Loader size={14} className="spinner" />}
              {connectionStatus === "connected" && <Check size={14} />}
              {connectionStatus === "disconnected" && <X size={14} />}
              {connectionStatus === "idle" && <RefreshCw size={14} />}
              <span>
                {connectionStatus === "testing" && "جاري الاختبار..."}
                {connectionStatus === "connected" && "متصل"}
                {connectionStatus === "disconnected" && "غير متصل"}
                {connectionStatus === "idle" && "لم يُختبر بعد"}
              </span>
            </div>

            <button
              className="btn-test"
              onClick={handleTestConnection}
              disabled={testing || !settings.apiKey?.trim()}
            >
              {testing ? <Loader size={16} className="spinner" /> : <RefreshCw size={16} />}
              اختبار الاتصال
            </button>
          </div>
        </div>

        {/* بطاقة إعدادات التسعير */}
        <div className="settings-card">
          <div className="card-title">
            <DollarSign size={20} />
            إعدادات التسعير
          </div>
          <p className="card-desc">ضبط هامش الربح وسعر صرف الدولار</p>

          <div className="form-group">
            <label>هامش الربح الافتراضي (%)</label>
            <input
              type="number"
              min={0}
              max={500}
              value={settings.defaultMarkup}
              onChange={(e) => setSettings({ ...settings, defaultMarkup: Number(e.target.value) })}
            />
            <span className="form-hint">النسبة المضافة فوق سعر التكلفة</span>
          </div>

          <div className="form-group">
            <label>سعر صرف USD → SAR</label>
            <input
              type="number"
              min={1}
              step={0.01}
              value={settings.usdToSar}
              onChange={(e) => setSettings({ ...settings, usdToSar: Number(e.target.value) })}
            />
          </div>

          <div className="pricing-preview">
            <span>مثال: منتج بـ <strong>$10</strong></span>
            <span>
              التكلفة:{" "}
              <strong>
                {(10 * settings.usdToSar).toFixed(2)} ر.س
              </strong>
            </span>
            <span>
              سعر البيع:{" "}
              <strong className="green">
                {(10 * settings.usdToSar * (1 + settings.defaultMarkup / 100)).toFixed(2)} ر.س
              </strong>
            </span>
          </div>
        </div>

        {/* بطاقة الإعدادات التلقائية */}
        <div className="settings-card">
          <div className="card-title">
            <Settings size={20} />
            إعدادات متقدمة
          </div>
          <p className="card-desc">
            التحكم في سلوك التوجيه التلقائي للطلبات
          </p>

          <div className="toggle-row">
            <div>
              <div className="toggle-label">إرسال الطلبات تلقائياً</div>
              <div className="toggle-desc">
                يُرسل طلبات العملاء تلقائياً إلى Yakkyofy عند الشراء
              </div>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.autoForwardOrders}
                onChange={(e) =>
                  setSettings({ ...settings, autoForwardOrders: e.target.checked })
                }
              />
              <span className="slider" />
            </label>
          </div>
        </div>

        {/* أزرار الحفظ */}
        <div className="settings-actions">
          <button className="btn-save" onClick={handleSave} disabled={saving}>
            {saving ? <Loader size={16} className="spinner" /> : <Check size={16} />}
            {saving ? "جاري الحفظ..." : "حفظ الإعدادات"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default YakkyofySettings;
