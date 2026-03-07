import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight } from "lucide-react";
import { useStore } from "../../store/useStore";
import { getSettings } from "../../services/firestore";
import "./Cart.css";

interface ShippingSettings {
  freeShippingThreshold: number;
  defaultShippingCost: number;
  enableFreeShipping: boolean;
}

const Cart: React.FC = () => {
  const {
    cart,
    removeFromCart,
    updateQuantity,
    getCartTotal,
    clearCart,
    categories,
  } = useStore();
  const [shippingSettings, setShippingSettings] = useState<ShippingSettings>({
    freeShippingThreshold: 200,
    defaultShippingCost: 25,
    enableFreeShipping: true,
  });

  // جلب إعدادات الشحن
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settings = await getSettings();
        if (settings?.shipping) {
          setShippingSettings(settings.shipping);
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      }
    };
    fetchSettings();
  }, []);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("ar-SA", {
      style: "currency",
      currency: "SAR",
    }).format(price);
  };

  if (cart.length === 0) {
    return (
      <div className="cart-page">
        <div className="container">
          <div className="empty-cart">
            <ShoppingBag size={80} />
            <h2>سلة التسوق فارغة</h2>
            <p>لم تقم بإضافة أي منتجات إلى سلة التسوق بعد</p>
            <Link to="/products" className="btn btn-primary btn-lg">
              تصفح المنتجات
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const subtotal = getCartTotal();
  const shipping =
    shippingSettings.enableFreeShipping &&
    subtotal >= shippingSettings.freeShippingThreshold
      ? 0
      : shippingSettings.defaultShippingCost;
  const total = subtotal + shipping;

  return (
    <div className="cart-page">
      <div className="container">
        <div className="cart-header">
          <h1>سلة التسوق</h1>
          <span>{cart.length} منتج</span>
        </div>

        <div className="cart-content">
          {/* Cart Items */}
          <div className="cart-items">
            {cart.map((item) => (
              <div key={item.product.id} className="cart-item">
                <img
                  src={
                    item.product.images?.[0] ||
                    "https://via.placeholder.com/100"
                  }
                  alt={item.product.name}
                  className="item-image"
                />
                <div className="item-details">
                  <Link
                    to={`/product/${item.product.id}`}
                    className="item-name"
                  >
                    {item.product.name}
                  </Link>
                  <span className="item-category">
                    {categories.find((c) => c.id === item.product.category)
                      ?.name || item.product.category}
                  </span>
                  <div className="item-price-mobile">
                    {formatPrice(item.product.price)}
                  </div>
                </div>
                <div className="item-quantity">
                  <button
                    className="qty-btn"
                    onClick={() =>
                      updateQuantity(item.product.id, item.quantity - 1)
                    }
                  >
                    <Minus size={16} />
                  </button>
                  <span className="qty-value">{item.quantity}</span>
                  <button
                    className="qty-btn"
                    onClick={() =>
                      updateQuantity(item.product.id, item.quantity + 1)
                    }
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <div className="item-price">
                  {formatPrice(item.product.price * item.quantity)}
                </div>
                <button
                  className="remove-btn"
                  onClick={() => removeFromCart(item.product.id)}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}

            <div className="cart-actions">
              <Link to="/products" className="btn btn-outline">
                <ArrowRight size={18} />
                متابعة التسوق
              </Link>
              <button
                className="btn btn-outline btn-danger"
                onClick={clearCart}
              >
                <Trash2 size={18} />
                إفراغ السلة
              </button>
            </div>
          </div>

          {/* Cart Summary */}
          <div className="cart-summary">
            <h3>ملخص الطلب</h3>

            <div className="summary-row">
              <span>المجموع الفرعي</span>
              <span>{formatPrice(subtotal)}</span>
            </div>

            <div className="summary-row">
              <span>الشحن</span>
              <span className={shipping === 0 ? "free" : ""}>
                {shipping === 0 ? "مجاني" : formatPrice(shipping)}
              </span>
            </div>

            {shipping > 0 && shippingSettings.enableFreeShipping && (
              <div className="free-shipping-notice">
                أضف{" "}
                {formatPrice(shippingSettings.freeShippingThreshold - subtotal)}{" "}
                للحصول على شحن مجاني
              </div>
            )}

            <div className="summary-total">
              <span>الإجمالي</span>
              <span>{formatPrice(total)}</span>
            </div>

            <Link to="/checkout" className="btn btn-primary btn-lg btn-block">
              إتمام الطلب
            </Link>

            <div className="payment-methods">
              <span>طرق الدفع المتاحة:</span>
              <div className="payment-icons">
                <span>💳</span>
                <span>🏦</span>
                <span>📱</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart;
