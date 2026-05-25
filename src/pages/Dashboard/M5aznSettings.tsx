import React, { useState, useEffect } from "react";
import {
  Key,
  RefreshCw,
  Loader,
  Check,
  X,
  Copy,
  Eye,
  EyeOff,
  Store,
  Power,
  AlertTriangle,
} from "lucide-react";
import {
  generateM5aznKeys,
  getM5aznKeysStatus,
  setM5aznEnabled,
  getStoreApiBaseUrl,
  getHostingApiBaseUrl,
  type WooKeysStatus,
} from "../../services/m5azn";
import "./M5aznSettings.css";

const M5aznSettings: React.FC = () => {
  const [status, setStatus] = useState<WooKeysStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const cfUrl = getStoreApiBaseUrl();
  const hostingUrl = getHostingApiBaseUrl();

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadStatus = async () => {
    try {
      const s = await getM5aznKeysStatus();
      setStatus(s);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { consumerKey, consumerSecret } = await generateM5aznKeys();
      setNewKey(consumerKey);
      setNewSecret(consumerSecret);
      setShowSecret(true);
      setConfirmRotate(false);
      await loadStatus();
      showToast("تم توليد المفاتيح بنجاح. انسخ السر الآن — لن يظهر مرة أخرى!", "success");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "فشل التوليد";
      showToast(msg, "error");
    } finally {
      setGenerating(false);
    }
  };

  const handleToggle = async () => {
    if (!status?.exists) return;
    setToggling(true);
    try {
      const res = await setM5aznEnabled(!status.enabled);
      setStatus({ ...status, enabled: res.enabled });
      showToast(res.enabled ? "تم تفعيل التكامل" : "تم تعطيل التكامل", "success");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "فشل التحديث";
      showToast(msg, "error");
    } finally {
      setToggling(false);
    }
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(
      () => showToast(`تم نسخ ${label}`, "success"),
      () => showToast("فشل النسخ", "error"),
    );
  };

  if (loading) {
    return (
      <div className="m5azn-loading">
        <Loader size={40} className="spinner" />
      </div>
    );
  }

  return (
    <div className="m5azn-settings-page">
      {toast && (
        <div className={`m5azn-toast ${toast.type}`}>
          {toast.type === "success" ? <Check size={16} /> : <X size={16} />}
          {toast.message}
        </div>
      )}

      <div className="page-header">
        <h2>
          <Store size={24} />
          ربط مع مخازن (m5azn)
        </h2>
      </div>

      <div className="m5azn-cards">
        {/* بطاقة المعلومات */}
        <div className="settings-card info-card">
          <div className="card-title">
            <Store size={20} />
            معلومات الربط لإدخالها في لوحة مخازن
          </div>
          <p className="card-desc">
            عند ربط متجرك في لوحة مخازن، اختر <strong>WooCommerce</strong> ثم أدخل القيم التالية:
          </p>

          <div className="kv-row">
            <label>رابط المتجر (Store URL)</label>
            <div className="kv-value">
              <code dir="ltr">{hostingUrl}</code>
              <button className="icon-btn" onClick={() => copy(hostingUrl, "رابط المتجر")} title="نسخ">
                <Copy size={14} />
              </button>
            </div>
            <span className="hint">
              يتطلب إضافة rewrite في Firebase Hosting لـ <code>/wp-json/**</code>. 
              أو استخدم رابط Cloud Function المباشر أدناه.
            </span>
          </div>

          <div className="kv-row">
            <label>الرابط البديل (Cloud Function مباشر)</label>
            <div className="kv-value">
              <code dir="ltr">{cfUrl}</code>
              <button className="icon-btn" onClick={() => copy(cfUrl, "الرابط")} title="نسخ">
                <Copy size={14} />
              </button>
            </div>
            <span className="hint">
              إذا طلب مخازن أن يكون الرابط ينتهي بـ <code>/wp-json</code>، استخدم:{" "}
              <code dir="ltr">{cfUrl}/wp-json</code>
            </span>
          </div>
        </div>

        {/* بطاقة المفاتيح */}
        <div className="settings-card">
          <div className="card-title">
            <Key size={20} />
            مفاتيح API
          </div>

          {!status?.exists ? (
            <>
              <p className="card-desc">
                لم تُنشئ مفاتيح بعد. اضغط توليد لإنشاء <code>Consumer Key</code> و{" "}
                <code>Consumer Secret</code>.
              </p>
              <button className="btn-primary" disabled={generating} onClick={handleGenerate}>
                {generating ? <Loader size={16} className="spinner" /> : <Key size={16} />}
                توليد مفاتيح جديدة
              </button>
            </>
          ) : (
            <>
              <div className="kv-row">
                <label>Consumer Key (مفتاح API)</label>
                <div className="kv-value">
                  <code dir="ltr">{status.consumerKey}</code>
                  <button
                    className="icon-btn"
                    onClick={() => copy(status.consumerKey || "", "المفتاح")}
                    title="نسخ"
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </div>

              {newSecret ? (
                <div className="kv-row secret-row">
                  <label>
                    <AlertTriangle size={14} /> Consumer Secret (سر المستهلك) — يظهر مرة واحدة فقط!
                  </label>
                  <div className="kv-value">
                    <code dir="ltr">
                      {showSecret ? newSecret : "•".repeat(newSecret.length)}
                    </code>
                    <button
                      className="icon-btn"
                      onClick={() => setShowSecret((s) => !s)}
                      title={showSecret ? "إخفاء" : "إظهار"}
                    >
                      {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    <button
                      className="icon-btn"
                      onClick={() => copy(newSecret, "السر")}
                      title="نسخ"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                  <span className="hint warn">
                    احفظه الآن في لوحة مخازن. بعد إعادة تحميل الصفحة لن يظهر مرة أخرى.
                  </span>
                  {newKey && newKey !== status.consumerKey && (
                    <span className="hint">المفتاح المُولّد للتو: <code dir="ltr">{newKey}</code></span>
                  )}
                </div>
              ) : (
                <div className="kv-row">
                  <label>Consumer Secret</label>
                  <div className="kv-value muted">
                    <code dir="ltr">••••••••••••••••••••••••</code>
                    <span className="hint">السر مُخزّن كـ hash ولا يمكن استرجاعه. ولّد مفاتيح جديدة لو احتجت سراً جديداً.</span>
                  </div>
                </div>
              )}

              <div className="actions-row">
                <button
                  className="btn-secondary"
                  onClick={handleToggle}
                  disabled={toggling}
                >
                  <Power size={16} />
                  {status.enabled ? "تعطيل التكامل" : "تفعيل التكامل"}
                </button>

                {!confirmRotate ? (
                  <button
                    className="btn-danger-outline"
                    onClick={() => setConfirmRotate(true)}
                  >
                    <RefreshCw size={16} />
                    إعادة توليد المفاتيح
                  </button>
                ) : (
                  <>
                    <button
                      className="btn-danger"
                      onClick={handleGenerate}
                      disabled={generating}
                    >
                      {generating ? <Loader size={16} className="spinner" /> : <RefreshCw size={16} />}
                      تأكيد الإعادة (سيُلغي القديم)
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => setConfirmRotate(false)}
                      disabled={generating}
                    >
                      إلغاء
                    </button>
                  </>
                )}
              </div>

              <div className="status-badge-row">
                <span className={`status-badge ${status.enabled ? "on" : "off"}`}>
                  {status.enabled ? <Check size={14} /> : <X size={14} />}
                  {status.enabled ? "مُفعّل" : "مُعطّل"}
                </span>
                {status.rotatedAt && (
                  <span className="meta">
                    آخر توليد: {new Date(status.rotatedAt).toLocaleString("ar-SA")}
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {/* بطاقة التعليمات */}
        <div className="settings-card">
          <div className="card-title">
            <Store size={20} />
            خطوات الربط في مخازن
          </div>
          <ol className="steps">
            <li>سجّل دخول إلى <a href="https://m5azn.com/login" target="_blank" rel="noreferrer">m5azn.com</a> ثم اذهب إلى إعدادات الربط (Integrations).</li>
            <li>اختر <strong>WooCommerce</strong> كنوع المتجر.</li>
            <li>الصق رابط المتجر و <code>Consumer Key</code> و <code>Consumer Secret</code> من البطاقات أعلاه.</li>
            <li>اضغط تأكيد الربط. مخازن سيختبر الاتصال — يجب أن يستجيب متجرك بنجاح.</li>
            <li>بعد نجاح الربط، يستطيع مخازن قراءة منتجاتك، تحديث المخزون، واستقبال طلباتك تلقائياً.</li>
          </ol>
          <p className="card-desc" style={{ marginTop: 16 }}>
            تحتاج مساعدة؟{" "}
            <a href="https://wa.me/966920033015" target="_blank" rel="noreferrer">
              تواصل مع دعم مخازن (واتساب)
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default M5aznSettings;
