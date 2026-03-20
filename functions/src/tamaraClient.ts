/**
 * Tamara API Client
 * خدمة التكامل مع تمارا - اشتر الآن وادفع لاحقاً
 */

// Tamara API Base URLs
const TAMARA_SANDBOX_URL = "https://api-sandbox.tamara.co";
const TAMARA_PRODUCTION_URL = "https://api.tamara.co";

// استخدام sandbox للاختبار - تغيير لـ production عند الإطلاق
const TAMARA_API_URL = TAMARA_SANDBOX_URL;

// مفتاح API - سيتم تخزينه في Firestore settings
let apiToken: string | null = null;

/**
 * تعيين مفتاح API
 */
export function setApiToken(token: string): void {
  apiToken = token;
}

/**
 * الحصول على مفتاح API
 */
function getApiToken(): string {
  if (!apiToken) {
    throw new Error("Tamara API token غير مُعد. يرجى إعداده أولاً.");
  }
  return apiToken;
}

/**
 * إرسال طلب HTTP لـ Tamara API
 */
async function tamaraRequest(
  endpoint: string,
  method: string = "GET",
  body?: object
): Promise<any> {
  const url = `${TAMARA_API_URL}${endpoint}`;
  const token = getApiToken();

  const headers: Record<string, string> = {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (body && method !== "GET") {
    options.body = JSON.stringify(body);
  }

  console.log(`Tamara API Request: ${method} ${endpoint}`);

  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    console.error("Tamara API Error:", data);
    throw new Error(data.message || data.error || `فشل طلب Tamara: ${response.status}`);
  }

  return data;
}

/**
 * واجهة عنصر السلة
 */
interface TamaraItem {
  reference_id: string;
  type: string;
  name: string;
  sku?: string;
  quantity: number;
  unit_price: {
    amount: number;
    currency: string;
  };
  total_amount: {
    amount: number;
    currency: string;
  };
  image_url?: string;
}

/**
 * واجهة عنوان الشحن
 */
interface TamaraAddress {
  first_name: string;
  last_name: string;
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  country_code: string;
  phone_number: string;
}

/**
 * واجهة المستهلك
 */
interface TamaraConsumer {
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
}

/**
 * واجهة إنشاء جلسة الدفع
 */
export interface CreateCheckoutRequest {
  order_reference_id: string;
  total_amount: number;
  currency: string;
  items: {
    reference_id: string;
    name: string;
    quantity: number;
    unit_price: number;
    image_url?: string;
  }[];
  consumer: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
  };
  shipping_address: {
    first_name: string;
    last_name: string;
    line1: string;
    city: string;
    phone: string;
  };
  shipping_amount: number;
  success_url: string;
  failure_url: string;
  cancel_url: string;
  description?: string;
}

/**
 * إنشاء جلسة دفع تمارا
 */
export async function createCheckoutSession(
  request: CreateCheckoutRequest
): Promise<{
  checkout_id: string;
  checkout_url: string;
  status: string;
}> {
  const currency = request.currency || "SAR";

  // تحويل العناصر لتنسيق تمارا
  const items: TamaraItem[] = request.items.map((item) => ({
    reference_id: item.reference_id,
    type: "physical",
    name: item.name,
    quantity: item.quantity,
    unit_price: {
      amount: item.unit_price,
      currency,
    },
    total_amount: {
      amount: item.unit_price * item.quantity,
      currency,
    },
    image_url: item.image_url,
  }));

  // تجهيز بيانات المستهلك
  const consumer: TamaraConsumer = {
    first_name: request.consumer.first_name,
    last_name: request.consumer.last_name || request.consumer.first_name,
    email: request.consumer.email,
    phone_number: request.consumer.phone,
  };

  // تجهيز عنوان الشحن
  const shippingAddress: TamaraAddress = {
    first_name: request.shipping_address.first_name,
    last_name: request.shipping_address.last_name || request.shipping_address.first_name,
    line1: request.shipping_address.line1,
    city: request.shipping_address.city,
    country_code: "SA", // السعودية
    phone_number: request.shipping_address.phone,
  };

  // تجهيز طلب Checkout
  const checkoutRequest = {
    order_reference_id: request.order_reference_id,
    total_amount: {
      amount: request.total_amount,
      currency,
    },
    description: request.description || `طلب من جبوري للإلكترونيات #${request.order_reference_id}`,
    country_code: "SA",
    payment_type: "PAY_BY_INSTALMENTS",
    instalments: 3, // 3 أقساط
    locale: "ar_SA",
    items,
    consumer,
    shipping_address: shippingAddress,
    shipping_amount: {
      amount: request.shipping_amount,
      currency,
    },
    tax_amount: {
      amount: 0,
      currency,
    },
    merchant_url: {
      success: request.success_url,
      failure: request.failure_url,
      cancel: request.cancel_url,
      notification: request.success_url, // Webhook URL - يمكن تغييره لاحقاً
    },
  };

  console.log("Creating Tamara checkout session:", JSON.stringify(checkoutRequest, null, 2));

  const response = await tamaraRequest("/checkout", "POST", checkoutRequest);

  return {
    checkout_id: response.checkout_id,
    checkout_url: response.checkout_url,
    status: response.status || "created",
  };
}

/**
 * الحصول على تفاصيل الطلب
 */
export async function getOrderDetails(orderId: string): Promise<any> {
  return tamaraRequest(`/orders/${orderId}`);
}

/**
 * التحقق من حالة الدفع
 */
export async function getPaymentStatus(checkoutId: string): Promise<{
  order_id: string;
  status: string;
  payment_type: string;
  total_amount: {
    amount: number;
    currency: string;
  };
}> {
  const response = await tamaraRequest(`/checkout/${checkoutId}`);
  return response;
}

/**
 * تأكيد الطلب (Authorize)
 * يتم استدعاؤه بعد نجاح الدفع من العميل
 */
export async function authorizeOrder(orderId: string): Promise<{
  order_id: string;
  status: string;
  authorized_amount: {
    amount: number;
    currency: string;
  };
}> {
  const response = await tamaraRequest(`/orders/${orderId}/authorise`, "POST", {});
  return response;
}

/**
 * تأكيد استلام الطلب (Capture)
 * يتم استدعاؤه بعد شحن الطلب
 */
export async function capturePayment(
  orderId: string,
  amount: number,
  currency: string = "SAR"
): Promise<any> {
  const captureRequest = {
    total_amount: {
      amount,
      currency,
    },
    shipping_info: {
      shipped_at: new Date().toISOString(),
      shipping_company: "Local Delivery",
    },
  };

  return tamaraRequest(`/orders/${orderId}/capture`, "POST", captureRequest);
}

/**
 * إلغاء الطلب
 */
export async function cancelOrder(orderId: string): Promise<any> {
  return tamaraRequest(`/orders/${orderId}/cancel`, "POST", {});
}

/**
 * استرداد المبلغ
 */
export async function refundPayment(
  orderId: string,
  amount: number,
  currency: string = "SAR",
  reason: string = "Customer refund request"
): Promise<any> {
  const refundRequest = {
    total_amount: {
      amount,
      currency,
    },
    comment: reason,
  };

  return tamaraRequest(`/orders/${orderId}/refund`, "POST", refundRequest);
}

/**
 * التحقق من صلاحية العميل لاستخدام تمارا
 */
export async function checkCustomerEligibility(
  phone: string,
  totalAmount: number,
  currency: string = "SAR"
): Promise<{
  has_available_credit: boolean;
  credit_limit?: {
    amount: number;
    currency: string;
  };
}> {
  const request = {
    phone_number: phone,
    total_amount: {
      amount: totalAmount,
      currency,
    },
    country_code: "SA",
  };

  try {
    const response = await tamaraRequest("/checkout/customer-eligibility", "POST", request);
    return {
      has_available_credit: response.has_available_credit || false,
      credit_limit: response.credit_limit,
    };
  } catch (error) {
    // في حالة فشل التحقق، نعتبر العميل مؤهل افتراضياً
    console.warn("Customer eligibility check failed:", error);
    return { has_available_credit: true };
  }
}
