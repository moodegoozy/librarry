import React, { useState } from "react";
import {
  MapPin,
  Phone,
  Mail,
  Send,
  Clock,
  MessageSquare,
  Loader,
} from "lucide-react";
import { addContactMessage } from "../../services/firestore";
import "./Contact.css";

const Contact: React.FC = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await addContactMessage({
        name: formData.name,
        email: formData.email,
        phone: formData.phone || undefined,
        subject: formData.subject,
        message: formData.message,
      });
      setSubmitted(true);
    } catch (err) {
      console.error("Error sending message:", err);
      setError("حدث خطأ أثناء إرسال الرسالة. يرجى المحاولة مرة أخرى.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="contact-page">
      <div className="container">
        <div className="page-hero">
          <h1>اتصل بنا</h1>
          <p>نحن هنا لمساعدتك! تواصل معنا وسنرد عليك في أقرب وقت</p>
        </div>

        <div className="contact-grid">
          {/* Contact Info */}
          <div className="contact-info">
            <div className="info-card">
              <div className="info-icon">
                <Phone size={24} />
              </div>
              <div>
                <h3>اتصل بنا</h3>
                <p>920000000</p>
                <span>متاح 24/7</span>
              </div>
            </div>

            <div className="info-card">
              <div className="info-icon">
                <Mail size={24} />
              </div>
              <div>
                <h3>البريد الإلكتروني</h3>
                <p>info@jaboory.com</p>
                <span>نرد خلال 24 ساعة</span>
              </div>
            </div>

            <div className="info-card">
              <div className="info-icon">
                <MapPin size={24} />
              </div>
              <div>
                <h3>العنوان</h3>
                <p>الرياض، المملكة العربية السعودية</p>
              </div>
            </div>

            <div className="info-card">
              <div className="info-icon">
                <Clock size={24} />
              </div>
              <div>
                <h3>ساعات العمل</h3>
                <p>السبت - الخميس: 9 ص - 10 م</p>
                <span>الجمعة: 4 م - 10 م</span>
              </div>
            </div>

            <div className="whatsapp-btn">
              <a
                href="https://wa.me/966920000000"
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageSquare size={20} />
                تواصل عبر واتساب
              </a>
            </div>
          </div>

          {/* Contact Form */}
          <div className="contact-form-card">
            {submitted ? (
              <div className="success-message">
                <Send size={48} />
                <h2>تم إرسال رسالتك بنجاح!</h2>
                <p>شكراً لتواصلك معنا. سنرد عليك في أقرب وقت ممكن.</p>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setSubmitted(false);
                    setFormData({
                      name: "",
                      email: "",
                      phone: "",
                      subject: "",
                      message: "",
                    });
                  }}
                >
                  إرسال رسالة أخرى
                </button>
              </div>
            ) : (
              <>
                <h2>أرسل لنا رسالة</h2>
                {error && (
                  <div
                    style={{
                      background: "#fee2e2",
                      color: "#dc2626",
                      padding: "12px 16px",
                      borderRadius: 8,
                      marginBottom: 16,
                      fontSize: 14,
                    }}
                  >
                    {error}
                  </div>
                )}
                <form onSubmit={handleSubmit}>
                  <div className="form-row">
                    <div className="form-group">
                      <label>الاسم الكامل *</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        placeholder="اسمك الكامل"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>البريد الإلكتروني *</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                        placeholder="email@example.com"
                        required
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
                          setFormData({ ...formData, phone: e.target.value })
                        }
                        placeholder="05xxxxxxxx"
                      />
                    </div>
                    <div className="form-group">
                      <label>الموضوع *</label>
                      <select
                        value={formData.subject}
                        onChange={(e) =>
                          setFormData({ ...formData, subject: e.target.value })
                        }
                        required
                      >
                        <option value="">اختر الموضوع</option>
                        <option value="order">استفسار عن طلب</option>
                        <option value="product">استفسار عن منتج</option>
                        <option value="return">إرجاع أو استبدال</option>
                        <option value="complaint">شكوى</option>
                        <option value="suggestion">اقتراح</option>
                        <option value="other">أخرى</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>الرسالة *</label>
                    <textarea
                      value={formData.message}
                      onChange={(e) =>
                        setFormData({ ...formData, message: e.target.value })
                      }
                      placeholder="اكتب رسالتك هنا..."
                      rows={5}
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="btn btn-primary btn-lg btn-block"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader size={18} className="spinner" /> جاري الإرسال...
                      </>
                    ) : (
                      <>
                        <Send size={18} /> إرسال الرسالة
                      </>
                    )}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contact;
