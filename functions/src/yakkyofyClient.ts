import fetch from "node-fetch";
import * as admin from "firebase-admin";

// ==================== Yakkyofy REST API ====================
// توثيق: https://developers.yakkyofy.com
// Base URL: https://rest.yakkyofy.com
// المصادقة: X-API-Key header فقط (من Manage Stores في Dashboard)
// Endpoints المتاحة: GET /orders/{id} - POST /orders

const YAKKYOFY_BASE_URL = "https://rest.yakkyofy.com";

// ==================== الحصول على API Key ====================
async function getApiKey(): Promise<string> {
  const db = admin.firestore();
  const settingsDoc = await db.doc("settings/yakkyofy").get();
  const settings = settingsDoc.data();

  if (!settings?.apiKey) {
    throw new Error("مفتاح Yakkyofy API غير مُعد. يرجى إدخاله في إعدادات Yakkyofy.");
  }

  return settings.apiKey as string;
}

// ==================== طلب مصادق ====================
async function yakkyofyFetch(
  path: string,
  options: {
    method?: string;
    body?: object;
  } = {},
): Promise<any> {
  const apiKey = await getApiKey();
  const url = `${YAKKYOFY_BASE_URL}${path}`;

  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      "X-API-Key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });

  const text = await response.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Yakkyofy API: استجابة غير متوقعة (${response.status}): ${text.substring(0, 200)}`);
  }

  if (!response.ok) {
    const msg = data?.message || JSON.stringify(data);
    throw new Error(`Yakkyofy API error (${response.status}): ${msg}`);
  }

  return data;
}

// ==================== اختبار الاتصال ====================
// يستخدم GET /orders/{id} - إذا عاد 400/404 JSON يعني الـ API key صحيح
// إذا عاد 401/403 يعني الـ key غير صحيح
export async function testConnection(
  apiKey: string,
): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`${YAKKYOFY_BASE_URL}/orders/connection-test`, {
      method: "GET",
      headers: {
        "X-API-Key": apiKey,
        Accept: "application/json",
      },
    });

    const text = await response.text();
    const isJson = text.trim().startsWith("{") || text.trim().startsWith("[");

    if (!isJson) {
      return {
        success: false,
        message: `مفتاح API غير صحيح - الخادم أعاد HTML (${response.status}). تحقق من مفتاح API في app.yakkyofy.com → Manage Stores`,
      };
    }

    if (response.status === 401 || response.status === 403) {
      const data = JSON.parse(text);
      return {
        success: false,
        message: `مفتاح API غير صحيح (${response.status}): ${data?.message || "Unauthorized"}`,
      };
    }

    // 400 أو 404 = الـ API تعرّف على الطلب = المفتاح صحيح
    return { success: true, message: "تم الاتصال بـ Yakkyofy REST API بنجاح ✓" };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "خطأ غير معروف";
    return { success: false, message: msg };
  }
}

// ==================== إنشاء طلب ====================
export async function createOrder(orderData: {
  externalId: string;
  note?: string;
  cod?: boolean;
  shippingData: {
    name: string;
    address: string;
    city: string;
    zipcode: string;
    phone: string;
    country: string;
    countryCode: string;
    province: string;
    provinceCode: string;
  };
  items: Array<{
    sku: string;
    quantity: number;
    shippingMethod?: string;
    externalId?: string;
  }>;
}): Promise<any> {
  return yakkyofyFetch("/orders", {
    method: "POST",
    body: orderData,
  });
}

// ==================== جلب طلب معين ====================
export async function getOrder(orderId: string): Promise<any> {
  return yakkyofyFetch(`/orders/${orderId}`);
}
