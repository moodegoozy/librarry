/**
 * Tap Payments API Client
 * خدمة التكامل مع تاب - Backend
 * توثيق: https://developers.tap.company/reference/create-a-charge
 *
 * نستخدم مصدر src_all لعرض جميع وسائل الدفع المفعّلة في حساب تاب
 * (mada, KNET, Visa, Mastercard, AMEX, Apple Pay, Google Pay, Benefit, ...).
 */

// المفتاح السري لتاب (sk_live_... أو sk_test_...)
let secretKey = "";
// المفتاح العام (pk_...) — يُخزَّن للمرجع فقط، لا يُستخدم في مسار الـ redirect
let publicKey = "";

const TAP_API_URL = "https://api.tap.company/v2";

/**
 * تعيين مفاتيح API
 */
export function setApiKeys(secKey: string, pubKey?: string): void {
  secretKey = secKey;
  if (pubKey !== undefined) publicKey = pubKey;
}

export function getPublicKey(): string {
  return publicKey;
}

/**
 * واجهة بيانات العميل
 */
interface TapCustomer {
  first_name: string;
  last_name?: string;
  email: string;
  phone: {
    country_code: string;
    number: string;
  };
}

/**
 * استجابة إنشاء عملية الدفع (Charge)
 */
export interface TapChargeResponse {
  id?: string;
  object?: string;
  status?: string; // INITIATED | CAPTURED | FAILED | DECLINED | ...
  amount?: number;
  currency?: string;
  reference?: {
    transaction?: string;
    order?: string;
  };
  transaction?: {
    url?: string; // رابط صفحة الدفع المستضافة لتاب
  };
  redirect?: {
    status?: string;
    url?: string;
  };
  response?: {
    code?: string;
    message?: string;
  };
  source?: {
    id?: string;
    payment_method?: string;
  };
  errors?: Array<{ code?: string; description?: string }>;
  [key: string]: unknown;
}

/**
 * إنشاء عملية دفع (Charge) بمصدر src_all لعرض كل الوسائل
 */
export async function createCharge(params: {
  amount: number;
  currency: string;
  description?: string;
  customer: TapCustomer;
  order_reference: string;
  transaction_reference?: string;
  redirect_url: string;
  post_url?: string;
  source_id?: string; // افتراضياً src_all
  metadata?: Record<string, string>;
}): Promise<TapChargeResponse> {
  if (!secretKey) {
    throw new Error("مفتاح Tap السري غير معد");
  }

  const requestBody = {
    amount: params.amount,
    currency: params.currency || "SAR",
    threeDSecure: true,
    save_card: false,
    description: params.description || "",
    reference: {
      transaction: params.transaction_reference || params.order_reference,
      order: params.order_reference,
    },
    receipt: {
      email: true,
      sms: true,
    },
    customer: params.customer,
    source: {
      id: params.source_id || "src_all",
    },
    ...(params.post_url ? { post: { url: params.post_url } } : {}),
    redirect: {
      url: params.redirect_url,
    },
    ...(params.metadata ? { metadata: params.metadata } : {}),
  };

  const response = await fetch(`${TAP_API_URL}/charges`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${secretKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  const result = (await response.json().catch(() => ({}))) as TapChargeResponse;

  if (!response.ok) {
    console.error("Tap API error:", JSON.stringify(result));
    const msg =
      result.errors?.[0]?.description ||
      (result as { message?: string }).message ||
      `Tap API error: ${response.status}`;
    throw new Error(msg);
  }

  console.log("Tap charge response:", JSON.stringify(result, null, 2));
  return result;
}

/**
 * استرجاع حالة عملية الدفع
 */
export async function retrieveCharge(chargeId: string): Promise<TapChargeResponse> {
  if (!secretKey) {
    throw new Error("مفتاح Tap السري غير معد");
  }

  const response = await fetch(`${TAP_API_URL}/charges/${chargeId}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${secretKey}`,
    },
  });

  const result = (await response.json().catch(() => ({}))) as TapChargeResponse;

  if (!response.ok) {
    const msg =
      result.errors?.[0]?.description ||
      (result as { message?: string }).message ||
      `Tap retrieve error: ${response.status}`;
    throw new Error(msg);
  }

  return result;
}

/**
 * استرجاع الدفع (Refund)
 */
export async function refundCharge(params: {
  chargeId: string;
  amount: number;
  currency: string;
  reason?: string;
}): Promise<{ id?: string; status?: string; amount?: number }> {
  if (!secretKey) {
    throw new Error("مفتاح Tap السري غير معد");
  }

  const response = await fetch(`${TAP_API_URL}/refunds`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${secretKey}`,
    },
    body: JSON.stringify({
      charge_id: params.chargeId,
      amount: params.amount,
      currency: params.currency || "SAR",
      reason: params.reason || "requested_by_customer",
    }),
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    const msg =
      result.errors?.[0]?.description ||
      result.message ||
      `Tap refund error: ${response.status}`;
    throw new Error(msg);
  }

  return result;
}

/**
 * التحقق من صحة المفتاح السري بجلب قائمة العملات المتاحة للتاجر
 */
export async function testConnection(): Promise<boolean> {
  if (!secretKey) {
    throw new Error("مفتاح Tap السري غير معد");
  }

  // نستخدم نقطة نهاية خفيفة للتحقق من صلاحية المفتاح
  const response = await fetch(`${TAP_API_URL}/charges/?limit=1`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${secretKey}`,
    },
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error("المفتاح السري غير صالح");
  }

  // أي استجابة غير 401/403 تعني أن المفتاح مقبول
  return true;
}
