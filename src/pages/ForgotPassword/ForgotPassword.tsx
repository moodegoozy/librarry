import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, ArrowRight, Check } from "lucide-react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../../config/firebase";
import "../Login/Login.css";

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await sendPasswordResetEmail(auth, email);
      setSent(true);
    } catch (err: unknown) {
      const firebaseError = err as { code?: string };
      if (firebaseError.code === "auth/user-not-found") {
        setError("لا يوجد حساب بهذا البريد الإلكتروني");
      } else if (firebaseError.code === "auth/invalid-email") {
        setError("البريد الإلكتروني غير صالح");
      } else {
        setError("حدث خطأ. يرجى المحاولة مرة أخرى.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-box">
          <div className="login-header">
            <Link to="/" className="login-logo">
              <span className="logo-text">جبوري</span>
              <span className="logo-sub">للإلكترونيات</span>
            </Link>
            <h1>استعادة كلمة المرور</h1>
            <p>أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة تعيين كلمة المرور</p>
          </div>

          {sent ? (
            <div style={{ textAlign: "center", padding: "30px 0" }}>
              <div
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: "50%",
                  background: "#dcfce7",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 16px",
                }}
              >
                <Check size={30} color="#22c55e" />
              </div>
              <h2 style={{ marginBottom: 10, color: "var(--dark)" }}>
                تم الإرسال!
              </h2>
              <p style={{ color: "var(--gray)", marginBottom: 24 }}>
                تم إرسال رابط إعادة تعيين كلمة المرور إلى
                <br />
                <strong>{email}</strong>
              </p>
              <p
                style={{ color: "var(--gray)", fontSize: 14, marginBottom: 20 }}
              >
                تحقق من بريدك الإلكتروني واتبع التعليمات
              </p>
              <Link
                to="/login"
                className="btn btn-primary btn-lg"
                style={{ width: "100%" }}
              >
                العودة لتسجيل الدخول
              </Link>
            </div>
          ) : (
            <>
              {error && <div className="alert alert-error">{error}</div>}

              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label className="form-label">البريد الإلكتروني</label>
                  <div className="input-icon">
                    <Mail size={20} />
                    <input
                      type="email"
                      className="form-input"
                      placeholder="example@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-lg btn-block"
                  disabled={loading}
                  style={{ width: "100%" }}
                >
                  {loading ? "جاري الإرسال..." : "إرسال رابط الاستعادة"}
                </button>
              </form>

              <div className="login-footer" style={{ marginTop: 20 }}>
                <p>
                  <Link
                    to="/login"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <ArrowRight size={16} />
                    العودة لتسجيل الدخول
                  </Link>
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
