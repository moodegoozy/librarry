import React from "react";
import { Link } from "react-router-dom";
import { ShoppingCart, Heart, Eye, Star } from "lucide-react";
import type { Product } from "../../types";
import { useStore } from "../../store/useStore";
import "./ProductCard.css";

interface ProductCardProps {
  product: Product;
}

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { addToCart, toggleWishlist, isInWishlist, categories } = useStore();
  const wishlisted = isInWishlist(product.id);

  const categoryName =
    categories.find((c) => c.id === product.category)?.name || product.category;

  const discount = product.oldPrice
    ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
    : 0;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("ar-SA", {
      style: "currency",
      currency: "SAR",
    }).format(price);
  };

  return (
    <div className="product-card fade-in">
      {/* Badges */}
      <div className="product-badges">
        {discount > 0 && <span className="badge-discount">-{discount}%</span>}
        {product.featured && <span className="badge-featured">مميز</span>}
        {product.stock === 0 && (
          <span className="badge-soldout">نفذت الكمية</span>
        )}
      </div>

      {/* Image */}
      <Link to={`/product/${product.id}`} className="product-image">
        <img
          src={product.images[0] || "/placeholder.jpg"}
          alt={product.name}
          loading="lazy"
        />
      </Link>

      {/* Quick Actions */}
      <div className="product-actions">
        <button
          className={`action-icon ${wishlisted ? "wishlisted" : ""}`}
          title="أضف للمفضلة"
          onClick={() => toggleWishlist(product.id)}
        >
          <Heart
            size={18}
            fill={wishlisted ? "#ef4444" : "none"}
            color={wishlisted ? "#ef4444" : "currentColor"}
          />
        </button>
        <Link
          to={`/product/${product.id}`}
          className="action-icon"
          title="عرض سريع"
        >
          <Eye size={18} />
        </Link>
      </div>

      {/* Content */}
      <div className="product-content">
        <span className="product-category">{categoryName}</span>

        <Link to={`/product/${product.id}`}>
          <h3 className="product-title">{product.name}</h3>
        </Link>

        {/* Rating */}
        <div className="product-rating">
          {[...Array(5)].map((_, i) => (
            <Star
              key={i}
              size={14}
              fill={i < 4 ? "#fbbf24" : "none"}
              color="#fbbf24"
            />
          ))}
          <span>(120)</span>
        </div>

        {/* Price */}
        <div className="product-pricing">
          <span className="current-price">{formatPrice(product.price)}</span>
          {product.oldPrice && (
            <span className="old-price">{formatPrice(product.oldPrice)}</span>
          )}
        </div>

        {/* Add to Cart */}
        <button
          className="add-to-cart-btn"
          onClick={() => addToCart(product)}
          disabled={product.stock === 0}
        >
          <ShoppingCart size={18} />
          <span>أضف للسلة</span>
        </button>
      </div>
    </div>
  );
};

export default ProductCard;
