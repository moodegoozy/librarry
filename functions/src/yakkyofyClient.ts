import fetch from "node-fetch";
import * as admin from "firebase-admin";

const YAKKYOFY_BASE_URL = "https://app.yakkyofy.com/api";

// ==================== الحصول على إعدادات Yakkyofy ====================
async function getApiKey(): Promise<string> {
  const db = admin.firestore();
  const settingsDoc = await db.doc("settings/yakkyofy").get();
  const settings = settingsDoc.data();

  if (!settings?.apiKey) {
    throw new Error(
      "مفتاح Yakkyofy API غير مُعد. يرجى إدخاله في إعدادات Yakkyofy.",
    );
  }

  return settings.apiKey as string;
}

// ==================== طلب مصادق ====================
async function yakkyofyFetch(
  path: string,
  options: {
    method?: string;
    body?: object;
    params?: Record<string, string | number>;
  } = {},
): Promise<any> {
  const apiKey = await getApiKey();

  let url = `${YAKKYOFY_BASE_URL}${path}`;

  // إضافة query params
  if (options.params && Object.keys(options.params).length > 0) {
    const query = Object.entries(options.params)
      .filter(([, v]) => v !== undefined && v !== null && v !== "")
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&");
    if (query) url += `?${query}`;
  }

  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    ...(options.body
      ? { body: JSON.stringify(options.body) }
      : {}),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Yakkyofy API error ${response.status}: ${text || response.statusText}`,
    );
  }

  return response.json();
}

// ==================== اختبار الاتصال ====================
export async function testConnection(
  apiKey: string,
): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`${YAKKYOFY_BASE_URL}/b2b/products?per_page=1`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    if (response.ok) {
      return { success: true, message: "تم الاتصال بـ Yakkyofy بنجاح" };
    } else {
      const text = await response.text().catch(() => "");
      return {
        success: false,
        message: `فشل الاتصال (${response.status}): ${text || response.statusText}`,
      };
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "خطأ غير معروف";
    return { success: false, message: msg };
  }
}

// ==================== البحث عن منتجات ====================
export async function searchProducts(params: {
  name?: string;
  category?: string;
  page?: number;
  per_page?: number;
}): Promise<any> {
  const queryParams: Record<string, string | number> = {
    page: params.page || 1,
    per_page: params.per_page || 20,
  };
  if (params.name) queryParams["name"] = params.name;
  if (params.category) queryParams["category"] = params.category;

  return yakkyofyFetch("/b2b/products", { params: queryParams });
}

// ==================== تفاصيل منتج ====================
export async function getProductDetail(productId: string): Promise<any> {
  return yakkyofyFetch(`/b2b/products/${productId}`);
}

// ==================== متغيرات المنتج ====================
export async function getProductVariants(productId: string): Promise<any> {
  return yakkyofyFetch(`/b2b/products/${productId}/variants`);
}

// ==================== التصنيفات ====================
export async function getCategories(): Promise<any> {
  return yakkyofyFetch("/b2b/categories");
}

// ==================== إنشاء طلب ====================
export async function createOrder(orderData: {
  reference?: string;
  shipping_first_name: string;
  shipping_last_name: string;
  shipping_address: string;
  shipping_city: string;
  shipping_country: string;
  shipping_zip: string;
  shipping_phone: string;
  shipping_email?: string;
  products: { variant_id: number; quantity: number }[];
  notes?: string;
}): Promise<any> {
  return yakkyofyFetch("/b2b/orders", {
    method: "POST",
    body: orderData,
  });
}

// ==================== جلب طلب ====================
export async function getOrder(orderId: string): Promise<any> {
  return yakkyofyFetch(`/b2b/orders/${orderId}`);
}

// ==================== قائمة الطلبات ====================
export async function listOrders(params: {
  page?: number;
  per_page?: number;
  status?: string;
}): Promise<any> {
  const queryParams: Record<string, string | number> = {
    page: params.page || 1,
    per_page: params.per_page || 20,
  };
  if (params.status) queryParams["status"] = params.status;

  return yakkyofyFetch("/b2b/orders", { params: queryParams });
}

// ==================== تتبع الشحنة ====================
export async function getTracking(orderId: string): Promise<any> {
  return yakkyofyFetch(`/b2b/orders/${orderId}/tracking`);
}

// ==================== رصيد الحساب ====================
export async function getBalance(): Promise<any> {
  return yakkyofyFetch("/b2b/balance");
}
