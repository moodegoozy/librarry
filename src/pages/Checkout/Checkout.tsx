import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  MapPin,
  CreditCard,
  Truck,
  ShoppingBag,
  ArrowRight,
  Check,
  Loader,
  AlertCircle,
} from "lucide-react";
import { useStore } from "../../store/useStore";
import {
  addOrder,
  getSettings,
  decrementStock,
} from "../../services/firestore";
import Header from "../../components/Header/Header";
import Footer from "../../components/Footer/Footer";
import "./Checkout.css";

interface ShippingSettings {
  freeShippingThreshold: number;
  defaultShippingCost: number;
  enableFreeShipping: boolean;
  estimatedDays: string;
}

interface PaymentMethod {
  id: string;
  name: string;
  enabled: boolean;
}

const Checkout: React.FC = () => {
  const navigate = useNavigate();
  const { cart, user, clearCart, getCartTotal } = useStore();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [shippingSettings, setShippingSettings] = useState<ShippingSettings>({
    freeShippingThreshold: 200,
    defaultShippingCost: 25,
    enableFreeShipping: true,
    estimatedDays: "3-5",
  });
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([
    { id: "cash", name: "الدفع عند الاستلام", enabled: true },
    { id: "bank", name: "التحويل البنكي", enabled: true },
    { id: "card", name: "بطاقة ائتمان", enabled: false },
  ]);

  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    city: "",
    district: "",
    street: "",
    building: "",
    nationalAddress: "",
    notes: "",
    paymentMethod: "cash",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // جلب الإعدادات من Firestore
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settings = await getSettings();
        if (settings) {
          if (settings.shipping) {
            setShippingSettings(settings.shipping);
          }
          if (settings.payment?.methods) {
            setPaymentMethods(settings.payment.methods);
          }
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      }
    };
    fetchSettings();
  }, []);

  // تعبئة بيانات المستخدم
  useEffect(() => {
    if (user) {
      setFormData((prev) => ({
        ...prev,
        fullName: user.name || "",
        phone: user.phone || "",
        city: user.addresses?.[0]?.city || "",
        district: user.addresses?.[0]?.district || "",
        street: user.addresses?.[0]?.street || "",
        building: user.addresses?.[0]?.building || "",
        nationalAddress: user.addresses?.[0]?.nationalAddress || "",
      }));
    }
  }, [user]);

  // التحقق من السلة
  useEffect(() => {
    if (cart.length === 0 && !orderPlaced) {
      navigate("/cart");
    }
  }, [cart, navigate, orderPlaced]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("ar-SA", {
      style: "currency",
      currency: "SAR",
    }).format(price);
  };

  const subtotal = getCartTotal();
  const shipping =
    shippingSettings.enableFreeShipping &&
    subtotal >= shippingSettings.freeShippingThreshold
      ? 0
      : shippingSettings.defaultShippingCost;
  const total = subtotal + shipping;

  const validateStep1 = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.fullName.trim()) newErrors.fullName = "الاسم مطلوب";
    if (!formData.phone.trim()) newErrors.phone = "رقم الجوال مطلوب";
    else if (!/^05\d{8}$/.test(formData.phone))
      newErrors.phone = "رقم جوال غير صحيح";
    if (!formData.city.trim()) newErrors.city = "المدينة مطلوبة";
    if (!formData.district.trim()) newErrors.district = "الحي مطلوب";
    if (!formData.street.trim()) newErrors.street = "الشارع مطلوب";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNextStep = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    }
  };

  const handleSubmitOrder = async () => {
    if (!user) {
      navigate("/login");
      return;
    }

    setLoading(true);

    try {
      // التحقق من توفر المخزون قبل إرسال الطلب
      const { products } = useStore.getState();
      const stockErrors: string[] = [];
      for (const item of cart) {
        const currentProduct = products.find((p) => p.id === item.product.id);
        if (currentProduct && currentProduct.stock < item.quantity) {
          stockErrors.push(
            `${item.product.name}: متوفر ${currentProduct.stock} فقط (طلبت ${item.quantity})`,
          );
        }
      }
      if (stockErrors.length > 0) {
        alert(
          "بعض المنتجات غير متوفرة بالكمية المطلوبة:\n" +
            stockErrors.join("\n"),
        );
        setLoading(false);
        return;
      }

      const orderData = {
        userId: user.id,
        customer: formData.fullName,
        email: user.email,
        phone: formData.phone,
        items: cart.map((item) => ({
          productId: item.product.id,
          name: item.product.name,
          quantity: item.quantity,
          price: item.product.price,
          image: item.product.images[0] || "",
        })),
        total: total,
        subtotal: subtotal,
        shippingCost: shipping,
        status: "pending" as const,
        paymentMethod: formData.paymentMethod,
        shippingAddress: `${formData.city}، ${formData.district}، ${formData.street}${formData.building ? `، مبنى ${formData.building}` : ""}${formData.nationalAddress ? `، العنوان الوطني: ${formData.nationalAddress}` : ""}`,

        address: {
          fullName: formData.fullName,
          phone: formData.phone,
          city: formData.city,
          district: formData.district,
          street: formData.street,
          building: formData.building,
          nationalAddress: formData.nationalAddress,
        },
        notes: formData.notes,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await addOrder(orderData);

      // تخفيض المخزون ذرياً بعد إتمام الطلب
      for (const item of cart) {
        await decrementStock(item.product.id, item.quantity);
      }

      setOrderPlaced(true);
      clearCart();
      setStep(3);
    } catch (error) {
      console.error("Error creating order:", error);
      alert("حدث خطأ أثناء إنشاء الطلب. يرجى المحاولة مرة أخرى.");
    } finally {
      setLoading(false);
    }
  };

  // صفحة تسجيل الدخول إذا لم يكن هناك مستخدم
  if (!user) {
    return (
      <>
        <Header />
        <div className="checkout-page">
          <div className="container">
            <div className="login-required">
              <AlertCircle size={60} />
              <h2>يجب تسجيل الدخول أولاً</h2>
              <p>قم بتسجيل الدخول لإتمام عملية الشراء</p>
              <Link to="/login" className="btn btn-primary btn-lg">
                تسجيل الدخول
              </Link>
            </div>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="checkout-page">
        <div className="container">
          {/* خطوات الطلب */}
          <div className="checkout-steps">
            <div
              className={`step ${step >= 1 ? "active" : ""} ${step > 1 ? "completed" : ""}`}
            >
              <span className="step-number">
                {step > 1 ? <Check size={16} /> : "1"}
              </span>
              <span className="step-label">العنوان</span>
            </div>
            <div className="step-line"></div>
            <div
              className={`step ${step >= 2 ? "active" : ""} ${step > 2 ? "completed" : ""}`}
            >
              <span className="step-number">
                {step > 2 ? <Check size={16} /> : "2"}
              </span>
              <span className="step-label">الدفع</span>
            </div>
            <div className="step-line"></div>
            <div className={`step ${step >= 3 ? "active" : ""}`}>
              <span className="step-number">3</span>
              <span className="step-label">التأكيد</span>
            </div>
          </div>

          {step < 3 && (
            <div className="checkout-content">
              {/* الخطوة 1: العنوان */}
              {step === 1 && (
                <div className="checkout-form">
                  <div className="form-card">
                    <div className="card-header">
                      <MapPin size={22} />
                      <h2>عنوان التوصيل</h2>
                    </div>
                    <div className="form-body">
                      <div className="form-row">
                        <div className="form-group">
                          <label>الاسم الكامل *</label>
                          <input
                            type="text"
                            value={formData.fullName}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                fullName: e.target.value,
                              })
                            }
                            placeholder="الاسم الكامل"
                            className={errors.fullName ? "error" : ""}
                          />
                          {errors.fullName && (
                            <span className="error-text">
                              {errors.fullName}
                            </span>
                          )}
                        </div>
                        <div className="form-group">
                          <label>رقم الجوال *</label>
                          <input
                            type="tel"
                            value={formData.phone}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                phone: e.target.value,
                              })
                            }
                            placeholder="05xxxxxxxx"
                            className={errors.phone ? "error" : ""}
                          />
                          {errors.phone && (
                            <span className="error-text">{errors.phone}</span>
                          )}
                        </div>
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>المدينة *</label>
                          <input
                            type="text"
                            value={formData.city}
                            onChange={(e) =>
                              setFormData({ ...formData, city: e.target.value })
                            }
                            placeholder="مثال: الرياض"
                            className={errors.city ? "error" : ""}
                          />
                          {errors.city && (
                            <span className="error-text">{errors.city}</span>
                          )}
                        </div>
                        <div className="form-group">
                          <label>الحي *</label>
                          <input
                            type="text"
                            value={formData.district}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                district: e.target.value,
                              })
                            }
                            placeholder="مثال: حي النرجس"
                            className={errors.district ? "error" : ""}
                          />
                          {errors.district && (
                            <span className="error-text">
                              {errors.district}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>الشارع *</label>
                          <input
                            type="text"
                            value={formData.street}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                street: e.target.value,
                              })
                            }
                            placeholder="اسم الشارع"
                            className={errors.street ? "error" : ""}
                          />
                          {errors.street && (
                            <span className="error-text">{errors.street}</span>
                          )}
                        </div>
                        <div className="form-group">
                          <label>رقم المبنى (اختياري)</label>
                          <input
                            type="text"
                            value={formData.building}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                building: e.target.value,
                              })
                            }
                            placeholder="رقم المبنى أو الشقة"
                          />
                        </div>
                      </div>
                      <div className="form-group">
                        <label>العنوان الوطني (اختياري)</label>
                        <input
                          type="text"
                          value={formData.nationalAddress}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              nationalAddress: e.target.value,
                            })
                          }
                          placeholder="مثال: RRRD2929"
                        />
                      </div>
                      <div className="form-group">
                        <label>ملاحظات إضافية (اختياري)</label>
                        <textarea
                          value={formData.notes}
                          onChange={(e) =>
                            setFormData({ ...formData, notes: e.target.value })
                          }
                          placeholder="أي تعليمات خاصة للتوصيل..."
                          rows={3}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="form-actions">
                    <Link to="/cart" className="btn btn-outline">
                      <ArrowRight size={18} />
                      العودة للسلة
                    </Link>
                    <button
                      className="btn btn-primary"
                      onClick={handleNextStep}
                    >
                      التالي: طريقة الدفع
                    </button>
                  </div>
                </div>
              )}

              {/* الخطوة 2: الدفع */}
              {step === 2 && (
                <div className="checkout-form">
                  <div className="form-card">
                    <div className="card-header">
                      <CreditCard size={22} />
                      <h2>طريقة الدفع</h2>
                    </div>
                    <div className="form-body">
                      <div className="payment-options">
                        {paymentMethods
                          .filter((m) => m.enabled)
                          .map((method) => (
                            <label key={method.id} className="payment-option">
                              <input
                                type="radio"
                                name="paymentMethod"
                                value={method.id}
                                checked={formData.paymentMethod === method.id}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    paymentMethod: e.target.value,
                                  })
                                }
                              />
                              <div className="option-content">
                                {method.id === "cash" && <Truck size={24} />}
                                {method.id === "bank" && (
                                  <CreditCard size={24} />
                                )}
                                {method.id === "card" && (
                                  <CreditCard size={24} />
                                )}
                                <div>
                                  <strong>{method.name}</strong>
                                  {method.id === "cash" && (
                                    <span>ادفع نقداً عند استلام طلبك</span>
                                  )}
                                  {method.id === "bank" && (
                                    <span>تحويل إلى الحساب البنكي</span>
                                  )}
                                  {method.id === "card" && (
                                    <span>Visa, Mastercard, Mada</span>
                                  )}
                                </div>
                              </div>
                            </label>
                          ))}
                      </div>

                      {formData.paymentMethod === "bank" && (
                        <div className="bank-details">
                          <h4>بيانات الحساب البنكي</h4>
                          <p>
                            <strong>البنك:</strong> البنك الأهلي
                          </p>
                          <p>
                            <strong>اسم الحساب:</strong> جبوري للإلكترونيات
                          </p>
                          <p>
                            <strong>رقم الآيبان:</strong>{" "}
                            SA0000000000000000000000
                          </p>
                          <p className="note">
                            يرجى إرسال إيصال التحويل عبر الواتساب
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="form-actions">
                    <button
                      className="btn btn-outline"
                      onClick={() => setStep(1)}
                    >
                      <ArrowRight size={18} />
                      السابق
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={handleSubmitOrder}
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <Loader className="spinner" size={18} />
                          جاري إرسال الطلب...
                        </>
                      ) : (
                        `تأكيد الطلب - ${formatPrice(total)}`
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* ملخص الطلب */}
              <div className="order-summary">
                <h3>ملخص الطلب</h3>
                <div className="summary-items">
                  {cart.map((item) => (
                    <div key={item.product.id} className="summary-item">
                      <img
                        src={
                          item.product.images?.[0] ||
                          "https://via.placeholder.com/80"
                        }
                        alt={item.product.name}
                      />
                      <div className="item-info">
                        <span className="item-name">{item.product.name}</span>
                        <span className="item-qty">
                          الكمية: {item.quantity}
                        </span>
                      </div>
                      <span className="item-price">
                        {formatPrice(item.product.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="summary-totals">
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
                  <div className="summary-row total">
                    <span>الإجمالي</span>
                    <span>{formatPrice(total)}</span>
                  </div>
                </div>
                <div className="shipping-info">
                  <Truck size={18} />
                  <span>
                    التوصيل خلال {shippingSettings.estimatedDays} أيام عمل
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* الخطوة 3: التأكيد */}
          {step === 3 && (
            <div className="order-success">
              <div className="success-icon">
                <Check size={60} />
              </div>
              <h1>تم استلام طلبك بنجاح!</h1>
              <p>شكراً لك على طلبك. سنتواصل معك قريباً لتأكيد الطلب.</p>

              <div className="order-actions">
                <Link to="/account" className="btn btn-primary">
                  <ShoppingBag size={18} />
                  تتبع طلباتي
                </Link>
                <Link to="/products" className="btn btn-outline">
                  متابعة التسوق
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </>
  );
};

export default Checkout;
