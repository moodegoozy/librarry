import fetch from "node-fetch";
import * as admin from "firebase-admin";

// ==================== Yakkyofy APIs ====================
// REST الرسمي (طلبات): https://rest.yakkyofy.com
// API الداخلي (منتجات): https://api.yakkyofy.com/api

const YAKKYOFY_REST_URL = "https://rest.yakkyofy.com";
const YAKKYOFY_INTERNAL_URL = "https://api.yakkyofy.com/api";
const YAKKYOFY_V2_URL = "https://apiv2.yakkyofy.com";
const YAKKYOFY_MEDIA_FALLBACK = "https://yakkyofy-media.dokku.yakkyo.com";

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

function normalizeImageUrl(value: any): string {
  if (!value) return "";

  // إذا كان الكائن يحتوي على مصفوفة روابط، خذ أول واحد
  if (typeof value === "object") {
    const nestedArr =
      value.fullPathImageURIList ||
      value.fullPathImageURI ||
      value.imageURIList ||
      value.imageURI ||
      value.urls ||
      value.list;
    if (Array.isArray(nestedArr) && nestedArr.length) {
      for (const n of nestedArr) {
        const norm = normalizeImageUrl(n);
        if (norm) return norm;
      }
    }
  }

  const raw =
    (typeof value === "string" && value) ||
    value?.url ||
    value?.src ||
    value?.image ||
    value?.imageUrl ||
    value?.mainImage ||
    value?.fullPath ||
    value?.full ||
    value?.original ||
    value?.large ||
    value?.medium ||
    value?.thumb ||
    value?.thumbnail ||
    value?.path ||
    "";

  if (!raw) return "";
  let str = String(raw).trim();
  if (!str) return "";

  // إزالة علامات الاقتباس الإضافية إن وُجدت
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    str = str.slice(1, -1).trim();
  }

  if (str.startsWith("https://")) return str;
  if (str.startsWith("http://")) return "https://" + str.substring(7); // ترقية لـ https لتفادي mixed-content
  if (str.startsWith("//")) return `https:${str}`;
  if (str.startsWith("/")) return `${YAKKYOFY_MEDIA_FALLBACK}${str}`;

  // روابط بدون بروتوكول (مثل cbu01.alicdn.com/img/...)
  if (/^[a-z0-9.-]+\.(com|net|cn|org|io)\//i.test(str)) {
    return `https://${str}`;
  }

  return str;
}

function dedupeImages(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const i of arr) {
    const key = (i || "").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

// استخراج كل الصور المحتملة من بنيات 1688/Yakkyofy المتعددة
function collectImages(item: any): string[] {
  if (!item || typeof item !== "object") return [];

  const arrays = [
    item.images,
    item.pictures,
    item.imageList,
    item.imageUrls,
    item.imageUrlList,
    item.photoUrls,
    item.productImageList,
    item.productImages,
    item.productPictureUrl,
    item.productPictures,
    item.pictureList,
    item.picList,
    item.picUrls,
    item.picUrlList,
    item.skuImages,
    item.detailImages,
    item.detailImageList,
    item.descImages,
  ].filter(Array.isArray);

  // productImage قد يكون كائناً يحتوي fullPathImageURIList
  const productImageObj =
    item.productImage && typeof item.productImage === "object" && !Array.isArray(item.productImage)
      ? item.productImage
      : null;

  if (productImageObj) {
    const inner = [
      productImageObj.fullPathImageURIList,
      productImageObj.fullPathImageURI,
      productImageObj.imageURIList,
      productImageObj.imageURI,
      productImageObj.urls,
      productImageObj.list,
    ].filter(Array.isArray);
    arrays.push(...inner);
  }

  const singles = [
    typeof item.productImage === "string" ? item.productImage : null,
    productImageObj?.url,
    productImageObj?.src,
    item.mainImage,
    item.mainImageUrl,
    item.mainPic,
    item.mainPicture,
    item.image,
    item.imageUrl,
    item.cover,
    item.coverImage,
    item.coverUrl,
    item.thumb,
    item.thumbnail,
    item.pic,
    item.picUrl,
    item.pic_url,
    item.productImg,
    item.productImageUrl,
  ];

  const all: any[] = [];
  for (const arr of arrays) all.push(...arr);
  all.push(...singles);

  return dedupeImages(all.map(normalizeImageUrl).filter(Boolean));
}

function normalizeProduct(item: any): any {
  const images = collectImages(item);

  const variantsRaw = item?.variants || item?.skus || item?.skuList || item?.skuInfos || [];
  const variants = Array.isArray(variantsRaw)
    ? variantsRaw.map((v: any) => ({
      id: v?.id || v?._id || v?.skuId || v?.sku || "",
      name: v?.name || v?.title || v?.sku || v?.skuAttributes || "",
      sku: v?.sku || v?.code || v?.skuId || "",
      price: Number(v?.price || v?.salePrice || v?.offerPrice || 0) || undefined,
      image:
        normalizeImageUrl(
          v?.image || v?.imageUrl || v?.mainImage || v?.pic || v?.picUrl || v?.thumb || v?.thumbnail,
        ) || undefined,
    }))
    : [];

  return {
    id: item?.id || item?._id || item?.productId || item?.offerId || item?.pid || "",
    name:
      item?.name ||
      item?.title ||
      item?.productName ||
      item?.subject ||
      item?.subjectTrans ||
      "منتج",
    image: images?.[0] || "",
    images,
    price:
      Number(item?.price || item?.minPrice || item?.offerPrice || item?.wholesalePrice || 0) || 0,
    sale_price:
      Number(item?.sale_price || item?.salePrice || item?.price || item?.minPrice || 0) || 0,
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
