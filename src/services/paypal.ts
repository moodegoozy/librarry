// PayPal Service for Frontend
// يستخدم Firebase Functions للتعامل مع PayPal API بشكل آمن

import { getFunctions, httpsCallable } from "firebase/functions";

// Initialize functions
const functions = getFunctions();

// Types
interface CreateOrderResponse {
  id: string;
  status: string;
}

interface CaptureOrderResponse {
  id: string;
  status: string;
  captureId: string;
  amount: string;
  currency: string;
}

interface OrderStatusResponse {
  id: string;
  status: string;
  amount: string;
  currency: string;
}

// إنشاء طلب دفع في PayPal
export async function createPayPalOrder(data: {
  amount: number;
  currency?: string;
  orderId: string;
  description?: string;
}): Promise<CreateOrderResponse> {
  const createOrder = httpsCallable<typeof data, CreateOrderResponse>(
    functions,
    "paypalCreateOrder"
  );
  const result = await createOrder({
    amount: data.amount,
    currency: data.currency || "SAR",
    orderId: data.orderId,
    description: data.description,
  });
  return result.data;
}

// تأكيد الدفع (Capture)
export async function capturePayPalOrder(data: {
  paypalOrderId: string;
  firestoreOrderId?: string;
}): Promise<CaptureOrderResponse> {
  const captureOrder = httpsCallable<typeof data, CaptureOrderResponse>(
    functions,
    "paypalCaptureOrder"
  );
  const result = await captureOrder(data);
  return result.data;
}

// الحصول على حالة الطلب
export async function getPayPalOrderStatus(
  paypalOrderId: string
): Promise<OrderStatusResponse> {
  const getStatus = httpsCallable<{ paypalOrderId: string }, OrderStatusResponse>(
    functions,
    "paypalGetOrderStatus"
  );
  const result = await getStatus({ paypalOrderId });
  return result.data;
}

// تهيئة PayPal SDK في الصفحة
let paypalScriptLoaded = false;
let paypalScriptPromise: Promise<void> | null = null;

export function loadPayPalScript(): Promise<void> {
  if (paypalScriptLoaded) {
    return Promise.resolve();
  }

  if (paypalScriptPromise) {
    return paypalScriptPromise;
  }

  const clientId = import.meta.env.VITE_PAYPAL_CLIENT_ID;
  
  if (!clientId) {
    return Promise.reject(new Error("PayPal Client ID not configured"));
  }

  paypalScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    // استخدام PayPal Buttons (يدعم البطاقات تلقائياً)
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD&locale=ar_SA&enable-funding=card`;
    script.async = true;
    
    script.onload = () => {
      paypalScriptLoaded = true;
      resolve();
    };
    
    script.onerror = () => {
      paypalScriptPromise = null;
      reject(new Error("Failed to load PayPal SDK"));
    };
    
    document.body.appendChild(script);
  });

  return paypalScriptPromise;
}

// التحقق من تحميل PayPal SDK
export function isPayPalLoaded(): boolean {
  return paypalScriptLoaded && typeof (window as any).paypal !== "undefined";
}

// الحصول على PayPal SDK object
export function getPayPal(): any {
  if (!isPayPalLoaded()) {
    throw new Error("PayPal SDK not loaded");
  }
  return (window as any).paypal;
}
