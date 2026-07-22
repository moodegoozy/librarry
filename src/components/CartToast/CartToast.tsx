import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check, ShoppingCart, X } from "lucide-react";
import { useStore } from "../../store/useStore";
import "./CartToast.css";

const DURATION = 2800; // مدة ظهور الإشعار بالمللي ثانية

/**
 * إشعار متحرك يظهر عند إضافة منتج إلى السلة.
 * يُركّب مرة واحدة عالمياً (داخل StoreLayout) ويستمع لحالة cartToast في المتجر.
 */
const CartToast: React.FC = () => {
  const cartToast = useStore((s) => s.cartToast);
  const clearCartToast = useStore((s) => s.clearCartToast);

  // نحتفظ بنسخة محلية حتى يبقى المحتوى ظاهراً أثناء أنيميشن الخروج
  const [current, setCurrent] = useState(cartToast);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!cartToast) return;
    setCurrent(cartToast);
    // نفعّل الظهور في الإطار التالي لتشغيل الانتقال
    requestAnimationFrame(() => setVisible(true));

    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setVisible(false), DURATION);

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [cartToast]);

  // بعد انتهاء أنيميشن الخروج ننظّف الحالة في المتجر
  const handleTransitionEnd = () => {
    if (!visible) clearCartToast();
  };

  if (!current) return null;

  const product = current.product;
  const image = product.images?.[0] || "";

  return (
    <div
      className={`cart-toast ${visible ? "show" : ""}`}
      dir="rtl"
      role="status"
      aria-live="polite"
      onTransitionEnd={handleTransitionEnd}
    >
      <div className="cart-toast-check">
        <Check size={16} strokeWidth={3} />
      </div>

      {image && (
        <img src={image} alt={product.name} className="cart-toast-img" loading="lazy" />
      )}

      <div className="cart-toast-body">
        <span className="cart-toast-title">أُضيف إلى السلة</span>
        <span className="cart-toast-name">{product.name}</span>
      </div>

      <Link
        to="/cart"
        className="cart-toast-btn"
        onClick={() => setVisible(false)}
      >
        <ShoppingCart size={15} />
        عرض السلة
      </Link>

      <button
        className="cart-toast-close"
        onClick={() => setVisible(false)}
        aria-label="إغلاق"
      >
        <X size={16} />
      </button>

      {/* شريط تقدّم يتقلّص طوال مدة الظهور */}
      <span
        className="cart-toast-progress"
        key={current.nonce}
        style={{ animationDuration: `${DURATION}ms` }}
      />
    </div>
  );
};

export default CartToast;
