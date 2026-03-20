import React from "react";
import { Link } from "react-router-dom";
import {
  Facebook,
  Twitter,
  Instagram,
  Youtube,
  MapPin,
  Phone,
  Mail,
  CreditCard,
  Truck,
  Shield,
  Headphones,
} from "lucide-react";
import "./Footer.css";

const Footer: React.FC = () => {
  return (
    <footer className="footer">
      {/* Features */}
      <div className="footer-features">
        <div className="container">
          <div className="features-grid">
            <div className="feature-item">
              <Truck size={32} />
              <div>
                <h4>شحن سريع</h4>
                <p>توصيل لجميع المناطق</p>
              </div>
            </div>
            <div className="feature-item">
              <Shield size={32} />
              <div>
                <h4>ضمان شامل</h4>
                <p>ضمان على جميع المنتجات</p>
              </div>
            </div>
            <div className="feature-item">
              <CreditCard size={32} />
              <div>
                <h4>دفع آمن</h4>
                <p>طرق دفع متعددة</p>
              </div>
            </div>
            <div className="feature-item">
              <Headphones size={32} />
              <div>
                <h4>دعم 24/7</h4>
                <p>خدمة عملاء متميزة</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer */}
      <div className="footer-main">
        <div className="container">
          <div className="footer-grid">
            {/* About */}
            <div className="footer-section">
              <h3 className="footer-title">جبوري للإلكترونيات</h3>
              <p className="footer-about">
                متجرك الأول للإلكترونيات والأجهزة الذكية. نقدم لك أفضل المنتجات
                بأفضل الأسعار مع ضمان الجودة وخدمة ما بعد البيع.
              </p>
              <div className="footer-social">
                <a href="#" className="social-link">
                  <Facebook size={20} />
                </a>
                <a href="#" className="social-link">
                  <Twitter size={20} />
                </a>
                <a href="#" className="social-link">
                  <Instagram size={20} />
                </a>
                <a href="#" className="social-link">
                  <Youtube size={20} />
                </a>
              </div>
            </div>

            {/* Quick Links */}
            <div className="footer-section">
              <h3 className="footer-title">روابط سريعة</h3>
              <ul className="footer-links">
                <li>
                  <Link to="/about">من نحن</Link>
                </li>
                <li>
                  <Link to="/contact">اتصل بنا</Link>
                </li>
                <li>
                  <Link to="/faq">الأسئلة الشائعة</Link>
                </li>
                <li>
                  <Link to="/shipping">سياسة الشحن</Link>
                </li>
                <li>
                  <Link to="/returns">سياسة الإرجاع</Link>
                </li>
                <li>
                  <Link to="/privacy">سياسة الخصوصية</Link>
                </li>
              </ul>
            </div>

            {/* Categories */}
            <div className="footer-section">
              <h3 className="footer-title">التصنيفات</h3>
              <ul className="footer-links">
                <li>
                  <Link to="/products?category=phones">الجوالات</Link>
                </li>
                <li>
                  <Link to="/products?category=laptops">اللابتوبات</Link>
                </li>
                <li>
                  <Link to="/products?category=tvs">التلفزيونات</Link>
                </li>
                <li>
                  <Link to="/products?category=gaming">الألعاب</Link>
                </li>
                <li>
                  <Link to="/products?category=audio">السماعات</Link>
                </li>
                <li>
                  <Link to="/products?category=accessories">الإكسسوارات</Link>
                </li>
              </ul>
            </div>

            {/* Contact */}
            <div className="footer-section">
              <h3 className="footer-title">تواصل معنا</h3>
              <ul className="footer-contact">
                <li>
                  <MapPin size={18} />
                  <span>الرياض، المملكة العربية السعودية</span>
                </li>
                <li>
                  <Phone size={18} />
                  <span>0556122411</span>
                </li>
                <li>
                  <Mail size={18} />
                  <span>jaboor1994@gmail.com</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="footer-bottom">
        <div className="container">
          <p>
            © {new Date().getFullYear()} جبوري للإلكترونيات. جميع الحقوق محفوظة.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
