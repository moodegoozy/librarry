import fetch from "node-fetch";
import * as admin from "firebase-admin";

const YAKKYOFY_BASE_URL = "https://app.yakkyofy.com/api";

// ==================== تسجيل الدخول والحصول على Access Token ====================
async function loginAndGetToken(email: string, password: string): Promise<string> {
  const response = await fetch(`${YAKKYOFY_BASE_URL}/b2b/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const bodyText = await response.text();
  let data: any;
  try {
    data = JSON.parse(bodyText);
  } catch {
    throw new Error(`تسجيل الدخول فشل (${response.status}): ${bodyText.substring(0, 300)}`);
  }

  if (!response.ok) {
    const msg = data?.message || data?.error || JSON.stringify(data);
    throw new Error(`فشل تسجيل الدخول في Yakkyofy (${response.status}): ${msg}`);
  }

  const token = data?.access_token || data?.token || data?.data?.access_token;
  if (!token) {
    throw new Error(`لم يُعاد access_token من Yakkyofy. الاستجابة: ${JSON.stringify(data).substring(0, 300)}`);
  }

  // حفظ الـ token في Firestore مع تاريخ انتهاء الصلاحية (24 ساعة)
  const db = admin.firestore();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db.doc("settings/yakkyofy").set(
    {
      accessToken: token,
      tokenExpiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
    },
    { merge: true },
  );

  return token;
}

// ==================== الحصول على access token صالح ====================
async function getValidAccessToken(): Promise<string> {
  const db = admin.firestore();
  const settingsDoc = await db.doc("settings/yakkyofy").get();
  const settings = settingsDoc.data();

  if (!settings?.email || !settings?.apiKey) {
    throw new Error("بيانات Yakkyofy غير مُعدة. يرجى إدخال البريد الإلكتروني ومفتاح API في إعدادات Yakkyofy.");
  }

  // التحقق من صلاحية الـ token المخزّن
  if (settings.accessToken && settings.tokenExpiresAt) {
    let expiry: Date;
    if (settings.tokenExpiresAt.toDate) {
      expiry = settings.tokenExpiresAt.toDate();
    } else {
      expiry = new Date(settings.tokenExpiresAt);
    }
    // إضافة هامش 5 دقائق
    if (expiry > new Date(Date.now() + 5 * 60 * 1000)) {
      return settings.accessToken as string;
    }
  }

  // تسجيل دخول للحصول على token جديد
  return await loginAndGetToken(settings.email as string, settings.apiKey as string);
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
  const accessToken = await getValidAccessToken();

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
      Authorization: `Bearer ${accessToken}`,
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
      `Yakkyofy API error ${response.status}: ${text.substring(0, 300) || response.statusText}`,
    );
  }

  // التحقق من أن الاستجابة JSON وليست HTML قبل التحويل
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("json")) {
    const preview = (await response.text()).substring(0, 300);
    const isHtml = preview.toLowerCase().includes("<!doctype") || preview.toLowerCase().includes("<html");
    const hint = isHtml
      ? "الـ API يُعيد صفحة HTML بدل JSON - تحقق من صحة مفتاح API في إعدادات Yakkyofy."
      : `نوع الاستجابة غير متوقع (${contentType}):`;
    throw new Error(`${hint} ${preview}`);
  }

  return response.json();
}

// ==================== اختبار الاتصال ====================
export async function testConnection(
  email: string,
  apiKey: string,
): Promise<{ success: boolean; message: string }> {
  try {
    // محاولة تسجيل الدخول للحصول على access_token
    const token = await loginAndGetToken(email, apiKey);

    // اختبار طلب حقيقي بعد الحصول على الـ token
    const response = await fetch(`${YAKKYOFY_BASE_URL}/b2b/products?per_page=1`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    if (response.ok) {
      return { success: true, message: "تم الاتصال بـ Yakkyofy بنجاح ✓" };
    } else {
      const bodyText = await response.text();
      return {
        success: false,
        message: `تسجيل الدخول نجح لكن طلب المنتجات فشل (${response.status}): ${bodyText.substring(0, 200)}`,
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
