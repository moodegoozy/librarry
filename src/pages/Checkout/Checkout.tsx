import React, { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import {
  MapPin,
  CreditCard,
  Truck,
  ShoppingBag,
  ArrowRight,
  Check,
  Loader,
  AlertCircle,
  Clock,
} from "lucide-react";
import { useStore } from "../../store/useStore";
import {
  addOrder,
  getSettings,
  decrementStock,
} from "../../services/firestore";
import { createTamaraCheckout, authorizeTamaraOrder } from "../../services/tamara";
import Header from "../../components/Header/Header";
import Footer from "../../components/Footer/Footer";
import PayPalCardForm from "../../components/PayPalCardForm/PayPalCardForm";
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
  const [searchParams] = useSearchParams();
  const { cart, user, clearCart, getCartTotal } = useStore();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [tamaraProcessing, setTamaraProcessing] = useState(false);
  const [shippingSettings, setShippingSettings] = useState<ShippingSettings>({
    freeShippingThreshold: 200,
    defaultShippingCost: 25,
    enableFreeShipping: true,
    estimatedDays: "3-5",
  });
  const [paymentMethods] = useState<PaymentMethod[]>([
    { id: "cash", name: "الدفع عند الاستلام", enabled: true },
    { id: "bank", name: "التحويل البنكي", enabled: true },
    { id: "card", name: "بطاقة ائتمان", enabled: true },
    { id: "tamara", name: "تمارا - قسّمها على 3", enabled: true },
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
  const [cardProcessing, setCardProcessing] = useState(false);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);

  // جلب الإعدادات من Firestore
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settings = await getSettings();
        if (settings) {
          if (settings.shipping) {
            setShippingSettings(settings.shipping);
          }
          // نتجاهل إعدادات الدفع من Firestore ونستخدم الافتراضية مع البطاقة مفعّلة
          // لأن Firestore فيه بيانات قديمة
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

  // التعامل مع العودة من Tamara
  useEffect(() => {
    const handleTamaraCallback = async () => {
      const tamaraOrderId = searchParams.get("tamara_order_id");
      const paymentStatus = searchParams.get("paymentStatus");
      const pendingOrder = searchParams.get("order_ref");

      if (tamaraOrderId && paymentStatus === "approved" && pendingOrder && user) {
        setTamaraProcessing(true);
        setStep(2);

        try {
          // استرجاع بيانات الطلب المحفوظة
          const savedOrderData = localStorage.getItem(`tamara_order_${pendingOrder}`);
          if (!savedOrderData) {
            throw new Error("لم يتم العثور على بيانات الطلب");
          }

          const orderDataFromStorage = JSON.parse(savedOrderData);

          // تأكيد الطلب مع Tamara
          const authorizeResult = await authorizeTamaraOrder(tamaraOrderId);
          console.log("Tamara authorize result:", authorizeResult);

          // إنشاء الطلب في Firestore
          const orderData = {
            ...orderDataFromStorage,
            paymentMethod: "tamara",
            paymentStatus: "paid" as const,
            tamaraOrderId: tamaraOrderId,
            tamaraStatus: authorizeResult.status,
            paidAt: new Date(),
          };

          await addOrder(orderData);

          // تخفيض المخزون
          const cartItems = orderDataFromStorage.items || [];
          for (const item of cartItems) {
            await decrementStock(item.productId, item.quantity);
          }

          // تنظيف البيانات المحفوظة
          localStorage.removeItem(`tamara_order_${pendingOrder}`);

          setOrderPlaced(true);
          clearCart();
          setStep(3);

          // إزالة معاملات URL
          navigate("/checkout", { replace: true });
        } catch (error) {
          console.error("Error processing Tamara payment:", error);
          alert("حدث خطأ أثناء معالجة الدفع بتمارا. يرجى التواصل معنا.");
        } finally {
          setTamaraProcessing(false);
        }
      } else if (paymentStatus === "declined" || paymentStatus === "failed") {
        alert("تم رفض الدفع من تمارا. يرجى المحاولة مرة أخرى.");
        navigate("/checkout", { replace: true });
      }
    };

    handleTamaraCallback();
  }, [searchParams, user, clearCart, navigate]);

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

  // معالجة الدفع بتمارا
  const handleTamaraPayment = async () => {
    if (!user) {
      navigate("/login");
      return;
    }

    setTamaraProcessing(true);

    try {
      // التحقق من توفر المخزون
      const { products } = useStore.getState();
      const stockErrors: string[] = [];
      for (const item of cart) {
        const currentProduct = products.find((p) => p.id === item.product.id);
        if (currentProduct && currentProduct.stock < item.quantity) {
          stockErrors.push(
            `${item.product.name}: متوفر ${currentProduct.stock} فقط (طلبت ${item.quantity})`
          );
        }
      }
      if (stockErrors.length > 0) {
        alert(
          "بعض المنتجات غير متوفرة بالكمية المطلوبة:\n" + stockErrors.join("\n")
        );
        setTamaraProcessing(false);
        return;
      }

      const orderReference = generateOrderId();

      // تجهيز بيانات الطلب للحفظ
      const orderDataToSave = {
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

      // حفظ بيانات الطلب مؤقتاً
      localStorage.setItem(`tamara_order_${orderReference}`, JSON.stringify(orderDataToSave));

      // إنشاء عنوان العودة الحالي
      const baseUrl = window.location.origin;

      // تجهيز عناصر الطلب لتمارا
      const tamaraItems = cart.map((item) => ({
        reference_id: item.product.id,
        name: item.product.name,
        quantity: item.quantity,
        unit_price: item.product.price,
        image_url: item.product.images[0] || undefined,
      }));

      // تقسيم الاسم
      const nameParts = formData.fullName.trim().split(" ");
      const firstName = nameParts[0] || formData.fullName;
      const lastName = nameParts.slice(1).join(" ") || firstName;

      // إنشاء جلسة الدفع
      const checkoutResult = await createTamaraCheckout({
        orderReferenceId: orderReference,
        totalAmount: total,
        currency: "SAR",
        items: tamaraItems,
        consumer: {
          first_name: firstName,
          last_name: lastName,
          email: user.email,
          phone: formData.phone.startsWith("+966")
            ? formData.phone
            : `+966${formData.phone.replace(/^0/, "")}`,
        },
        shippingAddress: {
          first_name: firstName,
          last_name: lastName,
          line1: `${formData.district}، ${formData.street}`,
          city: formData.city,
          phone: formData.phone.startsWith("+966")
            ? formData.phone
            : `+966${formData.phone.replace(/^0/, "")}`,
        },
        shippingAmount: shipping,
        successUrl: `${baseUrl}/checkout?paymentStatus=approved&order_ref=${orderReference}`,
        failureUrl: `${baseUrl}/checkout?paymentStatus=failed&order_ref=${orderReference}`,
        cancelUrl: `${baseUrl}/checkout?paymentStatus=cancelled&order_ref=${orderReference}`,
        description: `طلب من جبوري للإلكترونيات #${orderReference}`,
      });

      // توجيه المستخدم لصفحة تمارا
      window.location.href = checkoutResult.checkout_url;
    } catch (error: any) {
      console.error("Error creating Tamara checkout:", error);
      alert(`حدث خطأ أثناء إنشاء جلسة الدفع: ${error.message || "خطأ غير معروف"}`);
      setTamaraProcessing(false);
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

  // إنشاء معرف طلب فريد للدفع بالبطاقة
  const generateOrderId = () => {
    return `JAB-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  // التعامل مع نجاح الدفع بالبطاقة
  const handleCardPaymentSuccess = async (captureData: {
    paypalOrderId: string;
    captureId: string;
    status: string;
  }) => {
    if (!user) {
      navigate("/login");
      return;
    }

    setLoading(true);

    try {
      // التحقق من توفر المخزون
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
        paymentMethod: "card",
        paymentStatus: "paid" as const,
        paypalOrderId: captureData.paypalOrderId,
        paypalCaptureId: captureData.captureId,
        paidAt: new Date(),
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

      // تخفيض المخزون
      for (const item of cart) {
        await decrementStock(item.product.id, item.quantity);
      }

      setOrderPlaced(true);
      clearCart();
      setStep(3);
    } catch (error) {
      console.error("Error creating order after card payment:", error);
      alert("تم الدفع بنجاح ولكن حدث خطأ في حفظ الطلب. يرجى التواصل معنا.");
    } finally {
      setLoading(false);
    }
  };

  // التعامل مع خطأ الدفع بالبطاقة
  const handleCardPaymentError = (error: string) => {
    console.error("Card payment error:", error);
    alert(`خطأ في الدفع: ${error}`);
  };

  // تهيئة معرف الطلب للدفع بالبطاقة
  useEffect(() => {
    if (step === 2 && formData.paymentMethod === "card" && !pendingOrderId) {
      setPendingOrderId(generateOrderId());
    }
  }, [step, formData.paymentMethod, pendingOrderId]);

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
                                {method.id === "tamara" && (
                                  <Clock size={24} />
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
                                  {method.id === "tamara" && (
                                    <span>اشترِ الآن وادفع لاحقاً على 3 دفعات بدون فوائد</span>
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

                      {formData.paymentMethod === "card" && pendingOrderId && (
                        <PayPalCardForm
                          amount={total}
                          currency="SAR"
                          orderId={pendingOrderId}
                          onSuccess={handleCardPaymentSuccess}
                          onError={handleCardPaymentError}
                          onProcessing={setCardProcessing}
                        />
                      )}

                      {formData.paymentMethod === "tamara" && (
                        <div className="tamara-details">
                          <div className="tamara-info">
                            <img 
                              src="https://cdn.tamara.co/assets/svg/tamara-logo-badge-ar.svg" 
                              alt="Tamara" 
                              className="tamara-logo"
                            />
                            <h4>قسّمها على 3 دفعات بدون فوائد</h4>
                            <div className="tamara-installments">
                              <div className="installment">
                                <span className="label">اليوم</span>
                                <span className="amount">{formatPrice(total / 3)}</span>
                              </div>
                              <div className="installment">
                                <span className="label">بعد شهر</span>
                                <span className="amount">{formatPrice(total / 3)}</span>
                              </div>
                              <div className="installment">
                                <span className="label">بعد شهرين</span>
                                <span className="amount">{formatPrice(total / 3)}</span>
                              </div>
                            </div>
                            <p className="tamara-note">
                              سيتم تحويلك لصفحة تمارا لإتمام الدفع
                            </p>
                          </div>
                          <button
                            className="btn btn-tamara"
                            onClick={handleTamaraPayment}
                            disabled={tamaraProcessing}
                          >
                            {tamaraProcessing ? (
                              <>
                                <Loader className="spinner" size={18} />
                                جاري التحويل لتمارا...
                              </>
                            ) : (
                              <>
                                <Clock size={18} />
                                الدفع عبر تمارا - {formatPrice(total)}
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="form-actions">
                    <button
                      className="btn btn-outline"
                      onClick={() => setStep(1)}
                      disabled={cardProcessing || tamaraProcessing}
                    >
                      <ArrowRight size={18} />
                      السابق
                    </button>
                    {formData.paymentMethod !== "card" && formData.paymentMethod !== "tamara" && (
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
                    )}
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
