import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ShoppingCart,
  Heart,
  Share2,
  Truck,
  Shield,
  RotateCcw,
  Minus,
  Plus,
  ChevronRight,
  Star,
  Package,
  ArrowRight,
} from "lucide-react";
import { useStore } from "../../store/useStore";
import ProductCard from "../../components/ProductCard/ProductCard";
import "./ProductDetail.css";

// تحويل HTML إلى نص عادي
const stripHtml = (html: string): string => {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const body = doc.body;
  body.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
  body.querySelectorAll("p, div, li").forEach((el) => {
    el.prepend(document.createTextNode("\n"));
    el.append(document.createTextNode("\n"));
  });
  return (body.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
};

const cleanDescription = (desc: string): string => {
  if (desc.includes("<")) return stripHtml(desc);
  return desc;
};

const ProductDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { products, addToCart, toggleWishlist, isInWishlist, categories } =
    useStore();
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<
    "description" | "specs" | "shipping"
  >("description");
  const [addedToCart, setAddedToCart] = useState(false);

  const product = products.find((p) => p.id === id);
  const categoryName = product
    ? categories.find((c) => c.id === product.category)?.name ||
      product.category
    : "";

  // إعادة تعيين عند تغيير المنتج
  useEffect(() => {
    setSelectedImage(0);
    setQuantity(1);
    setAddedToCart(false);
    window.scrollTo(0, 0);
  }, [id]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("ar-SA", {
      style: "currency",
      currency: "SAR",
    }).format(price);
  };

  const handleAddToCart = () => {
    if (product) {
      addToCart(product, quantity);
      setAddedToCart(true);
      setTimeout(() => setAddedToCart(false), 2000);
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: product?.name,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert("تم نسخ الرابط!");
    }
  };

  if (!product) {
    return (
      <div className="product-detail-page">
        <div className="container">
          <div className="not-found">
            <Package size={80} />
            <h2>المنتج غير موجود</h2>
            <p>عذراً، لم نتمكن من العثور على هذا المنتج</p>
            <Link to="/products" className="btn btn-primary btn-lg">
              تصفح المنتجات
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const discount = product.oldPrice
    ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
    : 0;

  // منتجات ذات صلة (نفس التصنيف)
  const relatedProducts = products
    .filter((p) => p.category === product.category && p.id !== product.id)
    .slice(0, 4);

  return (
    <div className="product-detail-page">
      <div className="container">
        {/* Breadcrumb */}
        <nav className="breadcrumb">
          <Link to="/">الرئيسية</Link>
          <ChevronRight size={14} />
          <Link to="/products">المنتجات</Link>
          <ChevronRight size={14} />
          <Link to={`/products?category=${product.category}`}>
            {categoryName}
          </Link>
          <ChevronRight size={14} />
          <span>{product.name}</span>
        </nav>

        {/* Product Main Section */}
        <div className="product-main">
          {/* Image Gallery */}
          <div className="product-gallery">
            <div className="main-image">
              {discount > 0 && (
                <span className="discount-badge">-{discount}%</span>
              )}
              {product.featured && <span className="featured-badge">مميز</span>}
              <img
                src={product.images[selectedImage] || "/placeholder.jpg"}
                alt={product.name}
              />
            </div>
            {product.images.length > 1 && (
              <div className="image-thumbnails">
                {product.images.map((img, idx) => (
                  <button
                    key={idx}
                    className={`thumbnail ${idx === selectedImage ? "active" : ""}`}
                    onClick={() => setSelectedImage(idx)}
                  >
                    <img src={img} alt={`${product.name} ${idx + 1}`} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="product-info">
            <span className="product-category-tag">{categoryName}</span>
            <h1 className="product-title">{product.name}</h1>
            {product.nameEn && (
              <p className="product-name-en">{product.nameEn}</p>
            )}

            {/* Rating */}
            <div className="product-rating">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  size={18}
                  fill={i < 4 ? "#fbbf24" : "none"}
                  color="#fbbf24"
                />
              ))}
              <span className="rating-text">(لا توجد تقييمات بعد)</span>
            </div>

            {/* Price */}
            <div className="product-price-section">
              <span className="current-price">
                {formatPrice(product.price)}
              </span>
              {product.oldPrice && (
                <>
                  <span className="old-price">
                    {formatPrice(product.oldPrice)}
                  </span>
                  <span className="save-badge">
                    وفر {formatPrice(product.oldPrice - product.price)}
                  </span>
                </>
              )}
            </div>

            {/* Stock Status */}
            <div
              className={`stock-status ${product.stock > 0 ? "in-stock" : "out-of-stock"}`}
            >
              {product.stock > 0 ? (
                <>
                  <span className="status-dot"></span>
                  متوفر ({product.stock} وحدة)
                </>
              ) : (
                <>
                  <span className="status-dot"></span>
                  نفذت الكمية
                </>
              )}
            </div>

            {/* Quantity & Add to Cart */}
            <div className="purchase-section">
              <div className="quantity-selector">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={product.stock === 0}
                >
                  <Minus size={18} />
                </button>
                <span>{quantity}</span>
                <button
                  onClick={() =>
                    setQuantity(Math.min(product.stock, quantity + 1))
                  }
                  disabled={product.stock === 0}
                >
                  <Plus size={18} />
                </button>
              </div>

              <button
                className={`btn btn-primary btn-lg add-to-cart-main ${addedToCart ? "added" : ""}`}
                onClick={handleAddToCart}
                disabled={product.stock === 0}
              >
                <ShoppingCart size={20} />
                {addedToCart ? "تمت الإضافة ✓" : "أضف للسلة"}
              </button>
            </div>

            {/* Action Buttons */}
            <div className="action-buttons">
              <button
                className={`action-btn-detail ${product && isInWishlist(product.id) ? "wishlisted" : ""}`}
                onClick={() => product && toggleWishlist(product.id)}
              >
                <Heart
                  size={18}
                  fill={
                    product && isInWishlist(product.id) ? "#ef4444" : "none"
                  }
                  color={
                    product && isInWishlist(product.id)
                      ? "#ef4444"
                      : "currentColor"
                  }
                />
                {product && isInWishlist(product.id)
                  ? "في المفضلة"
                  : "أضف للمفضلة"}
              </button>
              <button className="action-btn-detail" onClick={handleShare}>
                <Share2 size={18} />
                مشاركة
              </button>
            </div>

            {/* Features */}
            <div className="product-features">
              <div className="feature">
                <Truck size={20} />
                <div>
                  <strong>شحن سريع</strong>
                  <span>توصيل خلال 3-5 أيام</span>
                </div>
              </div>
              <div className="feature">
                <Shield size={20} />
                <div>
                  <strong>ضمان شامل</strong>
                  <span>ضمان على جميع المنتجات</span>
                </div>
              </div>
              <div className="feature">
                <RotateCcw size={20} />
                <div>
                  <strong>إرجاع مجاني</strong>
                  <span>خلال 14 يوم</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs Section */}
        <div className="product-tabs">
          <div className="tabs-header">
            <button
              className={`tab-btn ${activeTab === "description" ? "active" : ""}`}
              onClick={() => setActiveTab("description")}
            >
              الوصف
            </button>
            <button
              className={`tab-btn ${activeTab === "specs" ? "active" : ""}`}
              onClick={() => setActiveTab("specs")}
            >
              المواصفات
            </button>
            <button
              className={`tab-btn ${activeTab === "shipping" ? "active" : ""}`}
              onClick={() => setActiveTab("shipping")}
            >
              الشحن والإرجاع
            </button>
          </div>

          <div className="tab-content">
            {activeTab === "description" && (
              <div className="tab-description">
                {product.description ? (
                  <p style={{ whiteSpace: "pre-line" }}>
                    {cleanDescription(product.description)}
                  </p>
                ) : (
                  <p>لا يوجد وصف لهذا المنتج بعد.</p>
                )}
              </div>
            )}

            {activeTab === "specs" && (
              <div className="tab-specs">
                {product.specs && Object.keys(product.specs).length > 0 ? (
                  <table className="specs-table">
                    <tbody>
                      {Object.entries(product.specs).map(([key, value]) => (
                        <tr key={key}>
                          <td className="spec-key">{key}</td>
                          <td className="spec-value">{value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p>لا توجد مواصفات مضافة لهذا المنتج.</p>
                )}
              </div>
            )}

            {activeTab === "shipping" && (
              <div className="tab-shipping">
                <div className="shipping-info-block">
                  <h4>
                    <Truck size={18} /> الشحن
                  </h4>
                  <ul>
                    <li>التوصيل خلال 3-5 أيام عمل</li>
                    <li>شحن مجاني للطلبات فوق 200 ر.س</li>
                    <li>التوصيل لجميع مناطق المملكة</li>
                  </ul>
                </div>
                <div className="shipping-info-block">
                  <h4>
                    <RotateCcw size={18} /> سياسة الإرجاع
                  </h4>
                  <ul>
                    <li>إرجاع مجاني خلال 14 يوم من الاستلام</li>
                    <li>المنتج يجب أن يكون بحالته الأصلية</li>
                    <li>استرداد كامل المبلغ خلال 5 أيام عمل</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <div className="related-products">
            <div className="section-header">
              <h2>منتجات ذات صلة</h2>
              <Link
                to={`/products?category=${product.category}`}
                className="view-all"
              >
                عرض الكل <ArrowRight size={18} />
              </Link>
            </div>
            <div className="products-grid">
              {relatedProducts.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductDetail;
