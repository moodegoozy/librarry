import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Smartphone, Laptop, Tv, Gamepad2, Headphones, Watch, Inbox } from 'lucide-react';
import ProductCard from '../../components/ProductCard/ProductCard';
import { useStore } from '../../store/useStore';
import { subscribeToProducts } from '../../services/firestore';
import './Home.css';

const defaultCategories = [
  { id: 'phones', name: 'الجوالات', icon: Smartphone, color: '#3b82f6' },
  { id: 'laptops', name: 'اللابتوبات', icon: Laptop, color: '#8b5cf6' },
  { id: 'tvs', name: 'التلفزيونات', icon: Tv, color: '#ec4899' },
  { id: 'gaming', name: 'الألعاب', icon: Gamepad2, color: '#10b981' },
  { id: 'audio', name: 'السماعات', icon: Headphones, color: '#f59e0b' },
  { id: 'watches', name: 'الساعات', icon: Watch, color: '#6366f1' },
];

const Home: React.FC = () => {
  const { products, setProducts } = useStore();

  // الاشتراك في المنتجات من Firestore
  useEffect(() => {
    const unsubscribe = subscribeToProducts((firestoreProducts) => {
      setProducts(firestoreProducts);
    });

    return () => unsubscribe();
  }, [setProducts]);
  
  const featuredProducts = products.filter(p => p.featured);

  return (
    <div className="home">
      {/* Hero Section */}
      <section className="hero">
        <div className="container">
          <div className="hero-content">
            <div className="hero-text">
              <span className="hero-badge">🔥 عروض حصرية</span>
              <h1>أحدث الإلكترونيات<br />بأفضل الأسعار</h1>
              <p>اكتشف تشكيلتنا الواسعة من الهواتف والأجهزة الذكية واللابتوبات مع ضمان شامل وشحن مجاني</p>
              <div className="hero-buttons">
                <Link to="/products" className="btn btn-primary btn-lg">
                  تسوق الآن
                </Link>
                <Link to="/products?featured=true" className="btn btn-outline btn-lg">
                  عروض اليوم
                </Link>
              </div>
            </div>
            <div className="hero-image">
              <img src="https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=600" alt="Electronics" />
            </div>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="categories-section">
        <div className="container">
          <div className="section-header">
            <h2>تسوق حسب التصنيف</h2>
            <Link to="/products" className="view-all">
              عرض الكل <ChevronLeft size={18} />
            </Link>
          </div>
          <div className="categories-grid">
            {defaultCategories.map((cat) => (
              <Link 
                key={cat.id} 
                to={`/products?category=${cat.id}`}
                className="category-card"
                style={{ '--cat-color': cat.color } as React.CSSProperties}
              >
                <div className="category-icon">
                  <cat.icon size={32} />
                </div>
                <span>{cat.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="products-section">
        <div className="container">
          <div className="section-header">
            <h2>منتجات مميزة</h2>
            <Link to="/products?featured=true" className="view-all">
              عرض الكل <ChevronLeft size={18} />
            </Link>
          </div>
          {featuredProducts.length > 0 ? (
            <div className="products-grid">
              {featuredProducts.map((product) => (
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
            <div className="banner-text">
              <span>خصم يصل إلى 30%</span>
              <h2>عروض نهاية العام</h2>
              <p>لا تفوت فرصة الحصول على أفضل المنتجات بأسعار مخفضة</p>
              <Link to="/products?sale=true" className="btn btn-secondary btn-lg">
                تسوق العروض
              </Link>
            </div>
            <div className="banner-image">
              <img src="https://images.unsplash.com/photo-1491933382434-500287f9b54b?w=500" alt="Sale" />
            </div>
          </div>
        </div>
      </section>

      {/* All Products */}
      <section className="products-section">
        <div className="container">
          <div className="section-header">
            <h2>أحدث المنتجات</h2>
            <Link to="/products" className="view-all">
              عرض الكل <ChevronLeft size={18} />
            </Link>
          </div>
          {products.length > 0 ? (
            <div className="products-grid">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="empty-products">
              <Inbox size={48} />
              <p>لا توجد منتجات بعد</p>
              <span>اذهب للوحة التحكم لإضافة منتجات جديدة</span>
              <Link to="/dashboard/products" className="btn btn-primary" style={{ marginTop: '15px' }}>
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
