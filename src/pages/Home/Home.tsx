import React from "react";
import { Link } from "react-router-dom";
import {
  ChevronLeft,
  Smartphone,
  Laptop,
  Tv,
  Gamepad2,
  Headphones,
  Watch,
  Inbox,
  Package,
  Sparkles,
  Truck,
  ShieldCheck,
  CreditCard,
} from "lucide-react";
import ProductCard from "../../components/ProductCard/ProductCard";
import CircuitBackground from "../../components/CircuitBackground/CircuitBackground";
import { useStore } from "../../store/useStore";
import "./Home.css";
import "./Home.premium.css";

// خريطة الأيقونات حسب التصنيف
const iconMap: Record<string, React.ElementType> = {
  Smartphone,
  Laptop,
  Tv,
  Gamepad2,
  Headphones,
  Watch,
  Package,
};

const colorMap: Record<string, string> = {
  phones: "#3b82f6",
  laptops: "#8b5cf6",
  tvs: "#ec4899",
  gaming: "#10b981",
  audio: "#f59e0b",
  watches: "#6366f1",
};

const Home: React.FC = () => {
  const { products, categories } = useStore();

  const featuredProducts = products.filter((p) => p.featured);

  return (
    <div className="home">
      {/* Hero Section */}
      <section className="hero">
        <CircuitBackground />
        <div className="lux-aurora" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="container">
          <div className="hero-content">
            <div className="hero-text">
              <span className="hero-badge" data-reveal>
                <Sparkles size={15} /> عروض حصرية لفترة محدودة
              </span>
              <h1 data-reveal>
                أحدث الإلكترونيات
                <br />
                <span className="grad-text">بأفضل الأسعار</span>
              </h1>
              <p data-reveal>
                اكتشف تشكيلتنا الواسعة من الهواتف والأجهزة الذكية واللابتوبات مع
                ضمان شامل وشحن مجاني
              </p>
              <div className="hero-buttons" data-reveal>
                <Link to="/products" className="btn-lux">
                  تسوق الآن <ChevronLeft size={18} />
                </Link>
                <Link to="/products?featured=true" className="btn-lux-ghost">
                  عروض اليوم
                </Link>
              </div>

              <div className="hero-stats" data-reveal-stagger>
                <div className="hero-stat">
                  <strong>+٥٠٠</strong>
                  <span>منتج أصلي</span>
                </div>
                <div className="hero-stat">
                  <strong>شحن مجاني</strong>
                  <span>لكل الطلبات</span>
                </div>
                <div className="hero-stat">
                  <strong>ضمان شامل</strong>
                  <span>على كل جهاز</span>
                </div>
              </div>
            </div>
            <div className="hero-image" data-reveal="zoom">
              <div className="hero-image-glow" aria-hidden="true" />
              <img
                src="https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=600"
                alt="Electronics"
              />
            </div>
          </div>
        </div>
      </section>

      {/* شريط الثقة */}
      <section className="trust-strip">
        <div className="container">
          <div className="trust-grid" data-reveal-stagger>
            <div className="trust-item">
              <Truck size={26} />
              <div>
                <strong>شحن سريع مجاني</strong>
                <span>توصيل لجميع مدن المملكة</span>
              </div>
            </div>
            <div className="trust-item">
              <ShieldCheck size={26} />
              <div>
                <strong>ضمان أصلي</strong>
                <span>منتجات موثوقة ١٠٠٪</span>
              </div>
            </div>
            <div className="trust-item">
              <CreditCard size={26} />
              <div>
                <strong>دفع آمن</strong>
                <span>مدى، فيزا، أبل باي وتقسيط</span>
              </div>
            </div>
            <div className="trust-item">
              <Headphones size={26} />
              <div>
                <strong>دعم فني</strong>
                <span>نجيبك في أي وقت</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="categories-section">
        <div className="container">
          <div className="section-header" data-reveal>
            <h2 className="lux-heading">تسوق حسب التصنيف</h2>
            <Link to="/products" className="view-all">
              عرض الكل <ChevronLeft size={18} />
            </Link>
          </div>
          <div className="categories-grid" data-reveal-stagger>
            {categories.length > 0 ? (
              categories.map((cat) => {
                const IconComponent = iconMap[cat.icon] || Package;
                const color = colorMap[cat.id] || "#64748b";
                return (
                  <Link
                    key={cat.id}
                    to={`/products?category=${cat.id}`}
                    className="category-card"
                    style={{ "--cat-color": color } as React.CSSProperties}
                  >
                    <div className="category-icon">
                      <IconComponent size={32} />
                    </div>
                    <span>{cat.name}</span>
                  </Link>
                );
              })
            ) : (
              <p
                style={{
                  textAlign: "center",
                  color: "var(--gray)",
                  gridColumn: "1/-1",
                }}
              >
                لا توجد تصنيفات - أضفها من لوحة التحكم
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="products-section">
        <div className="container">
          <div className="section-header" data-reveal>
            <h2 className="lux-heading">منتجات مميزة</h2>
            <Link to="/products?featured=true" className="view-all">
              عرض الكل <ChevronLeft size={18} />
            </Link>
          </div>
          {featuredProducts.length > 0 ? (
            <div className="products-grid" data-reveal-stagger>
              {featuredProducts.slice(0, 4).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="empty-products">
              <Inbox size={48} />
              <p>لا توجد منتجات مميزة بعد</p>
              <span>اذهب للوحة التحكم لإضافة منتجات</span>
            </div>
          )}
        </div>
      </section>

      {/* Banner */}
      <section className="promo-banner">
        <div className="container">
          <div className="banner-content">
            <div className="lux-aurora" aria-hidden="true">
              <span />
              <span />
            </div>
            <div className="banner-text" data-reveal="right">
              <span className="lux-eyebrow">
                <Sparkles size={14} /> خصم يصل إلى ٣٠٪
              </span>
              <h2>عروض نهاية العام</h2>
              <p>لا تفوت فرصة الحصول على أفضل المنتجات بأسعار مخفضة</p>
              <Link to="/products?sale=true" className="btn-lux">
                تسوق العروض <ChevronLeft size={18} />
              </Link>
            </div>
            <div className="banner-image" data-reveal="left">
              <img
                src="https://images.unsplash.com/photo-1491933382434-500287f9b54b?w=500"
                alt="Sale"
              />
            </div>
          </div>
        </div>
      </section>

      {/* All Products */}
      <section className="products-section">
        <div className="container">
          <div className="section-header" data-reveal>
            <h2 className="lux-heading">أحدث المنتجات</h2>
            <Link to="/products" className="view-all">
              عرض الكل <ChevronLeft size={18} />
            </Link>
          </div>
          {products.length > 0 ? (
            <div className="products-grid" data-reveal-stagger>
              {products.slice(0, 8).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="empty-products">
              <Inbox size={48} />
              <p>لا توجد منتجات بعد</p>
              <span>اذهب للوحة التحكم لإضافة منتجات جديدة</span>
              <Link
                to="/dashboard/products"
                className="btn btn-primary"
                style={{ marginTop: "15px" }}
              >
                إضافة منتج
              </Link>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Home;
