import fetch from "node-fetch";
import * as admin from "firebase-admin";

// ==================== Yakkyofy APIs ====================
// REST الرسمي (طلبات): https://rest.yakkyofy.com
// API الداخلي (منتجات): https://api.yakkyofy.com/api

const YAKKYOFY_REST_URL = "https://rest.yakkyofy.com";
const YAKKYOFY_INTERNAL_URL = "https://api.yakkyofy.com/api";
const YAKKYOFY_V2_URL = "https://apiv2.yakkyofy.com";

type YakkyofySettings = {
  apiKey?: string;
  email?: string;
  password?: string;
  internalToken?: string;
  internalTokenIssuedAt?: admin.firestore.Timestamp | string;
};

async function getSettings(): Promise<YakkyofySettings> {
  const db = admin.firestore();
  const settingsDoc = await db.doc("settings/yakkyofy").get();
  return (settingsDoc.data() || {}) as YakkyofySettings;
}

// ==================== الحصول على API Key ====================
async function getApiKey(): Promise<string> {
  const settings = await getSettings();

  if (!settings?.apiKey) {
    throw new Error("مفتاح Yakkyofy API غير مُعد. يرجى إدخاله في إعدادات Yakkyofy.");
  }

  return settings.apiKey as string;
}

function extractToken(payload: any): string | null {
  return (
    payload?.token ||
    payload?.accessToken ||
    payload?.access_token ||
    payload?.data?.token ||
    payload?.data?.accessToken ||
    payload?.data?.access_token ||
    null
  );
}

async function loginInternal(email: string, password: string): Promise<string> {
  const response = await fetch(`${YAKKYOFY_INTERNAL_URL}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const text = await response.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`فشل تسجيل الدخول الداخلي (${response.status}): ${text.substring(0, 200)}`);
  }

  if (!response.ok) {
    throw new Error(`فشل تسجيل الدخول الداخلي (${response.status}): ${data?.message || text.substring(0, 160)}`);
  }

  const token = extractToken(data);
  if (!token) {
    throw new Error("تم تسجيل الدخول لكن لم يتم استلام توكن x-access-token.");
  }

  await admin.firestore().doc("settings/yakkyofy").set(
    {
      internalToken: token,
      internalTokenIssuedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return token;
}

function tokenIsFresh(issuedAt: YakkyofySettings["internalTokenIssuedAt"]): boolean {
  if (!issuedAt) return false;
  let date: Date | null = null;
  if (typeof issuedAt === "string") date = new Date(issuedAt);
  else if ((issuedAt as any).toDate) date = (issuedAt as any).toDate();
  if (!date || Number.isNaN(date.getTime())) return false;
  const ageMs = Date.now() - date.getTime();
  return ageMs < 90 * 60 * 1000;
}

async function getInternalToken(): Promise<string> {
  const settings = await getSettings();
  if (settings.internalToken && tokenIsFresh(settings.internalTokenIssuedAt)) {
    return settings.internalToken;
  }

  if (!settings.email || !settings.password) {
    throw new Error("الاستيراد المباشر يتطلب البريد الإلكتروني وكلمة المرور في إعدادات Yakkyofy.");
  }

  return loginInternal(settings.email, settings.password);
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
  const url = `${YAKKYOFY_REST_URL}${path}`;

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

async function internalFetch(
  path: string,
  options: {
    method?: string;
    body?: object;
    params?: Record<string, string | number | boolean | undefined>;
  } = {},
): Promise<any> {
  const token = await getInternalToken();
  let url = `${YAKKYOFY_INTERNAL_URL}${path}`;

  if (options.params) {
    const query = Object.entries(options.params)
      .filter(([, v]) => v !== undefined && v !== null && v !== "")
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join("&");
    if (query) url += `?${query}`;
  }

  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      "x-access-token": token,
      "x-api-version": "v1",
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
    throw new Error(`Yakkyofy Internal API: استجابة غير متوقعة (${response.status})`);
  }

  if (!response.ok) {
    throw new Error(`Yakkyofy Internal API error (${response.status}): ${data?.message || text.substring(0, 160)}`);
  }

  return data;
}

async function internalV2Fetch(
  path: string,
  options: {
    method?: string;
    body?: object;
    params?: Record<string, string | number | boolean | undefined>;
  } = {},
): Promise<any> {
  const token = await getInternalToken();
  let url = `${YAKKYOFY_V2_URL}${path}`;

  if (options.params) {
    const query = Object.entries(options.params)
      .filter(([, v]) => v !== undefined && v !== null && v !== "")
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join("&");
    if (query) url += `?${query}`;
  }

  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      "x-access-token": token,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });

  const text = await response.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Yakkyofy V2 API: استجابة غير متوقعة (${response.status})`);
  }

  if (!response.ok) {
    throw new Error(`Yakkyofy V2 API error (${response.status}): ${data?.message || text.substring(0, 160)}`);
  }

  return data;
}

function extractProductList(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];

  const candidates = [
    payload.data,
    payload.items,
    payload.products,
    payload.results,
    payload.rows,
    payload.docs,
    payload.list,
    payload.records,
  ];

  for (const c of candidates) {
    if (Array.isArray(c)) return c;
  }

  for (const value of Object.values(payload)) {
    if (Array.isArray(value) && value.length > 0 && typeof value[0] === "object") {
      return value;
    }
  }

  return [];
}

function normalizeProduct(item: any): any {
  const images =
    (Array.isArray(item?.images) && item.images) ||
    (Array.isArray(item?.pictures) && item.pictures) ||
    (item?.mainImage ? [item.mainImage] : []) ||
    (item?.image ? [item.image] : []);

  const variantsRaw = item?.variants || item?.skus || item?.skuList || [];
  const variants = Array.isArray(variantsRaw)
    ? variantsRaw.map((v: any) => ({
      id: v?.id || v?._id || v?.skuId || v?.sku || "",
      name: v?.name || v?.title || v?.sku || "",
      sku: v?.sku || v?.code || v?.skuId || "",
      price: Number(v?.price || v?.salePrice || v?.offerPrice || 0) || undefined,
      image: v?.image || v?.mainImage || undefined,
    }))
    : [];

  return {
    id: item?.id || item?._id || item?.productId || item?.offerId || item?.pid || "",
    name: item?.name || item?.title || item?.productName || item?.subject || "منتج",
    image: item?.image || item?.mainImage || item?.cover || item?.thumb || images?.[0],
    images,
    price: Number(item?.price || item?.minPrice || item?.offerPrice || item?.wholesalePrice || 0) || 0,
    sale_price: Number(item?.sale_price || item?.salePrice || item?.price || item?.minPrice || 0) || 0,
    category: item?.category || item?.categoryName || item?.catName || "",
    sku: item?.sku || item?.code || "",
    description: item?.description || item?.desc || item?.title || "",
    variants,
    stock: item?.stock ?? item?.quantity ?? undefined,
    raw: item,
  };
}

// ==================== اختبار الاتصال ====================
// يستخدم GET /orders/{id} - إذا عاد 400/404 JSON يعني الـ API key صحيح
// إذا عاد 401/403 يعني الـ key غير صحيح
export async function testConnection(
  apiKey: string,
  email?: string,
  password?: string,
): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`${YAKKYOFY_REST_URL}/orders/connection-test`, {
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

    if (email && password) {
      const token = await loginInternal(email, password);
      if (!token) {
        return { success: false, message: "فشل الحصول على توكن الاستيراد المباشر." };
      }
      return { success: true, message: "تم الاتصال بـ Yakkyofy (REST + استيراد مباشر) بنجاح ✓" };
    }

    return { success: true, message: "تم الاتصال بـ Yakkyofy REST API بنجاح ✓" };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "خطأ غير معروف";
    return { success: false, message: msg };
  }
}

// ==================== منتجات (API داخلي غير رسمي) ====================
export async function searchProducts(params: {
  keyword?: string;
  category?: string;
  page?: number;
  per_page?: number;
}): Promise<any> {
  // 1) كتالوج Yakkyofy/1688 عبر V2 (أقرب لما يظهر داخل المنصة)
  try {
    const v2 = await internalV2Fetch("/1688-catalogue", {
      params: {
        page: params.page || 1,
        perPage: params.per_page || 20,
        category: params.category,
        keyword: params.keyword,
      },
    });

    const listRaw = extractProductList(v2);
    const list = listRaw.map(normalizeProduct);
    return {
      data: list,
      total: v2?.pagination?.total || v2?.total || list.length,
      raw: v2,
      source: "v2-1688-catalogue",
    };
  } catch {
    // fallback to V1 internal endpoints
  }

  const commonParams = {
    page: params.page || 1,
    per_page: params.per_page || 20,
    limit: params.per_page || 20,
    keyword: params.keyword,
    q: params.keyword,
    search: params.keyword,
    name: params.keyword,
    title: params.keyword,
    category: params.category,
  };

  const attempts: Array<() => Promise<any>> = [
    () => internalFetch("/products", { params: commonParams }),
    () => internalFetch("/products/", { params: commonParams }),
    () => internalFetch("/products/management", { params: commonParams }),
    () => internalFetch("/products/management/", { params: commonParams }),
    () => internalFetch("/products/search", { method: "POST", body: commonParams }),
    () => internalFetch("/products/management/search", { method: "POST", body: commonParams }),
  ];

  let lastError: Error | null = null;
  for (const attempt of attempts) {
    try {
      const res = await attempt();
      const list = extractProductList(res);
      if (list.length > 0) {
        const normalized = list.map(normalizeProduct);
        return {
          data: normalized,
          total: res?.total || res?.meta?.total || res?.count || normalized.length,
          raw: res,
        };
      }
      // إذا لم نجد عناصر، نرجع أول رد ناجح بدلاً من رمي خطأ
      if (res) {
        const normalized = extractProductList(res).map(normalizeProduct);
        return {
          data: normalized,
          total: res?.total || res?.meta?.total || res?.count || normalized.length || 0,
          raw: res,
        };
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Yakkyofy search failed");
    }
  }

  throw lastError || new Error("تعذر جلب منتجات Yakkyofy.");
}

export async function getProductDetail(productId: string): Promise<any> {
  try {
    const v2 = await internalV2Fetch(`/1688-catalogue/${productId}`);
    const base = v2?.data || v2;
    return normalizeProduct(base);
  } catch {
    // fallback to V1
  }

  try {
    const v1 = await internalFetch(`/products/${productId}`);
    return normalizeProduct(v1?.data || v1);
  } catch {
    const v1edit = await internalFetch(`/products/edit/${productId}`);
    return normalizeProduct(v1edit?.data || v1edit);
  }
}

export async function getProductVariants(productId: string): Promise<any> {
  try {
    return await internalFetch(`/products/variants/index/${productId}`);
  } catch {
    const detail = await getProductDetail(productId);
    return detail?.variants || detail?.data?.variants || [];
  }
}

export async function getCategories(): Promise<any> {
  return internalFetch("/products/settings");
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

export async function listOrders(params: {
  page?: number;
  per_page?: number;
  status?: string;
}): Promise<any> {
  return internalFetch("/orders", {
    params: {
      page: params.page || 1,
      per_page: params.per_page || 20,
      status: params.status,
    },
  });
}

export async function getTracking(orderId: string): Promise<any> {
  try {
    return await internalFetch(`/orders/fulfillment/tracking/${orderId}`);
  } catch {
    return await internalFetch("/orders/fulfillment/tracking", {
      params: { orderId },
    });
  }
}

export async function getBalance(): Promise<any> {
  try {
    return await internalFetch("/subscription");
  } catch {
    return { balance: null };
  }
}
