import React, { useEffect, useState, useRef } from "react";
import { CreditCard, Loader, AlertCircle, Lock } from "lucide-react";
import {
  createPayPalOrder,
  capturePayPalOrder,
} from "../../services/paypal";
import "./PayPalCardForm.css";

interface PayPalCardFormProps {
  amount: number;
  currency?: string;
  orderId: string;
  onSuccess: (captureData: {
    paypalOrderId: string;
    captureId: string;
    status: string;
  }) => void;
  onError: (error: string) => void;
  onProcessing?: (isProcessing: boolean) => void;
}

const PayPalCardForm: React.FC<PayPalCardFormProps> = ({
  amount,
  currency = "SAR",
  orderId,
  onSuccess,
  onError,
  onProcessing,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const buttonRendered = useRef(false);
  const mounted = useRef(true);

  // تحويل المبلغ من ريال إلى دولار
  const usdAmount = (amount * 0.27).toFixed(2);

  useEffect(() => {
    mounted.current = true;
    buttonRendered.current = false;

    const loadPayPalSDK = (): Promise<void> => {
      return new Promise((resolve, reject) => {
        // إزالة SDK القديم إذا موجود
        const existingScript = document.querySelector('script[src*="paypal.com/sdk"]');
        if (existingScript) {
          existingScript.remove();
          delete (window as any).paypal;
        }

        const clientId = import.meta.env.VITE_PAYPAL_CLIENT_ID;
        if (!clientId) {
          reject(new Error("PayPal Client ID غير موجود"));
          return;
        }

        const script = document.createElement("script");
        // تحميل SDK مع دعم البطاقات
        script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD&components=buttons,funding-eligibility&locale=ar_SA`;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("فشل تحميل PayPal"));
        document.body.appendChild(script);
      });
    };

    const initCardButton = async () => {
      try {
        await loadPayPalSDK();
        
        if (!mounted.current) return;

        const paypal = (window as any).paypal;
        if (!paypal) {
          throw new Error("PayPal SDK غير متاح");
        }

        // انتظر حتى تظهر العناصر
        await new Promise(resolve => setTimeout(resolve, 200));

        const container = document.getElementById("paypal-card-button");
        if (!container || buttonRendered.current) {
          setLoading(false);
          return;
        }

        // عرض زر البطاقة فقط (بدون PayPal)
        await paypal.Buttons({
          fundingSource: paypal.FUNDING.CARD,
          style: {
            layout: "vertical",
            color: "black",
            shape: "rect",
            label: "pay",
            height: 50,
          },
          createOrder: async () => {
            try {
              onProcessing?.(true);
              setError(null);
              
              const result = await createPayPalOrder({
                amount,
                currency,
                orderId,
                description: `طلب من جبوري #${orderId}`,
              });
              return result.id;
            } catch (err: any) {
              console.error("Create order error:", err);
              const msg = err.message || "خطأ في إنشاء طلب الدفع";
              setError(msg);
              onProcessing?.(false);
              throw err;
            }
          },
          onApprove: async (data: { orderID: string }) => {
            try {
              onProcessing?.(true);
              const result = await capturePayPalOrder({
                paypalOrderId: data.orderID,
                firestoreOrderId: orderId,
              });

              if (result.status === "COMPLETED") {
                onSuccess({
                  paypalOrderId: data.orderID,
                  captureId: result.captureId,
                  status: result.status,
                });
              } else {
                throw new Error("لم يكتمل الدفع");
              }
            } catch (err: any) {
              console.error("Capture error:", err);
              const msg = err.message || "خطأ في تأكيد الدفع";
              setError(msg);
              onError(msg);
            } finally {
              onProcessing?.(false);
            }
          },
          onCancel: () => {
            setError("تم إلغاء عملية الدفع");
            onProcessing?.(false);
          },
          onError: (err: any) => {
            console.error("Card button error:", err);
            setError("حدث خطأ في معالجة البطاقة");
            onError("حدث خطأ في معالجة البطاقة");
            onProcessing?.(false);
          },
        }).render("#paypal-card-button");

        buttonRendered.current = true;
        setLoading(false);
      } catch (err: any) {
        console.error("PayPal Card init error:", err);
        if (mounted.current) {
          setError(err.message || "خطأ في تهيئة نموذج الدفع");
          setLoading(false);
        }
      }
    };

    initCardButton();

    return () => {
      mounted.current = false;
    };
  }, [amount, currency, orderId]);

  return (
    <div className="paypal-card-form">
      <div className="card-form-header">
        <CreditCard size={20} />
        <span>ادفع بالبطاقة</span>
        <div className="card-brands">
          <img src="https://www.paypalobjects.com/webstatic/mktg/logo/AM_mc_vs_dc_ae.jpg" alt="Visa Mastercard Amex" />
        </div>
      </div>

      <div className="currency-notice">
        <span className="sar-amount">{amount.toFixed(2)} ر.س</span>
        <span className="usd-equivalent">≈ ${usdAmount} USD</span>
      </div>

      {error && (
        <div className="card-form-error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {loading && (
        <div className="paypal-loading">
          <Loader className="spinner" size={24} />
          <span>جاري تحميل نموذج الدفع...</span>
        </div>
      )}

      <div id="paypal-card-button" className="paypal-card-button-container"></div>

      <p className="card-form-note">
        <Lock size={14} />
        <span>معاملة آمنة ومشفرة - بياناتك محمية</span>
      </p>
    </div>
  );
};

export default PayPalCardForm;
